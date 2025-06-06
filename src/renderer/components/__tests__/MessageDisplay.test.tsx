import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import MessageDisplay from '../MessageDisplay';
import { toast } from 'sonner';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});

// Helper to wait for a real timeout
function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

describe('MessageDisplay (Sonner Toaster)', () => {
  it('displays a message when toast is called', async () => {
    render(<MessageDisplay />);
    toast('Test message', { type: 'info', duration: 1000 });
    // Wait for the toast to appear
    const el = await screen.findByText('Test message');
    expect(el).toBeTruthy();
  });
});
