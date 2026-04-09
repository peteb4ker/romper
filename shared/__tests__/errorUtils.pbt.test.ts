/**
 * Property-Based Tests for errorUtils.
 * PBT-03: Invariant properties for error handling.
 * PBT-04: Idempotency for error creation.
 */
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { createErrorResult, getErrorMessage } from "../errorUtils";

describe("errorUtils - Property-Based Tests", () => {
  describe("PBT-03: Invariant properties", () => {
    it("createErrorResult always returns success: false", () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.string().map((s) => new Error(s)),
            fc.string(),
            fc.constant(null),
            fc.constant(undefined),
          ),
          fc.string(),
          (error, prefix) => {
            const result = createErrorResult(error, prefix);
            expect(result.success).toBe(false);
          },
        ),
      );
    });

    it("createErrorResult error message always contains the prefix", () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }).map((s) => new Error(s)),
          fc.string({ minLength: 1 }),
          (error, prefix) => {
            const result = createErrorResult(error, prefix);
            expect(result.error).toContain(prefix);
          },
        ),
      );
    });

    it("getErrorMessage always returns a string", () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.string().map((s) => new Error(s)),
            fc.string(),
            fc.integer(),
            fc.constant(null),
            fc.constant(undefined),
          ),
          (error) => {
            const message = getErrorMessage(error);
            expect(typeof message).toBe("string");
          },
        ),
      );
    });

    it("getErrorMessage preserves Error.message content", () => {
      fc.assert(
        fc.property(fc.string({ minLength: 1 }), (msg) => {
          const error = new Error(msg);
          const result = getErrorMessage(error);
          expect(result).toContain(msg);
        }),
      );
    });
  });

  describe("PBT-04: Idempotency properties", () => {
    it("getErrorMessage is idempotent on same input", () => {
      fc.assert(
        fc.property(fc.string(), (msg) => {
          const error = new Error(msg);
          expect(getErrorMessage(error)).toBe(getErrorMessage(error));
        }),
      );
    });
  });
});
