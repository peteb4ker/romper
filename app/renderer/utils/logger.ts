/**
 * Structured logger utility for Romper renderer process.
 * Replaces ad-hoc console.log statements with level-based logging.
 * SECURITY-03 compliant: no sensitive data in log output.
 */

type LogLevel = "debug" | "error" | "info" | "warn";

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  error: 3,
  info: 1,
  warn: 2,
};

const isDev = process.env.NODE_ENV === "development";
const minLevel: LogLevel = isDev ? "debug" : "info";

export function createLogger(context: string) {
  return {
    debug(message: string, ...args: unknown[]) {
      if (shouldLog("debug")) {
        console.debug(formatMessage(context, message), ...args);
      }
    },
    error(message: string, ...args: unknown[]) {
      if (shouldLog("error")) {
        console.error(formatMessage(context, message), ...args);
      }
    },
    info(message: string, ...args: unknown[]) {
      if (shouldLog("info")) {
        console.info(formatMessage(context, message), ...args);
      }
    },
    warn(message: string, ...args: unknown[]) {
      if (shouldLog("warn")) {
        console.warn(formatMessage(context, message), ...args);
      }
    },
  };
}

function formatMessage(context: string, message: string): string {
  return `[${context}] ${message}`;
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[minLevel];
}
