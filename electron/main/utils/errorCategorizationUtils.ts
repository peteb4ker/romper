/**
 * Utilities for categorizing sync errors to reduce duplication
 */

export interface ErrorCategoryRule {
  keywords: string[];
  type:
    | "file_access"
    | "format_error"
    | "disk_space"
    | "permission"
    | "network"
    | "unknown";
  canRetry: boolean;
  messageTemplate:
    | string
    | ((filePath?: string, errorMessage?: string) => string);
}

export interface SyncErrorInfo {
  type:
    | "file_access"
    | "format_error"
    | "disk_space"
    | "permission"
    | "network"
    | "unknown";
  canRetry: boolean;
  userMessage: string;
}

/**
 * Predefined error categorization rules
 */
export const ERROR_CATEGORIZATION_RULES: ErrorCategoryRule[] = [
  {
    keywords: ["enoent", "file not found"],
    type: "file_access",
    canRetry: false,
    messageTemplate: (filePath) =>
      `Source file not found: ${filePath || "unknown file"}`,
  },
  {
    keywords: ["eacces", "permission denied"],
    type: "permission",
    canRetry: true,
    messageTemplate: "Permission denied. Check file/folder permissions.",
  },
  {
    keywords: ["enospc", "no space"],
    type: "disk_space",
    canRetry: false,
    messageTemplate: "Not enough disk space on destination drive.",
  },
  {
    keywords: ["format", "wav", "audio"],
    type: "format_error",
    canRetry: false,
    messageTemplate: (_, errorMessage) => `Audio format error: ${errorMessage}`,
  },
  {
    keywords: ["network", "connection"],
    type: "network",
    canRetry: true,
    messageTemplate: "Network error. Check connection and try again.",
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
        type: rule.type,
        canRetry: rule.canRetry,
        userMessage,
      };
    }
  }

  // Default fallback for unknown errors
  return {
    type: "unknown",
    canRetry: true,
    userMessage: `Unexpected error: ${errorMessage}`,
  };
}
