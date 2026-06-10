import {
  CheckCircleIcon,
  InfoIcon,
  WarningCircleIcon,
  WarningIcon,
  XIcon,
} from "@phosphor-icons/react";
import React, { useContext } from "react";

import type {
  DisplayMessage,
  MessageType,
} from "./hooks/shared/useMessageDisplay";

import { MessageDisplayContext } from "./MessageDisplayContext";

const TYPE_STYLES: Record<
  MessageType,
  { className: string; icon: React.ReactNode }
> = {
  error: {
    className: "bg-accent-danger/10 border-accent-danger text-accent-danger",
    icon: <WarningCircleIcon size={16} weight="fill" />,
  },
  info: {
    className: "bg-surface-2 border-border-default text-text-primary",
    icon: <InfoIcon size={16} weight="fill" />,
  },
  success: {
    className: "bg-accent-success/10 border-accent-success text-accent-success",
    icon: <CheckCircleIcon size={16} weight="fill" />,
  },
  warning: {
    className: "bg-accent-warning/10 border-accent-warning text-accent-warning",
    icon: <WarningIcon size={16} weight="fill" />,
  },
};

const MessageToast: React.FC<{
  message: DisplayMessage;
  onDismiss: (id: number) => void;
}> = ({ message, onDismiss }) => {
  const style = TYPE_STYLES[message.type];
  return (
    <div
      className={`flex items-start gap-2 px-3 py-2 rounded-md border shadow-sm text-sm pointer-events-auto ${style.className}`}
      data-testid={`message-${message.type}`}
      role={message.type === "error" ? "alert" : "status"}
    >
      <span className="flex-shrink-0 mt-0.5">{style.icon}</span>
      <span className="flex-1 break-words">{message.text}</span>
      <button
        aria-label="Dismiss message"
        className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity"
        onClick={() => onDismiss(message.id)}
      >
        <XIcon size={14} />
      </button>
    </div>
  );
};

/**
 * Renders the central message funnel's toast stack (top-right). Reads from
 * MessageDisplayContext; renders nothing when there are no active messages.
 */
const MessageDisplay: React.FC = () => {
  const ctx = useContext(MessageDisplayContext);
  if (!ctx || ctx.messages.length === 0) return null;

  return (
    <div
      className="fixed top-3 right-3 z-50 flex flex-col gap-2 w-80 max-w-[90vw] pointer-events-none"
      data-testid="message-display"
    >
      {ctx.messages.map((message) => (
        <MessageToast
          key={message.id}
          message={message}
          onDismiss={ctx.dismissMessage}
        />
      ))}
    </div>
  );
};

export default MessageDisplay;
