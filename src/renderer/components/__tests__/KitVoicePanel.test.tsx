// Test suite for KitVoicePanel component
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import KitVoicePanel from '../KitVoicePanel';

describe('KitVoicePanel', () => {
  const baseProps = {
    voices: [
      { name: 'Kick', samples: ['kick1.wav', 'kick2.wav'] },
      { name: 'Snare', samples: ['snare1.wav'] },
      { name: 'Hat', samples: [] },
      { name: 'Tom', samples: ['tom1.wav'] },
    ],
    onSelectVoice: () => {},
    selectedVoice: 1,
  };

  it('renders all voices and sample counts', () => {
    render(<KitVoicePanel {...baseProps} />);
    expect(screen.getByText('Kick')).toBeInTheDocument();
    expect(screen.getByText('Snare')).toBeInTheDocument();
    expect(screen.getByText('Hat')).toBeInTheDocument();
    expect(screen.getByText('Tom')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument(); // Kick samples
    expect(screen.getByText('1')).toBeInTheDocument(); // Snare/Tom samples
    expect(screen.getAllByText('0').length).toBeGreaterThanOrEqual(1); // Hat samples
  });

  it('highlights the selected voice', () => {
    render(<KitVoicePanel {...baseProps} selectedVoice={2} />);
    const snare = screen.getByText('Snare');
    expect(snare.className).toMatch(/selected|active|highlight/);
  });
});
