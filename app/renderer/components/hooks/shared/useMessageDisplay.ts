import { useCallback, useRef, useState } from "react";

import { createLogger } from "../../../utils/logger";

const log = createLogger("message");

export interface DisplayMessage {
  duration: number;
  id: number;
  text: string;
  type: MessageType;
}

export type MessageType = "error" | "info" | "success" | "warning";

// Default auto-dismiss durations by severity (ms). Errors linger longest;
// 0 means "sticky until dismissed".
const DEFAULT_DURATIONS: Record<MessageType, number> = {
  error: 7000,
  info: 4000,
  success: 4000,
  warning: 5000,
};

/**
 * Central user-facing message funnel. Every feature's onMessage callback
 * terminates here; messages are held in state and rendered by the
 * MessageDisplay toast stack, and mirrored to the structured logger for
 * debugging.
 */
export function useMessageDisplay() {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismissMessage = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    setMessages((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const showMessage = useCallback(
    (text: string, type: string = "info", duration?: number) => {
      const messageType: MessageType = isMessageType(type) ? type : "info";

      // Mirror to the structured logger for debugging
      if (messageType === "error") {
        log.error(text);
      } else if (messageType === "warning") {
        log.warn(text);
      } else {
        log.info(text);
      }

      const id = nextId.current++;
      const effectiveDuration = duration ?? DEFAULT_DURATIONS[messageType];
      setMessages((prev) => [
        ...prev,
        { duration: effectiveDuration, id, text, type: messageType },
      ]);

      if (effectiveDuration > 0) {
        timers.current.set(
          id,
          setTimeout(() => dismissMessage(id), effectiveDuration),
        );
      }

      return id;
    },
    [dismissMessage],
  );

  const clearMessages = useCallback(() => {
    timers.current.forEach((timer) => clearTimeout(timer));
    timers.current.clear();
    setMessages([]);
  }, []);

  return {
    clearMessages,
    dismissMessage,
    messages,
    showMessage,
  };
}

function isMessageType(value: string): value is MessageType {
  return (
    value === "error" ||
    value === "info" ||
    value === "success" ||
    value === "warning"
  );
}
