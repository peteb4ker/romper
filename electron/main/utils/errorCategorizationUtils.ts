/**
 * Utilities for categorizing sync errors to reduce duplication
 */

export interface ErrorCategoryRule {
  canRetry: boolean;
  keywords: string[];
  messageTemplate:
    | ((filePath?: string, errorMessage?: string) => string)
    | string;
  type:
    | "disk_space"
    | "file_access"
    | "format_error"
    | "network"
    | "permission"
    | "unknown";
}

export interface SyncErrorInfo {
  canRetry: boolean;
  type:
    | "disk_space"
    | "file_access"
    | "format_error"
    | "network"
    | "permission"
    | "unknown";
  userMessage: string;
}

/**
 * Predefined error categorization rules
 */
export const ERROR_CATEGORIZATION_RULES: ErrorCategoryRule[] = [
  {
    canRetry: false,
    keywords: ["enoent", "file not found"],
    messageTemplate: (filePath) =>
      `Source file not found: ${filePath || "unknown file"}`,
    type: "file_access",
  },
  {
    canRetry: true,
    keywords: ["eacces", "permission denied"],
    messageTemplate: "Permission denied. Check file/folder permissions.",
    type: "permission",
  },
  {
    canRetry: false,
    keywords: ["enospc", "no space"],
    messageTemplate: "Not enough disk space on destination drive.",
    type: "disk_space",
  },
  {
    canRetry: false,
    keywords: ["format", "wav", "audio"],
    messageTemplate: (_, errorMessage) => `Audio format error: ${errorMessage}`,
    type: "format_error",
  },
  {
    canRetry: true,
    keywords: ["network", "connection"],
    messageTemplate: "Network error. Check connection and try again.",
    type: "network",
  },
];

/**
 * Categorizes an error based on predefined rules
 * Eliminates the repetitive if-else pattern in error categorization
 */
export function categorizeErrorByRules(
  errorMessage: string,
  filePath?: string,
): SyncErrorInfo {
  const errorLower = errorMessage.toLowerCase();

  // Check each rule to find a match
  for (const rule of ERROR_CATEGORIZATION_RULES) {
    const matchesKeyword = rule.keywords.some((keyword) =>
      errorLower.includes(keyword),
    );

    if (matchesKeyword) {
      const userMessage =
        typeof rule.messageTemplate === "function"
          ? rule.messageTemplate(filePath, errorMessage)
          : rule.messageTemplate;

      return {
        canRetry: rule.canRetry,
        type: rule.type,
        userMessage,
      };
    }
  }

  // Default fallback for unknown errors
  return {
    canRetry: true,
    type: "unknown",
    userMessage: `Unexpected error: ${errorMessage}`,
  };
}
