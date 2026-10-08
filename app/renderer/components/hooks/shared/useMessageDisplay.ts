import { useCallback, useRef, useState } from "react";

import { createLogger } from "../../../utils/logger";
import { useTimeouts } from "./useTimeouts";

const log = createLogger("message");

export interface DisplayMessage {
  duration: number;
  id: number;
  text: string;
  type: MessageType;
}

export type MessageType = "error" | "info" | "success" | "warning";

// What makes two messages identical (#657).
type MessageKey = Pick<DisplayMessage, "text" | "type">;

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
 *
 * It owns the app's message state, so it's called once, by the provider in
 * main.tsx. Components read it with `useMessageApi()`: a second call here
 * makes a separate stack that nothing renders (RE-11).
 */
export function useMessageDisplay() {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const nextId = useRef(1);
  // Each message's dismiss timer, by message ID. They're all cleared if the
  // provider unmounts.
  const timeouts = useTimeouts();
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  // The messages showing now, by ID. It changes as soon as a message is shown
  // or dismissed, so two identical messages raised in the same tick (before
  // `messages` updates) are still caught as duplicates (#657).
  const showing = useRef(new Map<number, MessageKey>());

  const dismissMessage = useCallback(
    (id: number) => {
      timeouts.clear(timers.current.get(id) ?? null);
      timers.current.delete(id);
      showing.current.delete(id);
      setMessages((prev) => prev.filter((m) => m.id !== id));
    },
    [timeouts],
  );

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

      // An identical message (same text and type) that's already showing
      // appears once (#657), and the caller gets the showing message's ID. The
      // duplicate doesn't restart its dismiss timer: it goes when the first
      // one would have.
      const duplicateId = findShowing(showing.current, text, messageType);
      if (duplicateId !== null) return duplicateId;

      const id = nextId.current++;
      showing.current.set(id, { text, type: messageType });
      const effectiveDuration = duration ?? DEFAULT_DURATIONS[messageType];
      setMessages((prev) => [
        ...prev,
        { duration: effectiveDuration, id, text, type: messageType },
      ]);

      if (effectiveDuration > 0) {
        const timer = timeouts.set(() => dismissMessage(id), effectiveDuration);
        if (timer !== null) timers.current.set(id, timer);
      }

      return id;
    },
    [dismissMessage, timeouts],
  );

  const clearMessages = useCallback(() => {
    timers.current.forEach((timer) => timeouts.clear(timer));
    timers.current.clear();
    showing.current.clear();
    setMessages([]);
  }, [timeouts]);

  return {
    clearMessages,
    dismissMessage,
    messages,
    showMessage,
  };
}

function findShowing(
  showing: Map<number, MessageKey>,
  text: string,
  type: MessageType,
): null | number {
  for (const [id, message] of showing) {
    if (message.text === text && message.type === type) return id;
  }
  return null;
}

function isMessageType(value: string): value is MessageType {
  return (
    value === "error" ||
    value === "info" ||
    value === "success" ||
    value === "warning"
  );
}
