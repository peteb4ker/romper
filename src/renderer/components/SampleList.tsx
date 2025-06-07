import React, { KeyboardEvent, useEffect, useRef, useState } from "react";
import { FiPlay } from "react-icons/fi";

interface SampleListProps {
  voice: number;
  samples: string[];
  playing: { voice: number; sample: string } | null;
  onPlay: (voice: number, sample: string) => void;
  selectedSample?: string;
  onSelect?: (sample: string) => void;
}

const SampleList: React.FC<SampleListProps> = ({
  voice,
  samples,
  playing,
  onPlay,
  selectedSample,
  onSelect,
}) => {
  const [selectedIdx, setSelectedIdx] = useState<number>(0);
  const listRef = useRef<HTMLUListElement>(null);

  // Only set initial selectedIdx from selectedSample on mount or samples change
  const initializedRef = useRef(false);
  useEffect(() => {
    if (!initializedRef.current) {
      if (selectedSample) {
        const idx = samples.findIndex((s) => s === selectedSample);
        setSelectedIdx(idx !== -1 ? idx : 0);
      } else {
        setSelectedIdx(0);
      }
      initializedRef.current = true;
    }
  }, [selectedSample, samples]);

  useEffect(() => {
    // Focus the selected item if list is focused
    if (listRef.current && listRef.current.contains(document.activeElement)) {
      const item = listRef.current.querySelectorAll("li")[selectedIdx];
      if (item) (item as HTMLElement).focus();
    }
  }, [selectedIdx]);

  const handleKeyDown = (e: KeyboardEvent<HTMLUListElement>) => {
    if (!samples.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((idx) => {
        const next = Math.min(idx + 1, samples.length - 1);
        if (next !== idx && onSelect) onSelect(samples[next]);
        return next;
      });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx((idx) => {
        const prev = Math.max(idx - 1, 0);
        if (prev !== idx && onSelect) onSelect(samples[prev]);
        return prev;
      });
    } else if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      if (onSelect) onSelect(samples[selectedIdx]);
      onPlay(voice, samples[selectedIdx]);
    }
  };

  if (!samples.length) {
    return (
      <div className="text-gray-400 italic text-sm ml-1">
        No samples assigned
      </div>
    );
  }
  return (
    <ul
      className="list-disc ml-4 text-sm"
      ref={listRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      aria-label="Sample list"
      data-testid="sample-list"
    >
      {samples.slice(0, 12).map((sample, i) => (
        <li
          key={sample}
          className={`truncate flex items-center gap-2${selectedIdx === i ? " bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-100 font-bold" : ""}`}
          tabIndex={-1}
          aria-selected={selectedIdx === i}
          data-testid={selectedIdx === i ? "sample-selected" : undefined}
          onClick={() => {
            setSelectedIdx(i);
            if (onSelect) onSelect(sample);
            onPlay(voice, sample);
          }}
        >
          <button
            className={`p-1 rounded hover:bg-blue-100 dark:hover:bg-slate-700 ${playing && playing.voice === voice && playing.sample === sample ? "text-green-600 dark:text-green-400" : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              onPlay(voice, sample);
            }}
            aria-label="Play"
            tabIndex={-1}
          >
            <FiPlay />
          </button>
          <span
            className="truncate text-xs font-mono text-gray-800 dark:text-gray-100"
            title={sample}
          >
            {sample}
          </span>
        </li>
      ))}
      {samples.length > 12 && (
        <li className="italic text-xs text-gray-500 dark:text-gray-400">
          ...and more
        </li>
      )}
    </ul>
  );
};

export default SampleList;
