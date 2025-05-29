// Test suite for KitsView component
import { describe } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import KitsView from '../KitsView';

describe('KitsView', () => {
  beforeEach(() => {
    window.electronAPI = {
      scanSdCard: vi.fn().mockResolvedValue(['A0', 'A1']),
      listFilesInRoot: vi.fn().mockResolvedValue(['1 Kick.wav', '2 Snare.wav', '3 Hat.wav', '4 Tom.wav']),
      readRampleLabels: vi.fn().mockResolvedValue({ kits: { A0: { label: 'A0', voiceNames: {} }, A1: { label: 'A1', voiceNames: {} } } }),
    };
  });
  it('renders KitBrowser with kits', async () => {
    render(<KitsView />);
    expect(await screen.findByText('A0')).toBeInTheDocument();
    expect(await screen.findByText('A1')).toBeInTheDocument();
  });
  it('shows KitDetails when a kit is selected', async () => {
    render(<KitsView />);
    fireEvent.click(await screen.findByText('A0'));
    expect(await screen.findByText('Kick')).toBeInTheDocument();
    expect(await screen.findByText('Snare')).toBeInTheDocument();
    expect(await screen.findByText('Hat')).toBeInTheDocument();
    expect(await screen.findByText('Tom')).toBeInTheDocument();
  });
  it('returns to KitBrowser when back is clicked in KitDetails', async () => {
    render(<KitsView />);
    fireEvent.click(await screen.findByText('A0'));
    expect(await screen.findByText('Kick')).toBeInTheDocument();
    fireEvent.click(screen.getByText(/Back/));
    expect(await screen.findByText('A1')).toBeInTheDocument();
  });
  describe('KitDetails back navigation scrolls KitBrowser to kit', () => {
    beforeEach(() => {
      window.HTMLElement.prototype.scrollIntoView = vi.fn();
      window.electronAPI = {
        scanSdCard: vi.fn().mockResolvedValue(['KitA', 'KitB']),
        listFilesInRoot: vi.fn().mockResolvedValue(['1 Kick.wav', '2 Snare.wav', '3 Hat.wav', '4 Tom.wav']),
        readRampleLabels: vi.fn().mockResolvedValue({ kits: { KitA: { label: 'KitA', voiceNames: {} }, KitB: { label: 'KitB', voiceNames: {} } } }),
      };
    });
    it('scrolls the kit browser to the selected kit when returning from KitDetails', async () => {
      render(<KitsView />);
      await screen.findByText('KitB');
      fireEvent.click(screen.getByText('KitB'));
      await screen.findByText('Duplicate kit');
      fireEvent.click(screen.getByTitle('Back'));
      await waitFor(() => {
        expect(window.HTMLElement.prototype.scrollIntoView).toHaveBeenCalled();
      });
    });
  });
});
