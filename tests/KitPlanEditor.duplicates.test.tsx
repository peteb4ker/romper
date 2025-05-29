import React from 'react';
import { render } from '@testing-library/react';
import KitPlanEditor from '../src/renderer/components/KitPlanEditor';
import type { KitSamplePlanSlot, VoiceSamples } from '../src/renderer/components/kitTypes';

describe('KitPlanEditor - duplicate sample highlighting', () => {
  const samples: VoiceSamples = { 1: [], 2: [], 3: [], 4: [] };
  const sdCardPath = '/sd';
  const kitName = 'A1';

  it('highlights all plan slots with duplicate source paths', () => {
    const plan: KitSamplePlanSlot[] = [
      { source: '/foo/snare.wav', target: '1Snare.wav', voiceType: 'Snare', voice: 1 },
      { source: '/foo/snare.wav', target: '2Snare.wav', voiceType: 'Snare', voice: 2 },
      { source: '/foo/kick.wav', target: '3Kick.wav', voiceType: 'Kick', voice: 3 },
      { source: '/foo/snare.wav', target: '4Snare.wav', voiceType: 'Snare', voice: 4 },
    ];
    const { container } = render(
      <KitPlanEditor
        plan={plan}
        samples={samples}
        sdCardPath={sdCardPath}
        kitName={kitName}
        onSavePlan={() => {}}
        onCommitPlan={() => {}}
        onDiscardPlan={() => {}}
        planActionStatus={null}
      />
    );
    // All three snare slots should be highlighted
    const highlighted = container.querySelectorAll('.draggable-plan-slot.bg-red-200');
    expect(highlighted.length).toBe(3);
    // The kick slot should not be highlighted
    const kick = Array.from(container.querySelectorAll('.draggable-plan-slot')).find(
      el => el.textContent && el.textContent.includes('Kick')
    );
    expect(kick?.className).not.toMatch(/bg-red-200/);
  });
});
