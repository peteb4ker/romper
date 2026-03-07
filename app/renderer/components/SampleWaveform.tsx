import React, { useEffect, useRef, useState } from "react";

interface SampleWaveformProps {
  // Secure API - uses kit/voice/slot identifiers
  kitName: string;
  onError?: (error: string) => void;
  onPlayingChange?: (playing: boolean) => void;

  playTrigger: number; // increment to trigger play externally
  slotNumber: number;
  stopTrigger?: number; // increment to trigger stop externally
  voiceColor?: string; // CSS color for waveform, falls back to accent-primary
  voiceNumber: number;
  volume?: number; // 0-100, applied via GainNode
}

const CANVAS_HEIGHT = 28;

const SampleWaveform: React.FC<SampleWaveformProps> = ({
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
  const containerRef = useRef<HTMLDivElement>(null);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playhead, setPlayhead] = useState(0);
  const [, setError] = useState<null | string>(null);
  const [canvasWidth, setCanvasWidth] = useState(120);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const animationRef = useRef<null | number>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  // Track stopTrigger value at the time of last play to prevent a batched
  // stop from killing a freshly started source in the same render cycle.
  const stopTriggerAtPlayRef = useRef(0);

  // Measure container width with ResizeObserver
  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = Math.floor(entry.contentRect.width);
        if (width > 0) setCanvasWidth(width);
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

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

  // Resolve the waveform color from prop or CSS variable
  function resolveWaveformColor(): string {
    if (voiceColor) return voiceColor;
    const style = getComputedStyle(document.documentElement);
    return style.getPropertyValue("--accent-primary").trim() || "#2889be";
  }

  // Resolve the playhead color from CSS variable
  function resolvePlayheadColor(): string {
    const style = getComputedStyle(document.documentElement);
    return style.getPropertyValue("--transport-play").trim() || "#d97706";
  }

  // Draw waveform using RMS envelope with retina scaling
  function drawWaveform(buffer: AudioBuffer, width: number) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const cssWidth = width;
    const cssHeight = CANVAS_HEIGHT;

    // Set backing store dimensions for retina
    canvas.width = cssWidth * dpr;
    canvas.height = cssHeight * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, cssWidth, cssHeight);

    const waveColor = resolveWaveformColor();
    ctx.strokeStyle = waveColor;
    ctx.lineWidth = 1.2;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    const data = buffer.getChannelData(0);
    const step = Math.ceil(data.length / cssWidth);
    const mid = cssHeight / 2;

    // Compute RMS per column
    const rmsValues: number[] = [];
    let maxRms = 0;
    for (let i = 0; i < cssWidth; i++) {
      let sumSq = 0;
      const start = i * step;
      const end = Math.min(start + step, data.length);
      for (let j = start; j < end; j++) {
        const d = data[j] || 0;
        sumSq += d * d;
      }
      const rms = Math.sqrt(sumSq / (end - start));
      rmsValues.push(rms);
      if (rms > maxRms) maxRms = rms;
    }

    // Normalize and draw mirrored envelope
    const scale = maxRms > 0 ? (mid - 1) / maxRms : 0;

    // Draw top half
    ctx.beginPath();
    ctx.moveTo(0, mid - rmsValues[0] * scale);
    for (let i = 1; i < cssWidth; i++) {
      ctx.lineTo(i, mid - rmsValues[i] * scale);
    }
    ctx.stroke();

    // Draw bottom half (mirror)
    ctx.beginPath();
    ctx.moveTo(0, mid + rmsValues[0] * scale);
    for (let i = 1; i < cssWidth; i++) {
      ctx.lineTo(i, mid + rmsValues[i] * scale);
    }
    ctx.stroke();

    // Fill between the two lines with a subtle wash
    ctx.fillStyle = waveColor;
    ctx.globalAlpha = 0.08;
    ctx.beginPath();
    ctx.moveTo(0, mid - rmsValues[0] * scale);
    for (let i = 1; i < cssWidth; i++) {
      ctx.lineTo(i, mid - rmsValues[i] * scale);
    }
    for (let i = cssWidth - 1; i >= 0; i--) {
      ctx.lineTo(i, mid + rmsValues[i] * scale);
    }
    ctx.closePath();
    ctx.fill();
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
    const linear = volume != null ? volume / 100 : 1;
    const gain = linear * linear;
    gainNodeRef.current.gain.setValueAtTime(gain, ctx.currentTime);
    source.connect(gainNodeRef.current);
    source.start();
    sourceRef.current = source;
    setIsPlaying(true);
    const startTime = ctx.currentTime;
    function animate() {
      if (!audioBuffer) return;
      const elapsed = ctx.currentTime - startTime;
      setPlayhead(Math.min(elapsed / audioBuffer.duration, 1));
      if (elapsed < audioBuffer.duration) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setIsPlaying(false);
        setPlayhead(0);
      }
    }
    animate();
    source.onended = () => {
      setIsPlaying(false);
      setPlayhead(0);
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

  // Draw waveform and playhead whenever buffer, size, or playhead changes
  useEffect(() => {
    if (!audioBuffer) return;
    drawWaveform(audioBuffer, canvasWidth);

    // Draw playhead overlay
    if (isPlaying) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const dpr = window.devicePixelRatio || 1;
      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.strokeStyle = resolvePlayheadColor();
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      const x = Math.floor(playhead * canvasWidth);
      ctx.moveTo(x, 0);
      ctx.lineTo(x, CANVAS_HEIGHT);
      ctx.stroke();
      ctx.restore();
    }
  }, [playhead, isPlaying, audioBuffer, canvasWidth, voiceColor]); // eslint-disable-line react-hooks/exhaustive-deps -- resolve* functions are stable

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
    <div
      ref={containerRef}
      style={{
        alignItems: "center",
        display: "flex",
        flex: "1 1 0",
        minWidth: 0,
      }}
    >
      <canvas
        className="rounded"
        height={CANVAS_HEIGHT}
        ref={canvasRef}
        style={{
          display: "block",
          height: `${CANVAS_HEIGHT}px`,
          width: "100%",
        }}
        width={canvasWidth}
      />
    </div>
  );
};

export default SampleWaveform;
