import React, { useCallback, useEffect, useRef, useState } from "react";

import type { PlayOptions, PlayRegion } from "./kitTypes";

import { getSharedAudioContext } from "../utils/sharedAudioContext";
import { clearVoiceLevel, setVoiceLevel } from "./led-icon/audioLevels";
import { claimVoice } from "./voiceChoke";

// Short gain ramp at slice edges and on choke, so slices don't click
const ANTI_CLICK_SECONDS = 0.002;

interface SampleWaveformProps {
  gainDb?: number; // Per-sample gain trim in dB (-24 to +12, 0 = unity)
  // Secure API - uses kit/voice/slot identifiers
  kitName: string;
  onError?: (error: string) => void;
  onPlayingChange?: (playing: boolean) => void;

  playOptions?: PlayOptions; // region and start time (sequencer); whole sample, now, if unset
  playTrigger: number; // increment to trigger play externally
  slotNumber: number;
  stopTrigger?: number; // increment to trigger stop externally
  voiceColor?: string; // CSS color or var(--voice-N) reference
  voiceNumber: number;
  volume?: number; // 0-100, applied via GainNode
}

// Build min/max envelope arrays for waveform rendering
function buildEnvelope(
  data: Float32Array,
  width: number,
  step: number,
  amp: number,
): { bottoms: Float32Array; tops: Float32Array } {
  const tops = new Float32Array(width);
  const bottoms = new Float32Array(width);
  for (let i = 0; i < width; i++) {
    let max = -1,
      min = 1;
    for (let j = 0; j < step; j++) {
      const datum = data[i * step + j] || 0;
      if (datum < min) min = datum;
      if (datum > max) max = datum;
    }
    tops[i] = (1 + max) * amp;
    bottoms[i] = (1 + min) * amp;
  }
  return { bottoms, tops };
}

function computeRms(
  analyser: AnalyserNode,
  dataArray: Uint8Array<ArrayBuffer>,
): number {
  analyser.getByteTimeDomainData(dataArray);
  let sum = 0;
  for (const datum of dataArray) {
    const sample = (datum - 128) / 128;
    sum += sample * sample;
  }
  return Math.sqrt(sum / dataArray.length);
}

/** Gain envelope with short fades at both ends of a slice, so it doesn't click. */
function createSliceEnvelope(
  ctx: BaseAudioContext,
  startTime: number,
  playLength: number,
): GainNode {
  const envelope = ctx.createGain();
  const fade = Math.min(ANTI_CLICK_SECONDS, playLength / 4);
  envelope.gain.setValueAtTime(0, startTime);
  envelope.gain.linearRampToValueAtTime(1, startTime + fade);
  envelope.gain.setValueAtTime(1, startTime + playLength - fade);
  envelope.gain.linearRampToValueAtTime(0, startTime + playLength);
  return envelope;
}

/** Offset and duration (seconds) to play: a region of the buffer, or all of it. */
function playWindow(
  duration: number,
  region?: PlayRegion,
): { offset: number; playLength: number } {
  if (!region) return { offset: 0, playLength: duration };
  const offset = Math.min(Math.max(region.start, 0), 1) * duration;
  const playLength = Math.max(
    0,
    Math.min(region.length * duration, duration - offset),
  );
  return { offset, playLength };
}

// Resolve a color value that may be a CSS var() reference into a raw color
// string usable by canvas APIs. Falls back to accent-primary or a default blue.
function resolveWaveformColor(voiceColor?: string): string {
  if (voiceColor) {
    const varMatch = /^var\((.+)\)$/.exec(voiceColor);
    if (varMatch) {
      const resolved = getComputedStyle(document.documentElement)
        .getPropertyValue(varMatch[1])
        .trim();
      if (resolved) return resolved;
    }
    return voiceColor;
  }
  const style = getComputedStyle(document.documentElement);
  return style.getPropertyValue("--accent-primary").trim() || "#2889be";
}

/** Start a source now, at a scheduled time, or for a region only. */
function startSource(
  source: AudioBufferSourceNode,
  ctx: BaseAudioContext,
  startTime: number,
  window?: { offset: number; playLength: number },
): void {
  if (window) {
    source.start(startTime, window.offset, window.playLength);
  } else if (startTime > ctx.currentTime) {
    source.start(startTime);
  } else {
    source.start();
  }
}

/**
 * Stop a playing source at `stopAt` (context time, or now). Slice sources
 * fade out over a few ms instead of cutting, so they don't click.
 */
function stopSource(
  source: AudioBufferSourceNode,
  envelope: GainNode | null,
  ctx: BaseAudioContext | null,
  stopAt?: number,
): void {
  // Clear onended BEFORE stop() to prevent the stale callback from
  // firing asynchronously and corrupting state for a newly started source.
  source.onended = null;
  const t = ctx ? Math.max(ctx.currentTime, stopAt ?? 0) : 0;
  if (!envelope || !ctx) {
    try {
      source.stop(t);
    } catch {
      // Ignore stop errors
    }
    source.disconnect();
    return;
  }
  try {
    if (envelope.gain.cancelAndHoldAtTime) {
      envelope.gain.cancelAndHoldAtTime(t);
    } else {
      envelope.gain.cancelScheduledValues(t);
      envelope.gain.setValueAtTime(envelope.gain.value, t);
    }
    envelope.gain.linearRampToValueAtTime(0, t + ANTI_CLICK_SECONDS);
    source.onended = () => {
      source.disconnect();
      envelope.disconnect();
    };
    source.stop(t + ANTI_CLICK_SECONDS);
  } catch {
    source.disconnect();
    envelope.disconnect();
  }
}

/**
 * Convert a performance.now() timestamp to a context time (now if unset or
 * past). getOutputTimestamp() pairs the two clocks precisely; currentTime alone
 * can advance in coarse (~10 ms) chunks, which would jitter scheduled starts.
 */
function toContextTime(ctx: BaseAudioContext, at?: number): number {
  if (at == null) return ctx.currentTime;
  const stamp = (ctx as AudioContext).getOutputTimestamp?.();
  const mapped =
    stamp?.contextTime != null && stamp.performanceTime
      ? stamp.contextTime + (at - stamp.performanceTime) / 1000
      : ctx.currentTime + (at - performance.now()) / 1000;
  return Math.max(ctx.currentTime, mapped);
}

// Trace a canvas path through an array of y-values
function tracePath(ctx: CanvasRenderingContext2D, values: Float32Array): void {
  for (let i = 0; i < values.length; i++) {
    if (i === 0) ctx.moveTo(i, values[i]);
    else ctx.lineTo(i, values[i]);
  }
}

const SampleWaveform: React.FC<SampleWaveformProps> = ({
  gainDb,
  kitName,
  onError,
  onPlayingChange,
  playOptions,
  playTrigger,
  slotNumber,
  stopTrigger,
  voiceColor,
  voiceNumber,
  volume,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // useState is already destructured as [value, setter]; NOSONAR
  // suppresses S6754 false positive.
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null); // NOSONAR
  const [isPlaying, setIsPlaying] = useState(false);
  const [playhead, setPlayhead] = useState(0);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  // Per-source envelope used for region (slice) playback anti-click fades
  const envelopeRef = useRef<GainNode | null>(null);
  // Releases this component's sound from the voice-choke registry
  const releaseVoiceRef = useRef<(() => void) | null>(null);
  const animationRef = useRef<null | number>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const analyserLRef = useRef<AnalyserNode | null>(null);
  const analyserRRef = useRef<AnalyserNode | null>(null);
  const analyserDataLRef = useRef<null | Uint8Array<ArrayBuffer>>(null);
  const analyserDataRRef = useRef<null | Uint8Array<ArrayBuffer>>(null);
  // Track stopTrigger value at the time of last play to prevent a batched
  // stop from killing a freshly started source in the same render cycle.
  const stopTriggerAtPlayRef = useRef(0);
  // The last playTrigger this slot acted on, starting at the value it
  // mounted with. Triggers are counted per slot ("voice:slot") and outlive
  // the sample in it, so a sample that moves into a played slot, or a slot
  // shown again after a kit change, mounts with a count above 0 and must not
  // play until it is triggered (RE-45).
  const handledPlayTriggerRef = useRef(playTrigger);
  // Latest play options, read when a choke arrives
  const playOptionsRef = useRef(playOptions);
  playOptionsRef.current = playOptions;

  // Disconnect this slot's volume and meter nodes from the shared context.
  // They are connected to its output, so they would otherwise live (and
  // keep processing) for as long as the app runs (RE-14).
  const releaseMeters = useCallback(() => {
    gainNodeRef.current?.disconnect();
    gainNodeRef.current = null;
    analyserLRef.current = null;
    analyserRRef.current = null;
    analyserDataLRef.current = null;
    analyserDataRRef.current = null;
  }, []);

  // Load audio file and decode
  useEffect(() => {
    let cancelled = false;

    // Use secure API with kit/voice/slot identifiers
    if (!globalThis.electronAPI?.getSampleAudioBuffer) {
      if (onError) onError("Sample audio buffer API not available");
      return;
    }

    const api = globalThis.electronAPI;
    const where = `kit=${kitName}, voice=${voiceNumber}, slot=${slotNumber}`;

    /** The slot's file, or null for an empty slot or one that can't load */
    const fetchAudio = async (): Promise<ArrayBuffer | null> => {
      try {
        const result = await api.getSampleAudioBuffer(
          kitName,
          voiceNumber,
          slotNumber,
        );
        if (!result.success) {
          throw new Error(result.error || "Failed to load sample audio");
        }
        // Null data for missing samples (empty slots)
        return result.data ?? null;
      } catch (err) {
        if (!cancelled) {
          // Logged for debugging, without a user-facing error for missing samples
          console.warn(`[SampleWaveform] Sample not found: ${where}:`, err);
        }
        return null;
      }
    };

    const load = async () => {
      const arrayBuffer = await fetchAudio();
      if (cancelled) return;
      if (!arrayBuffer) {
        setAudioBuffer(null);
        return;
      }

      try {
        // The new sample may have another channel count, so its meters are
        // rebuilt on first play
        releaseMeters();
        const ctx = getSharedAudioContext();
        audioCtxRef.current = ctx;
        const buf = await ctx.decodeAudioData(arrayBuffer.slice(0));
        if (cancelled) return;
        setAudioBuffer(buf);
        drawWaveform(buf);
      } catch (err) {
        // A file Romper can't read: its slot is labelled and the kit
        // quarantined (#537), so this isn't a background failure
        if (!cancelled) {
          console.warn(`[SampleWaveform] Can't decode sample: ${where}:`, err);
        }
        setAudioBuffer(null);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [kitName, voiceNumber, slotNumber]); // eslint-disable-line react-hooks/exhaustive-deps -- onError intentionally excluded to prevent infinite loops

  // Draw waveform using an envelope (top/bottom outline with fill)
  const drawWaveform = useCallback(
    (buffer: AudioBuffer) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const color = resolveWaveformColor(voiceColor);
      const data = buffer.getChannelData(0);
      const step = Math.ceil(data.length / w);
      const amp = h / 2;

      const { bottoms, tops } = buildEnvelope(data, w, step, amp);

      // Draw filled envelope
      ctx.beginPath();
      tracePath(ctx, tops);
      for (let i = w - 1; i >= 0; i--) {
        ctx.lineTo(i, bottoms[i]);
      }
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.12;
      ctx.fill();

      // Draw edge strokes
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.6;
      ctx.lineWidth = 1;
      ctx.beginPath();
      tracePath(ctx, tops);
      ctx.stroke();
      ctx.beginPath();
      tracePath(ctx, bottoms);
      ctx.stroke();

      ctx.globalAlpha = 1;
    },
    [voiceColor],
  );

  // Stop playback logic. `stopAt` (context time) lets a choke land exactly
  // when the next scheduled sound starts, instead of leaving a gap before it.
  const stopPlayback = useCallback(
    (stopAt?: number) => {
      const source = sourceRef.current;
      if (source) {
        stopSource(source, envelopeRef.current, audioCtxRef.current, stopAt);
        sourceRef.current = null;
        envelopeRef.current = null;
      }
      releaseVoiceRef.current?.();
      releaseVoiceRef.current = null;
      setIsPlaying(false);
      setPlayhead(0);
      clearVoiceLevel(voiceNumber);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    },
    [voiceNumber],
  );

  // Play sample and animate playhead (triggered by playTrigger prop)
  useEffect(() => {
    if (!audioBuffer || !audioCtxRef.current) return;
    // Play only on a new trigger: not on mount, and not again when the
    // buffer reloads
    if (playTrigger === handledPlayTriggerRef.current) return;
    handledPlayTriggerRef.current = playTrigger;
    const ctx = audioCtxRef.current;
    // Sequencer triggers are scheduled slightly ahead on a steady timeline
    // (performance.now() ms); convert to this context's clock
    const startTime = toContextTime(ctx, playOptions?.startAt);
    // Stop any previous playback (clears stale onended) as this one starts
    stopPlayback(startTime);
    // Snapshot current stopTrigger so the stop effect won't kill this
    // freshly started source if both triggers changed in the same batch.
    stopTriggerAtPlayRef.current = stopTrigger ?? 0;
    if (ctx.state === "suspended") {
      void ctx.resume().catch(() => {
        // Nothing more to do; onstatechange has logged it
      });
    }
    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    // Volume gain and VU meters are created once per context and reused.
    // Creating meters per trigger leaked thousands of connected nodes a
    // minute under the sequencer (RE-14).
    const isStereo = audioBuffer.numberOfChannels >= 2;
    if (!gainNodeRef.current) {
      const gain = ctx.createGain();
      gain.connect(ctx.destination);
      gainNodeRef.current = gain;
      const analyserL = ctx.createAnalyser();
      analyserL.fftSize = 256;
      analyserLRef.current = analyserL;
      analyserDataLRef.current = new Uint8Array(analyserL.frequencyBinCount);
      if (isStereo) {
        const analyserR = ctx.createAnalyser();
        analyserR.fftSize = 256;
        analyserRRef.current = analyserR;
        analyserDataRRef.current = new Uint8Array(analyserR.frequencyBinCount);
        const splitter = ctx.createChannelSplitter(2);
        gain.connect(splitter);
        splitter.connect(analyserL, 0);
        splitter.connect(analyserR, 1);
      } else {
        gain.connect(analyserL);
      }
    }
    // Logarithmic volume curve: x^2 approximates perceived loudness
    const voiceLinear = volume == null ? 1 : volume / 100;
    const voiceGain = voiceLinear * voiceLinear;
    const sampleGain = Math.pow(10, (gainDb ?? 0) / 20); // dB to linear
    gainNodeRef.current.gain.setValueAtTime(voiceGain * sampleGain, startTime);

    // Region (slice) playback: offset + duration, with an anti-click envelope
    const playRegion = playOptions?.region;
    const { offset, playLength } = playWindow(audioBuffer.duration, playRegion);
    if (playRegion) {
      const envelope = createSliceEnvelope(ctx, startTime, playLength);
      source.connect(envelope);
      envelope.connect(gainNodeRef.current);
      envelopeRef.current = envelope;
    } else {
      source.connect(gainNodeRef.current);
    }

    startSource(
      source,
      ctx,
      startTime,
      playRegion ? { offset, playLength } : undefined,
    );
    sourceRef.current = source;
    // The voice is monophonic: this sound stops anything else on it,
    // whichever slot or component started it (and is stopped in turn)
    const sliceEnvelopeForChoke = envelopeRef.current;
    const releaseVoice = claimVoice(
      voiceNumber,
      (atMs) => {
        const at = toContextTime(ctx, atMs);
        if (sourceRef.current === source) {
          stopPlayback(at);
        } else {
          stopSource(source, sliceEnvelopeForChoke, ctx, at);
        }
      },
      playOptions?.startAt,
    );
    releaseVoiceRef.current = releaseVoice;
    setIsPlaying(true);
    function animate() {
      if (!audioBuffer) return;
      const elapsed = Math.max(0, ctx.currentTime - startTime);
      setPlayhead(Math.min((offset + elapsed) / audioBuffer.duration, 1));

      // Report RMS levels for VU meter
      const leftRms =
        analyserLRef.current && analyserDataLRef.current
          ? computeRms(analyserLRef.current, analyserDataLRef.current)
          : 0;
      const rightRms =
        analyserRRef.current && analyserDataRRef.current
          ? computeRms(analyserRRef.current, analyserDataRRef.current)
          : leftRms;
      setVoiceLevel(voiceNumber, {
        isStereo,
        left: leftRms,
        right: rightRms,
      });

      if (elapsed < playLength) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setIsPlaying(false);
        setPlayhead(0);
        clearVoiceLevel(voiceNumber);
      }
    }
    animate();
    const sliceEnvelope = envelopeRef.current;
    source.onended = () => {
      // Release the finished source and its slice envelope from the graph
      source.disconnect();
      sliceEnvelope?.disconnect();
      releaseVoice();
      setIsPlaying(false);
      setPlayhead(0);
      clearVoiceLevel(voiceNumber);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [playTrigger, audioBuffer]); // eslint-disable-line react-hooks/exhaustive-deps -- stopTrigger read for snapshot only, not as a dependency

  // Stop playback when stopTrigger changes (voice choke or manual stop)
  useEffect(() => {
    if (!isPlaying) return;
    if (!stopTrigger) return;
    // If the play effect just ran in this render cycle, it already recorded
    // the current stopTrigger value. Skip to avoid killing the new source.
    if (stopTrigger === stopTriggerAtPlayRef.current) return;
    // A choke from a scheduled sequencer trigger carries its start time
    const ctx = audioCtxRef.current;
    stopPlayback(
      ctx ? toContextTime(ctx, playOptionsRef.current?.stopAt) : undefined,
    );
  }, [stopTrigger, isPlaying, stopPlayback]);

  // Notify parent about playing state changes
  useEffect(() => {
    if (onPlayingChange) onPlayingChange(isPlaying);
  }, [isPlaying]); // eslint-disable-line react-hooks/exhaustive-deps -- onPlayingChange intentionally excluded to prevent infinite loops

  // Draw playhead
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !audioBuffer) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // Redraw waveform
    drawWaveform(audioBuffer);
    // Draw playhead
    if (isPlaying) {
      ctx.strokeStyle = "#f59e42"; // orange-400
      ctx.beginPath();
      const x = Math.floor(playhead * canvas.width);
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
  }, [playhead, isPlaying, audioBuffer, drawWaveform]);

  // Clean up on unmount. The shared context stays open for the other slots.
  useEffect(() => {
    return () => {
      stopPlayback();
      releaseMeters();
    };
  }, [stopPlayback, releaseMeters]);

  return (
    <div style={{ alignItems: "center", display: "flex" }}>
      <canvas
        className="rounded bg-surface-3 shadow align-middle"
        data-testid={`sample-waveform-${voiceNumber}-${slotNumber}`}
        height={18}
        ref={canvasRef}
        style={{ display: "inline-block", verticalAlign: "middle" }}
        width={80}
      />
      {/* Remove inline error message, error is now shown via MessageDisplay */}
    </div>
  );
};

export default SampleWaveform;
