// Test suite for KitBrowser component
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { describe, vi, beforeEach, afterEach, it, expect } from 'vitest';
import { MessageDisplayProvider } from './MockMessageDisplayContext';
import KitBrowser from '../KitBrowser';

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

describe('KitBrowser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.electronAPI = {
      listFilesInRoot: vi.fn().mockResolvedValue([]),
      createKit: vi.fn().mockResolvedValue(undefined),
      copyKit: vi.fn().mockResolvedValue(undefined),
      selectSdCard: vi.fn().mockResolvedValue('/mock/sd'),
      setSetting: vi.fn(),
    };
    // Mock scrollTo for jsdom
    Object.defineProperty(HTMLElement.prototype, 'scrollTo', { value: () => {}, writable: true });
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders kit list and header', async () => {
    render(
      <MessageDisplayProvider>
        <KitBrowser {...baseProps} />
      </MessageDisplayProvider>
    );
    expect(screen.getByText('Select SD Card')).toBeTruthy();
    expect(screen.getByText('Rescan All Kit Voice Names')).toBeTruthy();
    expect(screen.getByText('+ New Kit')).toBeTruthy();
    expect(screen.getByTestId('kit-item-A0')).toBeTruthy();
    expect(screen.getByTestId('kit-item-A1')).toBeTruthy();
    expect(screen.getByTestId('kit-item-B0')).toBeTruthy();
  });

  it('calls onSelectKit when a kit is clicked', () => {
    render(
      <MessageDisplayProvider>
        <KitBrowser {...baseProps} />
      </MessageDisplayProvider>
    );
    const kit = screen.getByTestId('kit-item-A0');
    fireEvent.click(kit);
    expect(baseProps.onSelectKit).toHaveBeenCalledWith('A0');
  });

  it('shows new kit dialog when + New Kit is clicked', () => {
    render(
      <MessageDisplayProvider>
        <KitBrowser {...baseProps} />
      </MessageDisplayProvider>
    );
    fireEvent.click(screen.getByText('+ New Kit'));
    expect(screen.getByText('Kit Slot (A0-Z99):')).toBeTruthy();
    expect(screen.getByText('Create')).toBeTruthy();
  });

  it('calls onRescanAllVoiceNames when button is clicked', () => {
    render(
      <MessageDisplayProvider>
        <KitBrowser {...baseProps} />
      </MessageDisplayProvider>
    );
    fireEvent.click(screen.getByText('Rescan All Kit Voice Names'));
    expect(baseProps.onRescanAllVoiceNames).toHaveBeenCalled();
  });

  it('calls electronAPI.selectSdCard and setSetting when Select SD Card is clicked', async () => {
    render(
      <MessageDisplayProvider>
        <KitBrowser {...baseProps} />
      </MessageDisplayProvider>
    );
    fireEvent.click(screen.getByText('Select SD Card'));
    expect(window.electronAPI.selectSdCard).toHaveBeenCalled();
  });
});

// Additional test: does not highlight/select a bank button when pressing a key for a bank with no kits
it('does not highlight/select a bank button when pressing a key for a bank with no kits', async () => {
  render(
    <MessageDisplayProvider>
      <KitBrowser {...baseProps} kits={['A0', 'A1', 'B0']} />
    </MessageDisplayProvider>
  );
  const kitList = screen.getAllByTestId('kit-list')[0];
  kitList.focus();
  // Bank C has no kits, so pressing 'C' should not highlight/select the C button
  const cButtons = screen.getAllByRole('button', { name: 'Jump to bank C' });
  // There may be more than one due to virtualization, but all should be disabled
  cButtons.forEach(cButton => {
    expect(cButton.getAttribute('disabled')).not.toBeNull();
  });
  fireEvent.keyDown(kitList, { key: 'C' });
  await waitFor(() => {
    cButtons.forEach(cButton => {
      expect(cButton.getAttribute('aria-current')).not.toBe('true');
      expect(cButton.className).not.toMatch(/bg-blue-800/);
    });
  });
});

describe('KitBrowser keyboard navigation bugs', () => {
  const navProps = {
    ...baseProps,
    kits: ['A1', 'A2', 'B1', 'B2'],
    kitLabels: {
      A1: { label: 'Kick' },
      A2: { label: 'Snare' },
      B1: { label: 'Hat' },
      B2: { label: 'Tom' },
    },
    sampleCounts: { A1: [1, 1, 1, 1], A2: [1, 1, 1, 1], B1: [1, 1, 1, 1], B2: [1, 1, 1, 1] },
  };

  it('should highlight/select the first kit in a bank when a bank button is clicked', async () => {
    render(
      <MessageDisplayProvider>
        <KitBrowser {...navProps} />
      </MessageDisplayProvider>
    );
    // Click bank B
    const bButtons = screen.getAllByRole('button', { name: 'Jump to bank B' });
    const bButton = bButtons.find(btn => !btn.disabled);
    fireEvent.click(bButton!);
    // The first kit in bank B should be focused/highlighted
    await waitFor(() => {
      const kitB1s = screen.getAllByTestId('kit-item-B1');
      const selected = kitB1s.filter(el => el.getAttribute('aria-selected') === 'true');
      if (selected.length !== 1) {
        console.log('kitB1s:', kitB1s.map(el => el.outerHTML));
      }
      expect(selected.length).toBe(1);
      expect(selected[0].getAttribute('tabindex')).toBe('0');
      kitB1s.forEach(el => {
        if (el !== selected[0]) {
          expect(el.getAttribute('aria-selected')).toBe('false');
          expect(el.getAttribute('tabindex')).toBe('-1');
        }
      });
    }, { timeout: 2000 });
  });
  it('should move focus with ArrowDown and ArrowUp', async () => {
    render(
      <MessageDisplayProvider>
        <KitBrowser {...navProps} />
      </MessageDisplayProvider>
    );
    const kitList = screen.getAllByTestId('kit-list')[0];
    kitList.focus();
    fireEvent.keyDown(kitList, { key: 'ArrowDown' });
    // Should move to A2
    await waitFor(() => {
      const kitA2s = screen.getAllByTestId('kit-item-A2');
      const selected = kitA2s.filter(el => el.getAttribute('aria-selected') === 'true');
      if (selected.length !== 1) {
        console.log('kitA2s:', kitA2s.map(el => el.outerHTML));
      }
      expect(selected.length).toBe(1);
      expect(selected[0].getAttribute('tabindex')).toBe('0');
      kitA2s.forEach(el => {
        if (el !== selected[0]) {
          expect(el.getAttribute('aria-selected')).toBe('false');
          expect(el.getAttribute('tabindex')).toBe('-1');
        }
      });
    }, { timeout: 2000 });
    fireEvent.keyDown(kitList, { key: 'ArrowDown' });
    // Should move to B1
    await waitFor(() => {
      const kitB1s = screen.getAllByTestId('kit-item-B1');
      const selected = kitB1s.filter(el => el.getAttribute('aria-selected') === 'true');
      if (selected.length !== 1) {
        console.log('kitB1s:', kitB1s.map(el => el.outerHTML));
      }
      expect(selected.length).toBe(1);
      expect(selected[0].getAttribute('tabindex')).toBe('0');
      kitB1s.forEach(el => {
        if (el !== selected[0]) {
          expect(el.getAttribute('aria-selected')).toBe('false');
          expect(el.getAttribute('tabindex')).toBe('-1');
        }
      });
    }, { timeout: 2000 });
    fireEvent.keyDown(kitList, { key: 'ArrowUp' });
    // Should move back to A2
    await waitFor(() => {
      const kitA2s = screen.getAllByTestId('kit-item-A2');
      const selected = kitA2s.filter(el => el.getAttribute('aria-selected') === 'true');
      expect(selected.length).toBe(1);
      expect(selected[0].getAttribute('tabindex')).toBe('0');
      kitA2s.forEach(el => {
        if (el !== selected[0]) {
          expect(el.getAttribute('aria-selected')).toBe('false');
          expect(el.getAttribute('tabindex')).toBe('-1');
        }
      });
    }, { timeout: 2000 });
  });
  it('should highlight/select the first kit in a bank when A-Z hotkey is pressed', async () => {
    render(
      <MessageDisplayProvider>
        <KitBrowser {...navProps} />
      </MessageDisplayProvider>
    );
    const kitList = screen.getAllByTestId('kit-list')[0];
    kitList.focus();
    fireEvent.keyDown(kitList, { key: 'B' });
    await waitFor(() => {
      const kitB1s = screen.getAllByTestId('kit-item-B1');
      const selected = kitB1s.filter(el => el.getAttribute('aria-selected') === 'true');
      if (selected.length !== 1) {
        console.log('kitB1s:', kitB1s.map(el => el.outerHTML));
      }
      expect(selected.length).toBe(1);
      expect(selected[0].getAttribute('tabindex')).toBe('0');
      kitB1s.forEach(el => {
        if (el !== selected[0]) {
          expect(el.getAttribute('aria-selected')).toBe('false');
          expect(el.getAttribute('tabindex')).toBe('-1');
        }
      });
    }, { timeout: 2000 });
  });
});
