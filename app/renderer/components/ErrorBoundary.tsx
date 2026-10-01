import { WarningCircleIcon } from "@phosphor-icons/react";
import React from "react";

import { createLogger } from "../utils/logger";

const log = createLogger("ErrorBoundary");

interface ErrorBoundaryProps {
  /** Which part of the window this guards, e.g. "Kit editor" */
  area: string;
  /** Label for the extra way out, when there is one */
  backLabel?: string;
  children: React.ReactNode;
  /** An extra way out, e.g. back to the kit list */
  onBack?: () => void;
  /** A failed boundary tries again when this changes (say, another kit) */
  resetKey?: unknown;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Catches an exception thrown while rendering its children, logs it, and
 * shows a way to recover instead of a blank window (RE-12). The rest of the
 * window keeps working.
 */
export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    log.error(
      `${this.props.area} failed to render:`,
      error,
      info.componentStack,
    );
  }

  componentDidUpdate(previous: ErrorBoundaryProps): void {
    if (this.state.error && previous.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render(): React.ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    const { area, backLabel = "Back", onBack } = this.props;
    const buttonClass =
      "px-3 py-1.5 text-xs border border-border-default rounded text-text-secondary hover:bg-surface-3 transition-colors";
    return (
      <div
        className="flex flex-1 items-center justify-center p-8"
        data-testid="error-boundary"
        role="alert"
      >
        <div className="max-w-md w-full p-4 rounded border border-accent-danger/30 bg-accent-danger/10 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-accent-danger">
            <WarningCircleIcon size={16} weight="fill" />
            {area} stopped working
          </div>
          <p className="text-xs text-text-secondary">
            Something went wrong while showing this part of Romper. Your library
            is unchanged. Try again, or reload the window if it keeps happening.
          </p>
          <code className="block text-[11px] text-accent-danger/80 break-all">
            {error.message}
          </code>
          <div className="flex gap-2">
            <button
              className={buttonClass}
              data-testid="error-boundary-retry"
              onClick={() => this.setState({ error: null })}
            >
              Try again
            </button>
            {onBack && (
              <button
                className={buttonClass}
                data-testid="error-boundary-back"
                onClick={() => {
                  this.setState({ error: null });
                  onBack();
                }}
              >
                {backLabel}
              </button>
            )}
            <button
              className={buttonClass}
              data-testid="error-boundary-reload"
              onClick={() => globalThis.location.reload()}
            >
              Reload window
            </button>
          </div>
        </div>
      </div>
    );
  }
}
