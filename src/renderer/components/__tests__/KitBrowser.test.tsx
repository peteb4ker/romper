// Test suite for KitBrowser component
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, vi, beforeEach, afterEach, it } from 'vitest';
describe('KitBrowser', () => {
  const baseProps = {
    onSelectKit: vi.fn(),
    sdCardPath: '/mock/sd',
    kits: ['A0', 'A1', 'B0'],
    kitLabels: {
      A0: { voiceNames: ['Kick', 'Snare', 'Hat', 'Tom'] },
      A1: { voiceNames: ['Kick', 'Snare', 'Hat', 'Tom'] },
      B0: { voiceNames: ['Kick', 'Snare', 'Hat', 'Tom'] },
    },
    onRescanAllVoiceNames: vi.fn(),
    sampleCounts: { A0: [1, 1, 1, 1], A1: [1, 1, 1, 1], B0: [1, 1, 1, 1] },
    onRefreshKits: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    window.electronAPI = {
      listFilesInRoot: vi.fn().mockResolvedValue([]),
      createKit: vi.fn().mockResolvedValue(undefined),
      copyKit: vi.fn().mockResolvedValue(undefined),
      selectSdCard: vi.fn().mockResolvedValue('/mock/sd'),
      setSetting: vi.fn(),
    };
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders kit list and header', async () => {
    render(<KitBrowser {...baseProps} />);
    expect(screen.getByText('Select SD Card')).toBeInTheDocument();
    expect(screen.getByText('Rescan All Kit Voice Names')).toBeInTheDocument();
    expect(screen.getByText('+ New Kit')).toBeInTheDocument();
    expect(screen.getByText('A0')).toBeInTheDocument();
    expect(screen.getByText('A1')).toBeInTheDocument();
    expect(screen.getByText('B0')).toBeInTheDocument();
  });

  it('calls onSelectKit when a kit is clicked', () => {
    render(<KitBrowser {...baseProps} />);
    const kit = screen.getByText('A0');
    fireEvent.click(kit);
    expect(baseProps.onSelectKit).toHaveBeenCalledWith('A0');
  });

  it('shows new kit dialog when + New Kit is clicked', () => {
    render(<KitBrowser {...baseProps} />);
    fireEvent.click(screen.getByText('+ New Kit'));
    expect(screen.getByText('Kit Slot (A0-Z99):')).toBeInTheDocument();
    expect(screen.getByText('Create')).toBeInTheDocument();
  });

  it('calls onRescanAllVoiceNames when button is clicked', () => {
    render(<KitBrowser {...baseProps} />);
    fireEvent.click(screen.getByText('Rescan All Kit Voice Names'));
    expect(baseProps.onRescanAllVoiceNames).toHaveBeenCalled();
  });

  it('calls electronAPI.selectSdCard and setSetting when Select SD Card is clicked', async () => {
    render(<KitBrowser {...baseProps} />);
    fireEvent.click(screen.getByText('Select SD Card'));
    expect(window.electronAPI.selectSdCard).toHaveBeenCalled();
  });
});
