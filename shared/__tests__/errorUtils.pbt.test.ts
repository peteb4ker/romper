/**
 * Property-Based Tests for errorUtils.
 * PBT-03: Invariant properties for error handling.
 * PBT-04: Idempotency for error creation.
 */
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { getErrorMessage } from "../errorUtils";

describe("errorUtils - Property-Based Tests", () => {
  describe("PBT-03: Invariant properties", () => {
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
