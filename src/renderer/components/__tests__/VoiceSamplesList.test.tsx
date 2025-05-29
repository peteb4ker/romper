// Test suite for VoiceSamplesList component
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import VoiceSamplesList from '../VoiceSamplesList';

describe('VoiceSamplesList', () => {
  const baseProps = {
    samples: ['kick.wav', 'snare.wav', 'hat.wav'],
    onSelect: vi.fn(),
    selectedSample: 'snare.wav',
  };

  it('renders all samples', () => {
    render(<VoiceSamplesList {...baseProps} />);
    expect(screen.getByText('kick.wav')).toBeInTheDocument();
    expect(screen.getByText('snare.wav')).toBeInTheDocument();
    expect(screen.getByText('hat.wav')).toBeInTheDocument();
  });

  it('calls onSelect when a sample is clicked', () => {
    const onSelect = vi.fn();
    render(<VoiceSamplesList {...baseProps} onSelect={onSelect} />);
    fireEvent.click(screen.getByText('snare.wav'));
    expect(onSelect).toHaveBeenCalledWith('snare.wav');
  });

  it('highlights the selected sample', () => {
    render(<VoiceSamplesList {...baseProps} selectedSample="hat.wav" />);
    const selected = screen.getByText('hat.wav');
    expect(selected.className).toMatch(/selected|active|highlight/);
  });
});
