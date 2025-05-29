import React from 'react';
import { render, screen } from '@testing-library/react';
import KitItem from '../src/renderer/components/KitItem';

describe('KitItem unique voice labels', () => {
  it('shows only unique, non-empty voice labels', () => {
    const kitLabel = {
      voiceNames: {
        1: 'Loop',
        2: 'Loop',
        3: 'Kick',
        4: 'Loop',
      }
    };
    render(
      <KitItem
        kit="A1"
        colorClass=""
        isValid={true}
        onSelect={() => {}}
        onDuplicate={() => {}}
        sampleCounts={[12, 12, 12, 12]}
        kitLabel={kitLabel}
      />
    );
    // Only one 'Loop' and one 'Kick' should be present
    const loopLabels = screen.getAllByText('Loop');
    expect(loopLabels.length).toBe(1);
    const kickLabels = screen.getAllByText('Kick');
    expect(kickLabels.length).toBe(1);
  });
});
