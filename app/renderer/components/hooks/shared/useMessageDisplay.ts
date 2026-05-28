import { createLogger } from "../../../utils/logger";

const log = createLogger("message");

export function useMessageDisplay() {
  const showMessage = (
    text: string,
    type: string = "info",
    _duration?: number,
  ) => {
    // Route to structured logger — all user-facing feedback is now handled inline
    if (type === "error") {
      log.error(text);
    } else if (type === "warning") {
      log.warn(text);
    } else {
      log.info(text);
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
