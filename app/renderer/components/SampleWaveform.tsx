import React, { useEffect, useRef, useState } from "react";

import { clearVoiceLevel, setVoiceLevel } from "./led-icon/audioLevels";

interface SampleWaveformProps {
  gainDb?: number; // Per-sample gain trim in dB (-24 to +12, 0 = unity)
  // Secure API - uses kit/voice/slot identifiers
  kitName: string;
  onError?: (error: string) => void;
  onPlayingChange?: (playing: boolean) => void;

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
    let max = -1.0,
      min = 1.0;
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
  for (let i = 0; i < dataArray.length; i++) {
    const sample = (dataArray[i] - 128) / 128;
    sum += sample * sample;
  }
  return Math.sqrt(sum / dataArray.length);
}

// Resolve a color value that may be a CSS var() reference into a raw color
// string usable by canvas APIs. Falls back to accent-primary or a default blue.
function resolveWaveformColor(voiceColor?: string): string {
  if (voiceColor) {
    const varMatch = voiceColor.match(/^var\((.+)\)$/);
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
  playTrigger,
  slotNumber,
  stopTrigger,
  voiceColor,
  voiceNumber,
  volume,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playhead, setPlayhead] = useState(0);
  const [, setError] = useState<null | string>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
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

  // Load audio file and decode
  useEffect(() => {
    let cancelled = false;
    setError(null);

    // Use secure API with kit/voice/slot identifiers
    if (!window.electronAPI?.getSampleAudioBuffer) {
      setError("Sample audio buffer API not available");
      if (onError) onError("Sample audio buffer API not available");
      return;
    }

    window.electronAPI
      .getSampleAudioBuffer(kitName, voiceNumber, slotNumber)
      .then(async (arrayBuffer: ArrayBuffer | null) => {
        if (cancelled) return;

        // Handle null response for missing samples (empty slots)
        if (!arrayBuffer) {
          setAudioBuffer(null);
          setError(null);
          return;
        }

        // Always close previous context before creating a new one
        if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
          try {
            await audioCtxRef.current.close();
          } catch {
            // Ignore close errors
          }
        }
        const ctx = new window.AudioContext();
        audioCtxRef.current = ctx;
        ctx.decodeAudioData(arrayBuffer.slice(0), (buf) => {
          setAudioBuffer(buf);
          drawWaveform(buf);
        });
      })
      .catch((err) => {
        if (!cancelled) {
          // Log the error for debugging but don't show user-facing error for missing samples
          console.warn(
            `[SampleWaveform] Sample not found: kit=${kitName}, voice=${voiceNumber}, slot=${slotNumber}:`,
            err,
          );
          setError(null); // Don't show error to user for missing samples
        }
        setAudioBuffer(null);
      });
    return () => {
      cancelled = true;
      if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
        const result = audioCtxRef.current.close();
        result?.catch(() => {
          // Ignore close errors
        });
      }
    };
  }, [kitName, voiceNumber, slotNumber]); // eslint-disable-line react-hooks/exhaustive-deps -- onError intentionally excluded to prevent infinite loops

  // Draw waveform using an envelope (top/bottom outline with fill)
  function drawWaveform(buffer: AudioBuffer) {
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

    ctx.globalAlpha = 1.0;
  }

  // Stop playback logic
  const stopPlayback = () => {
    if (sourceRef.current) {
      try {
        // Clear onended BEFORE stop() to prevent the stale callback from
        // firing asynchronously and corrupting state for a newly started source.
        sourceRef.current.onended = null;
        sourceRef.current.stop();
      } catch {
        // Ignore stop errors
      }
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    setIsPlaying(false);
    setPlayhead(0);
    clearVoiceLevel(voiceNumber);
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
  };

  // Play sample and animate playhead (triggered by playTrigger prop)
  useEffect(() => {
    if (!audioBuffer || !audioCtxRef.current) return;
    if (playTrigger === 0) return; // don't auto-play on mount
    stopPlayback(); // Stop any previous playback (clears stale onended)
    // Snapshot current stopTrigger so the stop effect won't kill this
    // freshly started source if both triggers changed in the same batch.
    stopTriggerAtPlayRef.current = stopTrigger ?? 0;
    const ctx = audioCtxRef.current;
    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    // Route through GainNode for volume control
    if (!gainNodeRef.current) {
      gainNodeRef.current = ctx.createGain();
      gainNodeRef.current.connect(ctx.destination);
    }
    // Logarithmic volume curve: x^2 approximates perceived loudness
    const voiceLinear = volume != null ? volume / 100 : 1;
    const voiceGain = voiceLinear * voiceLinear;
    const sampleGain = Math.pow(10, (gainDb ?? 0) / 20); // dB to linear
    gainNodeRef.current.gain.setValueAtTime(
      voiceGain * sampleGain,
      ctx.currentTime,
    );
    source.connect(gainNodeRef.current);

    // Set up AnalyserNodes for VU meter
    const isStereo = audioBuffer.numberOfChannels >= 2;
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
      gainNodeRef.current.connect(splitter);
      splitter.connect(analyserL, 0);
      splitter.connect(analyserR, 1);
    } else {
      gainNodeRef.current.connect(analyserL);
      analyserRRef.current = null;
      analyserDataRRef.current = null;
    }

    source.start();
    sourceRef.current = source;
    setIsPlaying(true);
    const startTime = ctx.currentTime;
    function animate() {
      if (!audioBuffer) return;
      const elapsed = ctx.currentTime - startTime;
      setPlayhead(Math.min(elapsed / audioBuffer.duration, 1));

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

      if (elapsed < audioBuffer.duration) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setIsPlaying(false);
        setPlayhead(0);
        clearVoiceLevel(voiceNumber);
      }
    }
    animate();
    source.onended = () => {
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
    stopPlayback();
  }, [stopTrigger, isPlaying]);

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
  }, [playhead, isPlaying, audioBuffer]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopPlayback();
      if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
        const result = audioCtxRef.current.close();
        result?.catch(() => {
          // Ignore close errors
        });
      }
    };
  }, []);

  return (
    <div style={{ alignItems: "center", display: "flex" }}>
      <canvas
        className="rounded bg-surface-3 shadow align-middle"
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
