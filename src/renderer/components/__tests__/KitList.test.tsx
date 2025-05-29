// Test suite for KitList component
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import KitList from '../KitList';

describe('KitList', () => {
  const kits = ['A1', 'A2', 'B1'];
  const kitLabels = {
    A1: { label: 'Kick' },
    A2: { label: 'Snare' },
    B1: { label: 'Hat' },
  };
  const bankNames = { A: 'Drums', B: 'Perc' };
  const sampleCounts = { A1: [1, 2, 3, 4], A2: [2, 2, 2, 2], B1: [0, 1, 0, 1] };

  it('renders all kits and bank anchors', () => {
    render(
      <KitList
        kits={kits}
        onSelectKit={vi.fn()}
        bankNames={bankNames}
        onDuplicate={vi.fn()}
        sdCardPath="/sd"
        kitLabels={kitLabels}
        sampleCounts={sampleCounts}
      />
    );
    expect(screen.getByText('A1')).toBeInTheDocument();
    expect(screen.getByText('A2')).toBeInTheDocument();
    expect(screen.getByText('B1')).toBeInTheDocument();
    expect(screen.getByText('Bank A')).toBeInTheDocument();
    expect(screen.getByText('Bank B')).toBeInTheDocument();
    expect(screen.getByText('Drums')).toBeInTheDocument();
    expect(screen.getByText('Perc')).toBeInTheDocument();
  });

  it('calls onSelectKit when a valid kit is clicked', () => {
    const onSelectKit = vi.fn();
    render(
      <KitList
        kits={kits}
        onSelectKit={onSelectKit}
        bankNames={bankNames}
        onDuplicate={vi.fn()}
        sdCardPath="/sd"
        kitLabels={kitLabels}
        sampleCounts={sampleCounts}
      />
    );
    fireEvent.click(screen.getByText('A1'));
    expect(onSelectKit).toHaveBeenCalledWith('A1');
  });

  it('calls onDuplicate when duplicate button is clicked', () => {
    const onDuplicate = vi.fn();
    render(
      <KitList
        kits={kits}
        onSelectKit={vi.fn()}
        bankNames={bankNames}
        onDuplicate={onDuplicate}
        sdCardPath="/sd"
        kitLabels={kitLabels}
        sampleCounts={sampleCounts}
      />
    );
    fireEvent.click(screen.getAllByTitle('Duplicate kit')[0]);
    expect(onDuplicate).toHaveBeenCalled();
  });

  it('renders sample counts for each kit', () => {
    render(
      <KitList
        kits={kits}
        onSelectKit={vi.fn()}
        bankNames={bankNames}
        onDuplicate={vi.fn()}
        sdCardPath="/sd"
        kitLabels={kitLabels}
        sampleCounts={sampleCounts}
      />
    );
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
  });
});
