import React, { useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import WaveSurfer from 'wavesurfer.js';

interface SampleSlotWithDropzoneProps {
    voice: number;
    onDrop: (file: File) => void;
}

const SampleSlotWithDropzone: React.FC<SampleSlotWithDropzoneProps> = ({ voice, onDrop }) => {
    const waveformRef = useRef<HTMLDivElement | null>(null);

    const { getRootProps, getInputProps } = useDropzone({
        accept: {
            'audio/wav': ['.wav'], // Correct format for accepting .wav files
        },
        onDrop: (acceptedFiles: File[]) => {
            const file = acceptedFiles[0];
            onDrop(file);

            const wavesurfer = WaveSurfer.create({
                container: waveformRef.current!,
                waveColor: 'cyan',
                progressColor: 'blue',
                barWidth: 2,
                height: 50,
            });
            wavesurfer.load(URL.createObjectURL(file));
        },
    });

    return (
        <div
            {...getRootProps()}
            className="p-4 bg-slate-800 rounded-lg shadow hover:shadow-lg transition flex flex-col space-y-4"
        >
            <input {...getInputProps()} />
            <div className="flex justify-between items-center">
                <span className="font-mono text-cyan-400">Voice {voice}</span>
                <span className="text-gray-400">Drop a sample here</span>
            </div>
            <div ref={waveformRef} className="h-16 bg-slate-700 rounded overflow-hidden"></div>
        </div>
    );
};

export default SampleSlotWithDropzone;