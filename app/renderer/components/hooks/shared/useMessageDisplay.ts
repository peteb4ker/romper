import { useCallback } from "react";
import { toast } from "sonner";

export function useMessageDisplay() {
  // Sonner handles all state internally; just expose a compatible API
  const showMessage = useCallback(
    (text: string, _type: string = "info", duration?: number) => {
      // Only pass supported options to toast
      return toast(text, { duration });
    },
    [],
  );

  // Dismiss and clearMessages are no-ops since Sonner does not export 'dismiss' API
  const dismissMessage = useCallback(() => {}, []);
  const clearMessages = useCallback(() => {}, []);

  return {
    clearMessages,
    dismissMessage,
    // Sonner does not expose a messages array; UI is handled by <Toaster />
    messages: [],
    showMessage,
  };
}
