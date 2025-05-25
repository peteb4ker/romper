import React from 'react';
import SampleList from './SampleList';

interface VoiceSamplesListProps {
  samples: { [voice: number]: string[] };
  playing: { voice: number; sample: string } | null;
  onPlay: (voice: number, sample: string) => void;
}

const VoiceSamplesList: React.FC<VoiceSamplesListProps> = ({ samples, playing, onPlay }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    {[1, 2, 3, 4].map(voice => (
      <div key={voice} className="flex flex-col">
        <div className="font-semibold mb-1 text-gray-800 dark:text-gray-100 pl-1">Voice {voice}:</div>
        <div className="flex-1 p-3 rounded-lg shadow bg-gray-100 dark:bg-slate-800 text-gray-900 dark:text-gray-100 min-h-[80px]">
          <SampleList
            voice={voice}
            samples={samples[voice] || []}
            playing={playing}
            onPlay={onPlay}
          />
        </div>
      </div>
    ))}
  </div>
);

export default VoiceSamplesList;
