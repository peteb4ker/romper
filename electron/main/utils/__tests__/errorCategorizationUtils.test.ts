import { describe, expect, it } from "vitest";

import {
  categorizeErrorByRules,
  ERROR_CATEGORIZATION_RULES,
  type ErrorCategoryRule,
} from "../errorCategorizationUtils";

describe("errorCategorizationUtils", () => {
  describe("ERROR_CATEGORIZATION_RULES", () => {
    it("should contain predefined error rules", () => {
      expect(ERROR_CATEGORIZATION_RULES).toHaveLength(5);
      expect(ERROR_CATEGORIZATION_RULES[0].type).toBe("file_access");
      expect(ERROR_CATEGORIZATION_RULES[1].type).toBe("permission");
      expect(ERROR_CATEGORIZATION_RULES[2].type).toBe("disk_space");
      expect(ERROR_CATEGORIZATION_RULES[3].type).toBe("format_error");
      expect(ERROR_CATEGORIZATION_RULES[4].type).toBe("network");
    });

    it("should have correct structure for each rule", () => {
      ERROR_CATEGORIZATION_RULES.forEach((rule: ErrorCategoryRule) => {
        expect(rule).toHaveProperty("canRetry");
        expect(rule).toHaveProperty("keywords");
        expect(rule).toHaveProperty("messageTemplate");
        expect(rule).toHaveProperty("type");
        expect(typeof rule.canRetry).toBe("boolean");
        expect(Array.isArray(rule.keywords)).toBe(true);
        expect(rule.keywords.length).toBeGreaterThan(0);
        expect(typeof rule.messageTemplate).toMatch(/string|function/);
        expect(typeof rule.type).toBe("string");
      });
    });

    it("should have file_access rule with correct properties", () => {
      const fileAccessRule = ERROR_CATEGORIZATION_RULES.find(
        (rule) => rule.type === "file_access"
      );
      expect(fileAccessRule).toBeDefined();
      expect(fileAccessRule!.canRetry).toBe(false);
      expect(fileAccessRule!.keywords).toEqual(["enoent", "file not found"]);
      expect(typeof fileAccessRule!.messageTemplate).toBe("function");
    });

    it("should have permission rule with correct properties", () => {
      const permissionRule = ERROR_CATEGORIZATION_RULES.find(
        (rule) => rule.type === "permission"
      );
      expect(permissionRule).toBeDefined();
      expect(permissionRule!.canRetry).toBe(true);
      expect(permissionRule!.keywords).toEqual(["eacces", "permission denied"]);
      expect(permissionRule!.messageTemplate).toBe(
        "Permission denied. Check file/folder permissions."
      );
    });

    it("should have disk_space rule with correct properties", () => {
      const diskSpaceRule = ERROR_CATEGORIZATION_RULES.find(
        (rule) => rule.type === "disk_space"
      );
      expect(diskSpaceRule).toBeDefined();
      expect(diskSpaceRule!.canRetry).toBe(false);
      expect(diskSpaceRule!.keywords).toEqual(["enospc", "no space"]);
      expect(diskSpaceRule!.messageTemplate).toBe(
        "Not enough disk space on destination drive."
      );
    });

    it("should have format_error rule with correct properties", () => {
      const formatErrorRule = ERROR_CATEGORIZATION_RULES.find(
        (rule) => rule.type === "format_error"
      );
      expect(formatErrorRule).toBeDefined();
      expect(formatErrorRule!.canRetry).toBe(false);
      expect(formatErrorRule!.keywords).toEqual(["format", "wav", "audio"]);
      expect(typeof formatErrorRule!.messageTemplate).toBe("function");
    });

    it("should have network rule with correct properties", () => {
      const networkRule = ERROR_CATEGORIZATION_RULES.find(
        (rule) => rule.type === "network"
      );
      expect(networkRule).toBeDefined();
      expect(networkRule!.canRetry).toBe(true);
      expect(networkRule!.keywords).toEqual(["network", "connection"]);
      expect(networkRule!.messageTemplate).toBe(
        "Network error. Check connection and try again."
      );
    });
  });

  describe("categorizeErrorByRules", () => {
    describe("file_access errors", () => {
      it("should categorize ENOENT error", () => {
        const result = categorizeErrorByRules(
          "ENOENT: file not found",
          "/path/to/file.wav"
        );

        expect(result.type).toBe("file_access");
        expect(result.canRetry).toBe(false);
        expect(result.userMessage).toBe(
          "Source file not found: /path/to/file.wav"
        );
      });

      it("should categorize file not found error", () => {
        const result = categorizeErrorByRules("File not found: sample.wav");

        expect(result.type).toBe("file_access");
        expect(result.canRetry).toBe(false);
        expect(result.userMessage).toBe("Source file not found: unknown file");
      });

      it("should handle case insensitive matching", () => {
        const result = categorizeErrorByRules("FILE NOT FOUND");

        expect(result.type).toBe("file_access");
        expect(result.canRetry).toBe(false);
      });

      it("should use provided file path in message", () => {
        const filePath = "/home/user/samples/kick.wav";
        const result = categorizeErrorByRules("enoent error", filePath);

        expect(result.userMessage).toBe(`Source file not found: ${filePath}`);
      });
    });

    describe("permission errors", () => {
      it("should categorize EACCES error", () => {
        const result = categorizeErrorByRules("EACCES: permission denied");

        expect(result.type).toBe("permission");
        expect(result.canRetry).toBe(true);
        expect(result.userMessage).toBe(
          "Permission denied. Check file/folder permissions."
        );
      });

      it("should categorize permission denied error", () => {
        const result = categorizeErrorByRules(
          "Permission denied to access file"
        );

        expect(result.type).toBe("permission");
        expect(result.canRetry).toBe(true);
        expect(result.userMessage).toBe(
          "Permission denied. Check file/folder permissions."
        );
      });

      it("should handle mixed case", () => {
        const result = categorizeErrorByRules("Permission DENIED");

        expect(result.type).toBe("permission");
        expect(result.canRetry).toBe(true);
      });
    });

    describe("disk_space errors", () => {
      it("should categorize ENOSPC error", () => {
        const result = categorizeErrorByRules(
          "ENOSPC: no space left on device"
        );

        expect(result.type).toBe("disk_space");
        expect(result.canRetry).toBe(false);
        expect(result.userMessage).toBe(
          "Not enough disk space on destination drive."
        );
      });

      it("should categorize no space error", () => {
        const result = categorizeErrorByRules("No space available");

        expect(result.type).toBe("disk_space");
        expect(result.canRetry).toBe(false);
        expect(result.userMessage).toBe(
          "Not enough disk space on destination drive."
        );
      });
    });

    describe("format_error errors", () => {
      it("should categorize format error", () => {
        const errorMessage = "Invalid format: not a valid WAV file";
        const result = categorizeErrorByRules(errorMessage);

        expect(result.type).toBe("format_error");
        expect(result.canRetry).toBe(false);
        expect(result.userMessage).toBe(`Audio format error: ${errorMessage}`);
      });

      it("should categorize WAV error", () => {
        const errorMessage = "WAV header corrupted";
        const result = categorizeErrorByRules(errorMessage);

        expect(result.type).toBe("format_error");
        expect(result.canRetry).toBe(false);
        expect(result.userMessage).toBe(`Audio format error: ${errorMessage}`);
      });

      it("should categorize audio error", () => {
        const errorMessage = "Audio codec not supported";
        const result = categorizeErrorByRules(errorMessage);

        expect(result.type).toBe("format_error");
        expect(result.canRetry).toBe(false);
        expect(result.userMessage).toBe(`Audio format error: ${errorMessage}`);
      });
    });

    describe("network errors", () => {
      it("should categorize network error", () => {
        const result = categorizeErrorByRules("Network timeout occurred");

        expect(result.type).toBe("network");
        expect(result.canRetry).toBe(true);
        expect(result.userMessage).toBe(
          "Network error. Check connection and try again."
        );
      });

      it("should categorize connection error", () => {
        const result = categorizeErrorByRules("Connection refused");

        expect(result.type).toBe("network");
        expect(result.canRetry).toBe(true);
        expect(result.userMessage).toBe(
          "Network error. Check connection and try again."
        );
      });
    });

    describe("unknown errors", () => {
      it("should categorize unknown error as fallback", () => {
        const errorMessage = "Some unexpected error occurred";
        const result = categorizeErrorByRules(errorMessage);

        expect(result.type).toBe("unknown");
        expect(result.canRetry).toBe(true);
        expect(result.userMessage).toBe(`Unexpected error: ${errorMessage}`);
      });

      it("should handle empty error message", () => {
        const result = categorizeErrorByRules("");

        expect(result.type).toBe("unknown");
        expect(result.canRetry).toBe(true);
        expect(result.userMessage).toBe("Unexpected error: ");
      });

      it("should handle error with no matching keywords", () => {
        const errorMessage = "Database corruption detected";
        const result = categorizeErrorByRules(errorMessage);

        expect(result.type).toBe("unknown");
        expect(result.canRetry).toBe(true);
        expect(result.userMessage).toBe(`Unexpected error: ${errorMessage}`);
      });
    });

    describe("edge cases", () => {
      it("should handle error message with multiple matching keywords", () => {
        // This should match the first rule (file_access) since rules are checked in order
        const result = categorizeErrorByRules(
          "File not found and permission denied"
        );

        expect(result.type).toBe("file_access");
        expect(result.canRetry).toBe(false);
      });

      it("should handle keyword as substring", () => {
        const result = categorizeErrorByRules("This is a formatting error");

        expect(result.type).toBe("format_error");
        expect(result.canRetry).toBe(false);
      });

      it("should handle special characters in error message", () => {
        const errorMessage =
          "File not found: /path/with/spaces and & symbols.wav";
        const result = categorizeErrorByRules(
          errorMessage,
          "/path/with/spaces and & symbols.wav"
        );

        expect(result.type).toBe("file_access");
        expect(result.userMessage).toBe(
          "Source file not found: /path/with/spaces and & symbols.wav"
        );
      });

      it("should return proper SyncErrorInfo structure", () => {
        const result = categorizeErrorByRules("test error");

        expect(result).toHaveProperty("type");
        expect(result).toHaveProperty("canRetry");
        expect(result).toHaveProperty("userMessage");
        expect(typeof result.type).toBe("string");
        expect(typeof result.canRetry).toBe("boolean");
        expect(typeof result.userMessage).toBe("string");
      });

      it("should handle null or undefined filePath in function templates", () => {
        const result1 = categorizeErrorByRules("enoent error", undefined);
        const result2 = categorizeErrorByRules("enoent error");

        expect(result1.userMessage).toBe("Source file not found: unknown file");
        expect(result2.userMessage).toBe("Source file not found: unknown file");
      });
    });
  });
});
