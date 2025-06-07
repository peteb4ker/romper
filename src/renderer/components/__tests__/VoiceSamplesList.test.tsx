// Test suite for VoiceSamplesList component
import { cleanup,fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach,describe, expect, it, vi } from 'vitest';

import SampleList from '../SampleList'; // Import SampleList for direct testing
import VoiceSamplesList from '../VoiceSamplesList';

afterEach(() => cleanup());

describe('VoiceSamplesList', () => {
  // Provide samples as an object mapping voice numbers to arrays
  const samples = {
    1: ['kick.wav', 'snare.wav', 'hat.wav'],
    2: ['perc1.wav'],
    3: [],
    4: ['fx1.wav', 'fx2.wav']
  };
  const baseProps = {
    samples,
    playing: null,
    // Remove onPlay from baseProps to avoid shadowing
  };

  it('renders all samples for each voice', () => {
    render(<VoiceSamplesList {...baseProps} onPlay={vi.fn()} />);
    expect(screen.getByText('kick.wav')).toBeInTheDocument();
    expect(screen.getByText('snare.wav')).toBeInTheDocument();
    expect(screen.getByText('hat.wav')).toBeInTheDocument();
    expect(screen.getByText('perc1.wav')).toBeInTheDocument();
    expect(screen.getByText('fx1.wav')).toBeInTheDocument();
    expect(screen.getByText('fx2.wav')).toBeInTheDocument();
    expect(screen.getAllByText('No samples assigned').length).toBe(1); // for voice 3
  });

  it('calls onPlay when the play button is clicked', () => {
    const onPlay = vi.fn();
    render(<VoiceSamplesList onPlay={onPlay} {...baseProps} />);
    // Find the <li> containing 'snare.wav' for voice 1
    const snareSpans = screen.getAllByText('snare.wav');
    const snareLi = snareSpans[0].closest('li');
    const playButton = snareLi?.querySelector('button');
    fireEvent.click(playButton!);
    expect(onPlay).toHaveBeenCalledWith(1, 'snare.wav');
  });

  it('highlights the selected sample in SampleList', () => {
    render(<VoiceSamplesList {...baseProps} onPlay={vi.fn()} />);
    // At least one <li> containing 'kick.wav' should be highlighted (voice 1)
    const kickSpans = screen.getAllByText('kick.wav');
    const highlighted = kickSpans.some(span => span.closest('li')?.className.match(/font-bold|bg-blue/));
    expect(highlighted).toBe(true);
  });
});

// Direct test suite for SampleList component
describe('SampleList direct', () => {
  it('calls onPlay when play button is clicked', () => {
    const onPlay = vi.fn();
    render(
      <SampleList
        voice={1}
        samples={['snare.wav']}
        playing={null}
        onPlay={onPlay}
      />
    );
    const playButton = screen.getByRole('button', { name: /play/i });
    fireEvent.click(playButton);
    expect(onPlay).toHaveBeenCalledWith(1, 'snare.wav');
  });
});
