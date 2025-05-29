import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react';
import KitPlanEditor from '../src/renderer/components/KitPlanEditor';
import type { KitSamplePlanSlot, VoiceSamples } from '../src/renderer/components/kitTypes';

// Helper to create a mock FileList
function createFileList(files: Array<{ name: string; path: string; type: string }>): FileList {
  return {
    length: files.length,
    item: (i: number) => files[i],
    [Symbol.iterator]: function* () { yield* files; }
  } as unknown as FileList;
}

describe('KitPlanEditor - duplicate file handling', () => {
  const basePlan: KitSamplePlanSlot[] = [];
  const samples: VoiceSamples = { 1: [], 2: [], 3: [], 4: [] };
  const sdCardPath = '/sd';
  const kitName = 'A1';

  function TestWrapper({ planRef, children }: { planRef: React.MutableRefObject<KitSamplePlanSlot[]>; children: (plan: KitSamplePlanSlot[], setPlan: React.Dispatch<React.SetStateAction<KitSamplePlanSlot[]>>) => React.ReactNode }) {
    const [plan, setPlan] = React.useState<KitSamplePlanSlot[]>([]);
    React.useEffect(() => { planRef.current = plan; }, [plan]);
    return <>{children(plan, setPlan)}</>;
  }

  it('allows multiple files with the same name but different paths', async () => {
    const planRef = { current: [] as KitSamplePlanSlot[] };
    const { getAllByText } = render(
      <TestWrapper planRef={planRef}>
        {(plan, setPlan) => (
          <KitPlanEditor
            plan={plan}
            samples={samples}
            sdCardPath={sdCardPath}
            kitName={kitName}
            onSavePlan={setPlan}
            onCommitPlan={() => {}}
            onDiscardPlan={() => {}}
            planActionStatus={null}
          />
        )}
      </TestWrapper>
    );
    const dropZone = getAllByText('Drop .wav file here')[0];
    fireEvent.drop(dropZone, {
      dataTransfer: {
        files: createFileList([
          { name: 'kick.wav', path: '/foo/kick.wav', type: 'audio/wav' }
        ])
      }
    });
    fireEvent.drop(dropZone, {
      dataTransfer: {
        files: createFileList([
          { name: 'kick.wav', path: '/bar/kick.wav', type: 'audio/wav' }
        ])
      }
    });
    await waitFor(() => expect(planRef.current.length).toBe(2));
    expect(planRef.current[0].source).toBe('/foo/kick.wav');
    expect(planRef.current[1].source).toBe('/bar/kick.wav');
  });

  it('ignores duplicate files with the same path', async () => {
    const planRef = { current: [] as KitSamplePlanSlot[] };
    const { getAllByText } = render(
      <TestWrapper planRef={planRef}>
        {(plan, setPlan) => (
          <KitPlanEditor
            plan={plan}
            samples={samples}
            sdCardPath={sdCardPath}
            kitName={kitName}
            onSavePlan={setPlan}
            onCommitPlan={() => {}}
            onDiscardPlan={() => {}}
            planActionStatus={null}
          />
        )}
      </TestWrapper>
    );
    const dropZone = getAllByText('Drop .wav file here')[0];
    fireEvent.drop(dropZone, {
      dataTransfer: {
        files: createFileList([
          { name: 'snare.wav', path: '/foo/snare.wav', type: 'audio/wav' }
        ])
      }
    });
    fireEvent.drop(dropZone, {
      dataTransfer: {
        files: createFileList([
          { name: 'snare.wav', path: '/foo/snare.wav', type: 'audio/wav' }
        ])
      }
    });
    await waitFor(() => expect(planRef.current.length).toBe(1));
    expect(planRef.current[0].source).toBe('/foo/snare.wav');
  });
});
