import fs from 'fs';
import path from 'path';
import { validateKitPlan, rescanVoiceNames, commitKitPlanHandler } from '../src/main/kitPlanOps';

describe('commitKitPlanHandler', () => {
  const tmpDir = path.join(__dirname, 'tmp_kit_test');
  const kitName = 'A1';
  const sdCardPath = tmpDir;
  const kitPath = path.join(tmpDir, kitName);
  const labelsPath = path.join(tmpDir, '.rample_labels.json');

  beforeEach(() => {
    // Clean up and set up test kit dir
    if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
    fs.mkdirSync(tmpDir);
    fs.mkdirSync(kitPath);
    // Write dummy .wav files
    fs.writeFileSync(path.join(kitPath, '1 Kick.wav'), 'dummy');
    fs.writeFileSync(path.join(kitPath, '2 Snare.wav'), 'dummy');
    // Write labels file
    fs.writeFileSync(labelsPath, JSON.stringify({
      kits: {
        [kitName]: {
          label: kitName,
          plan: [
            { source: path.join(__dirname, 'fixtures', 'kick.wav'), target: '1 Kick.wav' },
            { source: path.join(__dirname, 'fixtures', 'snare.wav'), target: '2 Snare.wav' }
          ]
        }
      }
    }, null, 2));
    // Write dummy source files
    fs.writeFileSync(path.join(__dirname, 'fixtures', 'kick.wav'), 'kick');
    fs.writeFileSync(path.join(__dirname, 'fixtures', 'snare.wav'), 'snare');
  });

  afterEach(() => {
    if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('validates a correct plan', () => {
    const plan = [
      { source: '/foo/kick.wav', target: '1 Kick.wav' },
      { source: '/foo/snare.wav', target: '2 Snare.wav' }
    ];
    expect(validateKitPlan(plan)).toEqual([]);
  });

  it('detects duplicate sources in plan', () => {
    const plan = [
      { source: '/foo/kick.wav', target: '1 Kick.wav' },
      { source: '/foo/kick.wav', target: '2 Snare.wav' }
    ];
    expect(validateKitPlan(plan).some((e: string) => e.includes('more than once'))).toBe(true);
  });

  it('rescans voice names from .wav files', () => {
    const names = rescanVoiceNames(kitPath);
    expect(names[1]).toMatch(/Kick/);
    expect(names[2]).toMatch(/Snare/);
  });

  it('commits a plan and writes files', async () => {
    const result = await commitKitPlanHandler(sdCardPath, kitName);
    expect(result.success).toBe(true);
    // Files should exist in kitPath
    expect(fs.existsSync(path.join(kitPath, '1 Kick.wav'))).toBe(true);
    expect(fs.existsSync(path.join(kitPath, '2 Snare.wav'))).toBe(true);
    // Labels should be updated
    const labels = JSON.parse(fs.readFileSync(labelsPath, 'utf-8'));
    expect(labels.kits[kitName].voiceNames[1]).toMatch(/Kick/);
    expect(labels.kits[kitName].voiceNames[2]).toMatch(/Snare/);
  });
});
