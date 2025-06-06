// Test suite for SampleList component
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import SampleList from '../SampleList';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});

describe('SampleList', () => {
  const baseProps = {
    voice: 1,
    samples: ['kick.wav', 'snare.wav', 'hat.wav'],
    playing: null,
    onPlay: vi.fn(),
    onSelect: vi.fn(),
    selectedSample: 'snare.wav',
  };

  it('renders all samples', () => {
    render(<SampleList {...baseProps} />);
    expect(screen.getByText('kick.wav')).toBeInTheDocument();
    expect(screen.getByText('snare.wav')).toBeInTheDocument();
    expect(screen.getByText('hat.wav')).toBeInTheDocument();
  });

  it('calls onSelect when a sample is clicked', () => {
    const onSelect = vi.fn();
    render(<SampleList {...baseProps} onSelect={onSelect} />);
    fireEvent.click(screen.getByText('snare.wav'));
    expect(onSelect).toHaveBeenCalledWith('snare.wav');
  });

  it('highlights the selected sample', () => {
    render(<SampleList {...baseProps} selectedSample="hat.wav" />);
    const selected = screen.getByText('hat.wav');
    expect(selected.parentElement?.className).toMatch(/bg-blue-100|bg-blue-800|font-bold/);
  });

  it('navigates samples with up/down arrows and selects with space/enter', () => {
    const onSelect = vi.fn();
    const onPlay = vi.fn();
    render(<SampleList {...baseProps} onSelect={onSelect} onPlay={onPlay} />);
    const list = screen.getByTestId('sample-list');
    list.focus();
    // Initial selection is snare.wav
    expect(screen.getByTestId('sample-selected')).toHaveTextContent('snare.wav');
    // Down arrow to hat.wav
    fireEvent.keyDown(list, { key: 'ArrowDown' });
    expect(screen.getByTestId('sample-selected')).toHaveTextContent('hat.wav');
    // Up arrow to snare.wav
    fireEvent.keyDown(list, { key: 'ArrowUp' });
    expect(screen.getByTestId('sample-selected')).toHaveTextContent('snare.wav');
    // Up arrow to kick.wav
    fireEvent.keyDown(list, { key: 'ArrowUp' });
    expect(screen.getByTestId('sample-selected')).toHaveTextContent('kick.wav');
    // Down arrow to snare.wav
    fireEvent.keyDown(list, { key: 'ArrowDown' });
    expect(screen.getByTestId('sample-selected')).toHaveTextContent('snare.wav');
    // Space to select/play
    fireEvent.keyDown(list, { key: ' ' });
    expect(onSelect).toHaveBeenCalledWith('snare.wav');
    expect(onPlay).toHaveBeenCalledWith(1, 'snare.wav');
    // Enter to select/play
    fireEvent.keyDown(list, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledWith('snare.wav');
    expect(onPlay).toHaveBeenCalledWith(1, 'snare.wav');
    // Up at first sample does not go past
    fireEvent.keyDown(list, { key: 'ArrowUp' });
    fireEvent.keyDown(list, { key: 'ArrowUp' });
    expect(screen.getByTestId('sample-selected')).toHaveTextContent('kick.wav');
    // Down at last sample does not go past
    fireEvent.keyDown(list, { key: 'ArrowDown' });
    fireEvent.keyDown(list, { key: 'ArrowDown' });
    fireEvent.keyDown(list, { key: 'ArrowDown' });
    expect(screen.getByTestId('sample-selected')).toHaveTextContent('hat.wav');
  });
});
