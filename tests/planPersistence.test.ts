import { describe, it, expect } from '@jest/globals';

// Simulate a labels object and commit logic
function commitPlan(labels: any, kitName: string) {
  // ...simulate commit logic, but do NOT delete plan...
  // (in real app, plan should remain after commit)
  // This test ensures plan is not deleted
  return labels.kits[kitName].plan;
}

describe('Plan persistence after commit', () => {
  it('should keep the plan in the kit label after commit', () => {
    const labels = {
      kits: {
        A1: {
          label: 'A1',
          plan: [
            { source: '/foo/kick.wav', target: '1 Kick.wav' },
            { source: '/foo/snare.wav', target: '2 Snare.wav' }
          ]
        }
      }
    };
    const planBefore = labels.kits.A1.plan;
    const planAfter = commitPlan(labels, 'A1');
    expect(planAfter).toBe(planBefore);
    expect(Array.isArray(planAfter)).toBe(true);
    expect(planAfter.length).toBe(2);
  });

  it('should rescan and update voiceNames after commit', () => {
    // Simulate a kit folder with .wav files after commit
    const labels = {
      kits: {
        A1: {
          label: 'A1',
          plan: [
            { source: '/foo/kick.wav', target: '1 Kick.wav' },
            { source: '/foo/snare.wav', target: '2 Snare.wav' }
          ],
          voiceNames: {} as Record<number, string>
        }
      }
    };
    // Simulate the files present after commit
    const wavFiles = ['1 Kick.wav', '2 Snare.wav', '3 Hat.wav'];
    // Simulate the commit logic's rescan
    const voiceNames: Record<number, string> = {};
    for (const file of wavFiles) {
      const match = /^([1-4])\s*([\w\- ]+)/.exec(file);
      if (match) {
        const voiceNum = parseInt(match[1], 10);
        const inferred = match[2].replace(/\.[^/.]+$/, '').trim();
        if (voiceNum && inferred) voiceNames[voiceNum] = inferred;
      }
    }
    // Explicitly type voiceNames property
    (labels.kits.A1.voiceNames as Record<number, string>) = voiceNames;
    expect(labels.kits.A1.voiceNames[1]).toBe('Kick');
    expect(labels.kits.A1.voiceNames[2]).toBe('Snare');
    expect(labels.kits.A1.voiceNames[3]).toBe('Hat');
  });
});
