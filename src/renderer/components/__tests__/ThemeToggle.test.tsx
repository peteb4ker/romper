// Test suite for ThemeToggle component
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ThemeToggle from '../ThemeToggle';

import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});

describe('ThemeToggle', () => {
  it('renders the toggle button', () => {
    render(<ThemeToggle darkMode={false} onToggle={vi.fn()} />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('calls onToggle when clicked', () => {
    const onToggle = vi.fn();
    render(<ThemeToggle darkMode={false} onToggle={onToggle} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onToggle).toHaveBeenCalled();
  });

  it('shows correct icon for dark and light mode', () => {
    const { rerender } = render(<ThemeToggle darkMode={false} onToggle={vi.fn()} />);
    expect(screen.getByTitle(/light|sun|day/i)).toBeInTheDocument();
    rerender(<ThemeToggle darkMode={true} onToggle={vi.fn()} />);
    expect(screen.getByTitle(/dark|moon|night/i)).toBeInTheDocument();
  });
});
