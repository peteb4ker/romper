import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import KitItem from '../KitItem';

describe('KitItem', () => {
  const baseProps = {
    kit: 'A1',
    colorClass: '',
    isValid: true,
    onSelect: vi.fn(),
    onDuplicate: vi.fn(),
    sampleCounts: [12, 12, 12, 12],
    kitLabel: {
      voiceNames: {
        1: 'Loop',
        2: 'Loop',
        3: 'Kick',
        4: 'Loop',
      },
    },
  };

  it('renders kit name and unique voice labels', () => {
    render(<KitItem {...baseProps} />);
    expect(screen.getByText('A1')).toBeInTheDocument();
    expect(screen.getByText('Loop')).toBeInTheDocument();
    expect(screen.getByText('Kick')).toBeInTheDocument();
    // Only one 'Loop' and one 'Kick' should be present
    expect(screen.getAllByText('Loop').length).toBe(1);
    expect(screen.getAllByText('Kick').length).toBe(1);
  });

  it('calls onSelect when clicked', () => {
    const onSelect = vi.fn();
    render(<KitItem {...baseProps} onSelect={onSelect} />);
    fireEvent.click(screen.getByText('A1'));
    expect(onSelect).toHaveBeenCalled();
  });

  it('calls onDuplicate when duplicate button is clicked', () => {
    const onDuplicate = vi.fn();
    render(<KitItem {...baseProps} onDuplicate={onDuplicate} />);
    fireEvent.click(screen.getByTitle('Duplicate kit'));
    expect(onDuplicate).toHaveBeenCalled();
  });

  it('shows invalid style if isValid is false', () => {
    render(<KitItem {...baseProps} isValid={false} />);
    expect(screen.getByText('A1').className).toMatch(/text-red/);
  });

  it('renders sample counts for each voice', () => {
    render(<KitItem {...baseProps} sampleCounts={[1, 2, 3, 4]} />);
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
  });
});

describe('KitItem voice label deduplication', () => {
  it('renders each voice label only once (array)', () => {
    const kitLabel = { voiceNames: ['vox', 'vox', 'synth', 'synth', 'fx'] };
    render(
      <KitItem
        kit="Test Kit"
        colorClass=""
        isValid={true}
        onSelect={() => {}}
        onDuplicate={() => {}}
        sampleCounts={[12, 12, 12, 12]}
        kitLabel={kitLabel}
      />
    );
    expect(screen.getAllByText('Vox').length).toBe(1);
    expect(screen.getAllByText('Synth').length).toBe(1);
    expect(screen.getAllByText('Fx').length).toBe(1);
  });
});
