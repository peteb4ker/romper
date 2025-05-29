// Test suite for SampleWaveform component
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import SampleWaveform from '../SampleWaveform';

describe('SampleWaveform', () => {
  it('renders the waveform canvas and filename', () => {
    render(<SampleWaveform fileName="kick.wav" data={new Float32Array([0, 1, 0, -1])} />);
    expect(screen.getByText('kick.wav')).toBeInTheDocument();
    expect(screen.getByRole('img', { hidden: true })).toBeInTheDocument();
  });

  it('shows a loading state if data is not provided', () => {
    render(<SampleWaveform fileName="snare.wav" data={null} />);
    expect(screen.getByText('snare.wav')).toBeInTheDocument();
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });
});
