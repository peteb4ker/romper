export function useMessageDisplay() {
  const showMessage = (
    text: string,
    type: string = "info",
    _duration?: number,
  ) => {
    // Route to console — all user-facing feedback is now handled inline
    if (type === "error") {
      console.error(`[message] ${text}`);
    } else if (type === "warning") {
      console.warn(`[message] ${text}`);
    } else {
      console.log(`[message] ${text}`);
    }
  };

  const dismissMessage = () => {};
  const clearMessages = () => {};

  return {
    clearMessages,
    dismissMessage,
    messages: [],
    showMessage,
  };
}
