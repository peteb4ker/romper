// Test suite for StatusBar component
import { render, screen } from '@testing-library/react';
import { cleanup } from '@testing-library/react';
import React from 'react';
import { beforeEach,describe, expect, it, vi } from 'vitest';
import { afterEach } from 'vitest';

import StatusBar from '../StatusBar';

afterEach(() => {
  cleanup();
});

// Mock useSettings to provide stable test values
vi.mock('../../utils/SettingsContext', () => ({
  useSettings: () => ({
    sdCardPath: '/mock/sd',
    darkMode: false,
    setDarkMode: vi.fn(),
  }),
}));

describe('StatusBar', () => {
  beforeEach(() => {
    // Clear mocks if needed
  });

  it('renders status bar with default status', () => {
    render(<StatusBar />);
    const statusNodes = screen.getAllByTestId('status-text');
    expect(statusNodes[statusNodes.length - 1].textContent).toContain('Ready');
  });

  it('renders status bar with custom status', () => {
    render(<StatusBar status="Loading..." />);
    const statusNodes = screen.getAllByTestId('status-text');
    expect(statusNodes[statusNodes.length - 1].textContent).toContain('Loading...');
  });

  it('renders a progress bar when progress is provided', () => {
    render(<StatusBar status="Syncing..." progress={42} />);
    const progressBar = screen.getByTestId('progress-bar');
    expect(progressBar).toBeTruthy();
    // The inner div should have width 42%
    const innerDiv = progressBar.querySelector('div');
    expect(innerDiv).not.toBeNull();
    expect(innerDiv?.style.width).toBe('42%');
  });

  it('renders a manual link to the Squarp Rample manual', () => {
    render(<StatusBar />);
    const manualLink = screen.getByRole('link', { name: /rample manual/i });
    expect(manualLink).toBeInTheDocument();
    expect(manualLink).toHaveAttribute('href', 'https://squarp.net/rample/manual/');
    expect(manualLink).toHaveAttribute('target', '_blank');
    expect(manualLink).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });
});
