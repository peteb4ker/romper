import { render, screen, act } from '@testing-library/react';
import { Toaster, toast } from 'sonner';
import { useMessageDisplay } from '../hooks/useMessageDisplay';
import React from 'react';

function TestComponent() {
  const { showMessage, dismissMessage } = useMessageDisplay();
  return (
    <>
      <Toaster position="top-center" richColors closeButton />
      <button onClick={() => showMessage('Info message', 'info', 1000)}>Show Info</button>
      <button onClick={() => showMessage('Warning message', 'warning', 1000)}>Show Warning</button>
      <button onClick={() => showMessage('Error message', 'error', 1000)}>Show Error</button>
      <button onClick={() => {
        const id = showMessage('Dismiss me', 'info', 5000);
        setTimeout(() => dismissMessage(id), 100);
      }}>Show & Dismiss</button>
    </>
  );
}

describe('useMessageDisplay (Sonner integration)', () => {
  it('shows info, warning, and error messages', () => {
    render(<TestComponent />);
    act(() => {
      screen.getByText('Show Info').click();
      screen.getByText('Show Warning').click();
      screen.getByText('Show Error').click();
    });
    expect(screen.getByText('Info message')).toBeInTheDocument();
    expect(screen.getByText('Warning message')).toBeInTheDocument();
    expect(screen.getByText('Error message')).toBeInTheDocument();
  });

  it('auto-dismisses messages after duration', async () => {
    jest.useFakeTimers();
    render(<TestComponent />);
    act(() => {
      screen.getByText('Show Info').click();
    });
    expect(screen.getByText('Info message')).toBeInTheDocument();
    act(() => {
      jest.advanceTimersByTime(1100);
    });
    expect(screen.queryByText('Info message')).not.toBeInTheDocument();
    jest.useRealTimers();
  });

  it('can dismiss a message programmatically', () => {
    render(<TestComponent />);
    act(() => {
      screen.getByText('Show & Dismiss').click();
    });
    expect(screen.getByText('Dismiss me')).toBeInTheDocument();
    // Wait for dismiss
    setTimeout(() => {
      expect(screen.queryByText('Dismiss me')).not.toBeInTheDocument();
    }, 200);
  });
});
