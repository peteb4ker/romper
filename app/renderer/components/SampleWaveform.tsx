import React, { useEffect, useRef, useState } from "react";

interface SampleWaveformProps {
  // Secure API - uses kit/voice/slot identifiers
  kitName: string;
  voiceNumber: number;
  slotNumber: number;

  playTrigger: number; // increment to trigger play externally
  stopTrigger?: number; // increment to trigger stop externally
  onPlayingChange?: (playing: boolean) => void;
  onError?: (error: string) => void;
}

const SampleWaveform: React.FC<SampleWaveformProps> = ({
  kitName,
  voiceNumber,
  slotNumber,
  playTrigger,
  stopTrigger,
  onPlayingChange,
  onError,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playhead, setPlayhead] = useState(0);
  const [_error, setError] = useState<string | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const animationRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

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
        try {
          const closeResult = audioCtxRef.current.close();
          if (closeResult && typeof closeResult.catch === "function") {
            closeResult.catch(() => {
              // Ignore close errors
            });
          }
        } catch {
          // Ignore synchronous close errors
        }
      }
    };
  }, [kitName, voiceNumber, slotNumber]); // eslint-disable-line react-hooks/exhaustive-deps -- onError intentionally excluded to prevent infinite loops

  // Draw waveform
  function drawWaveform(buffer: AudioBuffer) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#0ea5e9"; // teal-500
    ctx.lineWidth = 1;
    const data = buffer.getChannelData(0);
    const step = Math.ceil(data.length / canvas.width);
    const amp = canvas.height / 2;
    ctx.beginPath();
    for (let i = 0; i < canvas.width; i++) {
      let min = 1.0,
        max = -1.0;
      for (let j = 0; j < step; j++) {
        const datum = data[i * step + j] || 0;
        if (datum < min) min = datum;
        if (datum > max) max = datum;
      }
      ctx.moveTo(i, (1 + min) * amp);
      ctx.lineTo(i, (1 + max) * amp);
    }
    ctx.stroke();
  }

  // Stop playback logic
  const stopPlayback = () => {
    if (sourceRef.current) {
      try {
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
    stopPlayback(); // Stop any previous playback
    const ctx = audioCtxRef.current;
    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);
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
  }, [playTrigger, audioBuffer]);

  // Stop playback when stopTrigger changes
  useEffect(() => {
    if (!isPlaying) return;
    if (!stopTrigger) return;
    // Stop playback
    if (sourceRef.current) {
      sourceRef.current.stop();
    }
    setIsPlaying(false);
    setPlayhead(0);
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
        try {
          const closeResult = audioCtxRef.current.close();
          if (closeResult && typeof closeResult.catch === "function") {
            closeResult.catch(() => {
              // Ignore close errors
            });
          }
        } catch {
          // Ignore synchronous close errors
        }
      }
    };
  }, []);

  return (
    <div style={{ display: "flex", alignItems: "center" }}>
      <canvas
        ref={canvasRef}
        width={80}
        height={18}
        className="rounded bg-slate-100 dark:bg-slate-800 shadow align-middle"
        style={{ display: "inline-block", verticalAlign: "middle" }}
      />
      {/* Remove inline error message, error is now shown via MessageDisplay */}
    </div>
  );
};

export default SampleWaveform;
