import { toast } from 'sonner';

import { MessageType } from '../MessageDisplay';

export function useMessageDisplay() {
  // Sonner handles all state internally; just expose a compatible API
  const showMessage = (text: string, type: MessageType = 'info', duration?: number) => {
    // Sonner supports types: 'info', 'success', 'warning', 'error', 'loading'
    // We'll map our types directly
    return toast(text, {
      type,
      duration,
    });
  };

  // Dismiss and clearMessages are no-ops since Sonner does not export 'dismiss' API
  const dismissMessage = (_id: string) => {};
  const clearMessages = () => {};

  return {
    showMessage,
    dismissMessage,
    clearMessages,
    // Sonner does not expose a messages array; UI is handled by <Toaster />
    messages: [],
  };
}
