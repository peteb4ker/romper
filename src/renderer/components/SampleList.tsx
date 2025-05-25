import React from 'react';
import { FiPlay } from 'react-icons/fi';

interface SampleListProps {
  voice: number;
  samples: string[];
  playing: { voice: number; sample: string } | null;
  onPlay: (voice: number, sample: string) => void;
}

const SampleList: React.FC<SampleListProps> = ({ voice, samples, playing, onPlay }) => {
  if (!samples.length) {
    return <div className="text-gray-400 italic text-sm ml-1">No samples assigned</div>;
  }
  return (
    <ul className="list-disc ml-4 text-sm">
      {samples.slice(0, 12).map(sample => (
        <li key={sample} className="truncate flex items-center gap-2">
          <button
            className={`p-1 rounded hover:bg-blue-100 dark:hover:bg-slate-700 ${playing && playing.voice === voice && playing.sample === sample ? 'text-green-600 dark:text-green-400' : ''}`}
            onClick={() => onPlay(voice, sample)}
            aria-label="Play"
          >
            <FiPlay />
          </button>
          <span className="truncate text-xs font-mono text-gray-800 dark:text-gray-100" title={sample}>{sample}</span>
        </li>
      ))}
      {samples.length > 12 && (
        <li className="italic text-xs text-gray-500 dark:text-gray-400">...and more</li>
      )}
    </ul>
  );
};

export default SampleList;
