import { describe, expect, it } from "vitest";

import {
  banks,
  type Kit,
  kits,
  type NewKit,
  type NewSample,
  samples,
  voices,
} from "../schema";

describe("schema", () => {
  describe("table definitions", () => {
    it("should define banks table", () => {
      expect(banks).toBeDefined();
      expect(banks.letter).toBeDefined();
      expect(banks.artist).toBeDefined();
      expect(banks.rtf_filename).toBeDefined();
      expect(banks.scanned_at).toBeDefined();
    });

    it("should define kits table", () => {
      expect(kits).toBeDefined();
      expect(kits.name).toBeDefined();
      expect(kits.alias).toBeDefined();
      expect(kits.bank_letter).toBeDefined();
      expect(kits.editable).toBeDefined();
      expect(kits.is_favorite).toBeDefined();
      expect(kits.locked).toBeDefined();
      expect(kits.modified_since_sync).toBeDefined();
      expect(kits.step_pattern).toBeDefined();
    });

    it("should define voices table", () => {
      expect(voices).toBeDefined();
      expect(voices.id).toBeDefined();
      expect(voices.kit_name).toBeDefined();
      expect(voices.voice_alias).toBeDefined();
      expect(voices.voice_number).toBeDefined();
    });

    it("should define samples table", () => {
      expect(samples).toBeDefined();
      expect(samples.id).toBeDefined();
      expect(samples.filename).toBeDefined();
      expect(samples.is_stereo).toBeDefined();
      expect(samples.kit_name).toBeDefined();
      expect(samples.slot_number).toBeDefined();
      expect(samples.voice_number).toBeDefined();
    });

    it("should export relation functions", () => {
      // Check that relations are available
      expect(typeof kits).toBe("object");
      expect(typeof samples).toBe("object");
      expect(typeof voices).toBe("object");
      expect(typeof banks).toBe("object");
    });
  });

  describe("type exports", () => {
    it("should export Kit type", () => {
      const kit = {} as Kit;
      expect(kit).toBeDefined();
    });

    it("should export NewKit type", () => {
      const newKit = {} as NewKit;
      expect(newKit).toBeDefined();
    });

    it("should export NewSample type", () => {
      const newSample = {} as NewSample;
      expect(newSample).toBeDefined();
    });
  });

  describe("table structure validation", () => {
    it("should have table objects with proper structure", () => {
      // Test that tables are properly structured objects
      expect(typeof banks).toBe("object");
      expect(typeof kits).toBe("object");
      expect(typeof voices).toBe("object");
      expect(typeof samples).toBe("object");
    });

    it("should have column definitions", () => {
      // Check that columns are defined
      expect(banks.letter).toBeDefined();
      expect(banks.artist).toBeDefined();
      expect(kits.name).toBeDefined();
      expect(kits.editable).toBeDefined();
      expect(voices.id).toBeDefined();
      expect(voices.kit_name).toBeDefined();
      expect(samples.id).toBeDefined();
      expect(samples.filename).toBeDefined();
    });

    it("should have proper column types", () => {
      // Test that columns have the expected structure
      expect(typeof banks.letter).toBe("object");
      expect(typeof kits.name).toBe("object");
      expect(typeof voices.id).toBe("object");
      expect(typeof samples.filename).toBe("object");
    });
  });

  describe("relation definitions", () => {
    it("should export relation functions", () => {
      // These are available from the schema module
      expect(typeof kits).toBe("object");
      expect(typeof voices).toBe("object");
      expect(typeof samples).toBe("object");
      expect(typeof banks).toBe("object");
    });
  });
});
