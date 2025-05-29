// Test suite for StatusBar component
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import StatusBar from '../StatusBar';

describe('StatusBar', () => {
  it('renders status bar with default text', () => {
    render(<StatusBar status="Ready" />);
    expect(screen.getByText('Ready')).toBeInTheDocument();
  });

  it('renders status bar with custom text', () => {
    render(<StatusBar status="Loading..." />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });
});
