import fs from 'fs';
import path from 'path';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readRampleLabels, writeRampleLabels, RampleLabels } from '../rampleLabels';

const tmpDir = path.join(__dirname, 'tmp_labels_test');
const labelsPath = path.join(tmpDir, '.rample_labels.json');

const sampleLabels: RampleLabels = {
  kits: {
    A1: { label: 'A1', plan: [], voiceNames: { 1: 'Kick', 2: 'Snare' } },
    B2: { label: 'B2', plan: [], voiceNames: { 1: 'Hat' } }
  }
};

describe('rampleLabels', () => {
  beforeEach(() => {
    if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
    fs.mkdirSync(tmpDir);
  });
  afterEach(() => {
    if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('writes and reads labels correctly', () => {
    writeRampleLabels(tmpDir, sampleLabels);
    const read = readRampleLabels(tmpDir);
    expect(read).toEqual(sampleLabels);
  });

  it('returns null if file does not exist', () => {
    expect(readRampleLabels(tmpDir)).toBeNull();
  });

  it('returns null for invalid JSON', () => {
    fs.writeFileSync(labelsPath, '{not json}', 'utf-8');
    expect(readRampleLabels(tmpDir)).toBeNull();
  });

  it('returns null for missing kits property', () => {
    fs.writeFileSync(labelsPath, JSON.stringify({ foo: 'bar' }), 'utf-8');
    expect(readRampleLabels(tmpDir)).toBeNull();
  });

  it('returns null for kits property not an object', () => {
    fs.writeFileSync(labelsPath, JSON.stringify({ kits: 123 }), 'utf-8');
    expect(readRampleLabels(tmpDir)).toBeNull();
  });

  it('returns null for kit entry not an object', () => {
    fs.writeFileSync(labelsPath, JSON.stringify({ kits: { A1: null } }), 'utf-8');
    expect(readRampleLabels(tmpDir)).toBeNull();
  });

  it('overwrites existing file when writing', () => {
    fs.writeFileSync(labelsPath, '{"foo": "bar"}', 'utf-8');
    writeRampleLabels(tmpDir, sampleLabels);
    const read = readRampleLabels(tmpDir);
    expect(read).toEqual(sampleLabels);
  });
});
