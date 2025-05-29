// Test suite for AboutView component
import { describe } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AboutView from '../AboutView';

describe('AboutView', () => {
  beforeEach(() => {
    window.electronAPI = { openExternal: vi.fn() };
  });
  it('renders app name, version, and MIT license', () => {
    render(<AboutView />);
    expect(screen.getByText('Romper')).toBeInTheDocument();
    expect(screen.getByText(/Version:/)).toBeInTheDocument();
    expect(screen.getByText(/MIT license/)).toBeInTheDocument();
  });
  it('calls openExternal when GitHub button is clicked', () => {
    render(<AboutView />);
    const githubBtn = screen.getByText(/github.com\/peteb4ker\/romper/);
    fireEvent.click(githubBtn);
    expect(window.electronAPI.openExternal).toHaveBeenCalledWith('https://github.com/peteb4ker/romper/');
  });
  it('navigates back when Back button is clicked', () => {
    const assign = vi.fn();
    const back = vi.fn();
    Object.defineProperty(window, 'history', { value: { length: 0, back }, configurable: true });
    Object.defineProperty(window.location, 'assign', { value: assign, configurable: true });
    render(<AboutView />);
    fireEvent.click(screen.getByText('← Back'));
    expect(assign).toHaveBeenCalledWith('/kits');
  });
});
