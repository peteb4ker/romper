// Test suite for KitList component
import React from 'react';
import { render, screen, fireEvent, within, cleanup } from '@testing-library/react';
import { describe, it, vi, expect } from 'vitest';
import KitList from '../KitList';
import './setupTestUtils';

// Helper: get kit item by data-kit attribute
function getKitItem(kit) {
  return screen.getByTestId(`kit-item-${kit}`);
}

// Helper: expect only one kit to be selected/focused
function expectOnlySelected(kits, selectedKit) {
  kits.forEach(k => {
    const el = getKitItem(k);
    if (k === selectedKit) {
      expect(el.getAttribute('aria-selected')).toBe('true');
      expect(el.getAttribute('tabindex')).toBe('0');
    } else {
      expect(el.getAttribute('aria-selected')).toBe('false');
      expect(el.getAttribute('tabindex')).toBe('-1');
    }
  });
}

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
    kits.forEach(kit => {
      expect(getKitItem(kit)).toBeDefined();
    });
    expect(screen.getByText('Bank A')).toBeDefined();
    expect(screen.getByText('Bank B')).toBeDefined();
    expect(screen.getByText('Drums')).toBeDefined();
    expect(screen.getByText('Perc')).toBeDefined();
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
    fireEvent.click(getKitItem('A1'));
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
    // Find the duplicate button inside the kit item
    const kitItem = getKitItem('A1');
    const duplicateBtn = within(kitItem).getByTitle('Duplicate kit');
    fireEvent.click(duplicateBtn);
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
    kits.forEach(kit => {
      const kitItem = getKitItem(kit);
      // For each count, check that the correct number of sample count elements are rendered
      sampleCounts[kit].forEach((count, idx) => {
        // Use title to disambiguate
        const title = `Voice ${idx + 1} samples`;
        const countEls = within(kitItem).getAllByTitle(title);
        expect(countEls).toHaveLength(1);
        expect(countEls[0].textContent).toBe(count.toString());
      });
    });
  });
});

describe('KitList keyboard navigation', () => {
  // Use unique kit names to avoid testID collisions with previous tests
  const kits = ['C1', 'C2', 'D1', 'D2'];
  const kitLabels = { C1: { label: 'Kick' }, C2: { label: 'Snare' }, D1: { label: 'Hat' }, D2: { label: 'Tom' } };
  const bankNames = { C: 'Drums', D: 'Perc' };
  const sampleCounts = { C1: [1, 2, 3, 4], C2: [2, 2, 2, 2], D1: [0, 1, 0, 1], D2: [1, 1, 1, 1] };

  it('ArrowDown moves focus to next kit', () => {
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
    const list = screen.getByLabelText('Kit list');
    list.focus();
    fireEvent.keyDown(list, { key: 'ArrowDown' });
    expectOnlySelected(kits, 'C2');
    fireEvent.keyDown(list, { key: 'ArrowDown' });
    expectOnlySelected(kits, 'D1');
  });

  it('ArrowUp moves focus to previous kit', () => {
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
    const list = screen.getByLabelText('Kit list');
    list.focus();
    fireEvent.keyDown(list, { key: 'ArrowDown' });
    fireEvent.keyDown(list, { key: 'ArrowDown' });
    fireEvent.keyDown(list, { key: 'ArrowUp' });
    expectOnlySelected(kits, 'C2');
  });

  it('A-Z hotkey moves focus to first kit in that bank', () => {
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
    const list = screen.getByLabelText('Kit list');
    list.focus();
    fireEvent.keyDown(list, { key: 'D' });
    expectOnlySelected(kits, 'D1');
  });

  it('Enter selects the focused kit', () => {
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
    const list = screen.getByLabelText('Kit list');
    list.focus();
    fireEvent.keyDown(list, { key: 'ArrowDown' });
    fireEvent.keyDown(list, { key: 'Enter' });
    expect(onSelectKit).toHaveBeenCalledWith('C2');
  });
});

import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
