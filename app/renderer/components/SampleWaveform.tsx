import React, { useEffect, useRef, useState } from "react";

interface SampleWaveformProps {
  filePath: string;
  playTrigger: number; // increment to trigger play externally
  stopTrigger?: number; // increment to trigger stop externally
  onPlayingChange?: (playing: boolean) => void;
  onError?: (error: string) => void;
}

const SampleWaveform: React.FC<SampleWaveformProps> = ({
  filePath,
  playTrigger,
  stopTrigger,
  onPlayingChange,
  onError,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playhead, setPlayhead] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const animationRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Load audio file and decode
  useEffect(() => {
    let cancelled = false;
    setError(null);
    // @ts-ignore
    window.electronAPI
      .getAudioBuffer(filePath)
      .then((arrayBuffer: ArrayBuffer) => {
        if (cancelled) return;
        // Always close previous context before creating a new one
        if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
          try {
            audioCtxRef.current.close();
          } catch (e) {}
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
          setError("Failed to load audio.");
          if (onError) onError("Failed to load audio.");
        }
        setAudioBuffer(null);
      });
    return () => {
      cancelled = true;
      if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
        try {
          audioCtxRef.current.close();
        } catch (e) {}
      }
    };
  }, [filePath, onError]);

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
      } catch (e) {}
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
  }, [playTrigger]);

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
  }, [isPlaying, onPlayingChange]);

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
          audioCtxRef.current.close();
        } catch (e) {}
      }
    };
  }, []);

  // Button click handler
  const handleButtonClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isPlaying) {
      stopPlayback();
    } else {
      // Simulate playTrigger increment
      setPlayhead(0);
      setIsPlaying(false);
      // This will retrigger the play effect if parent increments playTrigger
      // If you want to allow local play, you can call the play logic here
      // But for now, parent should control playTrigger
    }
  };

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
