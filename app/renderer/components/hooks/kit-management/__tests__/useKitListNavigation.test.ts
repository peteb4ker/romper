import type { KitWithRelations } from "@romper/shared/db/schema";

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useKitListNavigation } from "../useKitListNavigation";

// Mock kit data
const createMockKit = (name: string): KitWithRelations => ({
  alias: null,
  artist: null,
  bank_letter: "A",
  editable: false,
  locked: false,
  modified_since_sync: false,
  name,
  step_pattern: null,
  voices: [],
});

const mockKits: KitWithRelations[] = [
  createMockKit("Kit1"),
  createMockKit("Kit2"),
  createMockKit("Kit3"),
  createMockKit("Kit4"),
];

describe("useKitListNavigation", () => {
  describe("initial state", () => {
    it("should start with focusedIdx at 0", () => {
      const { result } = renderHook(() => useKitListNavigation(mockKits, null));

      expect(result.current.focusedIdx).toBe(0);
    });

    it("should provide moveFocus and setFocus functions", () => {
      const { result } = renderHook(() => useKitListNavigation(mockKits, null));

      expect(typeof result.current.moveFocus).toBe("function");
      expect(typeof result.current.setFocus).toBe("function");
    });
  });

  describe("moveFocus", () => {
    it("should move focus forward by delta", () => {
      const { result } = renderHook(() => useKitListNavigation(mockKits, null));

      act(() => {
        result.current.moveFocus(2);
      });

      expect(result.current.focusedIdx).toBe(2);
    });

    it("should move focus backward by negative delta", () => {
      const { result } = renderHook(() => useKitListNavigation(mockKits, null));

      // First move to index 3
      act(() => {
        result.current.moveFocus(3);
      });
      expect(result.current.focusedIdx).toBe(3);

      // Then move back by 2
      act(() => {
        result.current.moveFocus(-2);
      });

      expect(result.current.focusedIdx).toBe(1);
    });

    it("should clamp to 0 when moving before start", () => {
      const { result } = renderHook(() => useKitListNavigation(mockKits, null));

      act(() => {
        result.current.moveFocus(-5);
      });

      expect(result.current.focusedIdx).toBe(0);
    });

    it("should clamp to last index when moving past end", () => {
      const { result } = renderHook(() => useKitListNavigation(mockKits, null));

      act(() => {
        result.current.moveFocus(10);
      });

      expect(result.current.focusedIdx).toBe(3); // Last index
    });

    it("should handle zero delta", () => {
      const { result } = renderHook(() => useKitListNavigation(mockKits, null));

      const initialIndex = result.current.focusedIdx;

      act(() => {
        result.current.moveFocus(0);
      });

      expect(result.current.focusedIdx).toBe(initialIndex);
    });
  });

  describe("setFocus", () => {
    it("should set focus to specific valid index", () => {
      const { result } = renderHook(() => useKitListNavigation(mockKits, null));

      act(() => {
        result.current.setFocus(2);
      });

      expect(result.current.focusedIdx).toBe(2);
    });

    it("should ignore negative index", () => {
      const { result } = renderHook(() => useKitListNavigation(mockKits, null));

      const initialIndex = result.current.focusedIdx;

      act(() => {
        result.current.setFocus(-1);
      });

      expect(result.current.focusedIdx).toBe(initialIndex);
    });

    it("should ignore index beyond kits length", () => {
      const { result } = renderHook(() => useKitListNavigation(mockKits, null));

      const initialIndex = result.current.focusedIdx;

      act(() => {
        result.current.setFocus(10);
      });

      expect(result.current.focusedIdx).toBe(initialIndex);
    });

    it("should set focus to last valid index", () => {
      const { result } = renderHook(() => useKitListNavigation(mockKits, null));

      act(() => {
        result.current.setFocus(3); // Last valid index
      });

      expect(result.current.focusedIdx).toBe(3);
    });
  });

  describe("external focus control", () => {
    it("should update focus when focusedKit matches a kit name", () => {
      const { rerender, result } = renderHook(
        ({ focusedKit, kits }) => useKitListNavigation(kits, focusedKit),
        {
          initialProps: { focusedKit: null as null | string, kits: mockKits },
        },
      );

      expect(result.current.focusedIdx).toBe(0);

      rerender({ focusedKit: "Kit3", kits: mockKits });

      expect(result.current.focusedIdx).toBe(2);
    });

    it("should ignore non-existent kit names", () => {
      const { rerender, result } = renderHook(
        ({ focusedKit, kits }) => useKitListNavigation(kits, focusedKit),
        {
          initialProps: { focusedKit: null as null | string, kits: mockKits },
        },
      );

      const initialIndex = result.current.focusedIdx;

      rerender({ focusedKit: "NonExistentKit", kits: mockKits });

      expect(result.current.focusedIdx).toBe(initialIndex);
    });

    it("should not update if external focus is same as current", () => {
      const { rerender, result } = renderHook(
        ({ focusedKit, kits }) => useKitListNavigation(kits, focusedKit),
        {
          initialProps: { focusedKit: "Kit1" as null | string, kits: mockKits },
        },
      );

      expect(result.current.focusedIdx).toBe(0);

      // Try to set the same focus again
      rerender({ focusedKit: "Kit1", kits: mockKits });

      expect(result.current.focusedIdx).toBe(0);
    });

    it("should handle null focusedKit", () => {
      const { rerender, result } = renderHook(
        ({ focusedKit, kits }) => useKitListNavigation(kits, focusedKit),
        {
          initialProps: { focusedKit: "Kit2" as null | string, kits: mockKits },
        },
      );

      expect(result.current.focusedIdx).toBe(1);

      rerender({ focusedKit: null, kits: mockKits });

      expect(result.current.focusedIdx).toBe(1); // Should remain unchanged
    });
  });

  describe("kits change behavior", () => {
    it("should reset focus to 0 when kits change", () => {
      const { rerender, result } = renderHook(
        ({ focusedKit, kits }) => useKitListNavigation(kits, focusedKit),
        {
          initialProps: { focusedKit: null as null | string, kits: mockKits },
        },
      );

      // Move focus away from 0
      act(() => {
        result.current.setFocus(2);
      });
      expect(result.current.focusedIdx).toBe(2);

      // Change kits
      const newKits = [createMockKit("NewKit1"), createMockKit("NewKit2")];
      rerender({ focusedKit: null, kits: newKits });

      expect(result.current.focusedIdx).toBe(0);
    });

    it("should handle empty kits array", () => {
      const { result } = renderHook(() => useKitListNavigation([], null));

      expect(result.current.focusedIdx).toBe(0);

      // moveFocus should clamp to 0
      act(() => {
        result.current.moveFocus(1);
      });
      expect(result.current.focusedIdx).toBe(0);

      // setFocus should be ignored
      act(() => {
        result.current.setFocus(0);
      });
      expect(result.current.focusedIdx).toBe(0);
    });

    it("should handle single kit", () => {
      const singleKit = [createMockKit("OnlyKit")];
      const { result } = renderHook(() =>
        useKitListNavigation(singleKit, null),
      );

      expect(result.current.focusedIdx).toBe(0);

      // Should clamp to 0
      act(() => {
        result.current.moveFocus(5);
      });
      expect(result.current.focusedIdx).toBe(0);

      act(() => {
        result.current.moveFocus(-5);
      });
      expect(result.current.focusedIdx).toBe(0);
    });
  });

  describe("interaction between user and external navigation", () => {
    it("should allow user navigation to override external focus", () => {
      const { rerender, result } = renderHook(
        ({ focusedKit, kits }) => useKitListNavigation(kits, focusedKit),
        {
          initialProps: { focusedKit: "Kit3" as null | string, kits: mockKits },
        },
      );

      expect(result.current.focusedIdx).toBe(2);

      // User navigates
      act(() => {
        result.current.moveFocus(1);
      });
      expect(result.current.focusedIdx).toBe(3);

      // External focus tries to set same value - should not override user navigation
      rerender({ focusedKit: "Kit3", kits: mockKits });
      expect(result.current.focusedIdx).toBe(3); // Should stay where user navigated
    });

    it("should allow external focus after user navigation if it's different", () => {
      const { rerender, result } = renderHook(
        ({ focusedKit, kits }) => useKitListNavigation(kits, focusedKit),
        {
          initialProps: { focusedKit: null as null | string, kits: mockKits },
        },
      );

      // User navigates to index 2
      act(() => {
        result.current.setFocus(2);
      });
      expect(result.current.focusedIdx).toBe(2);

      // External focus sets to different kit
      rerender({ focusedKit: "Kit1", kits: mockKits });
      expect(result.current.focusedIdx).toBe(0);
    });
  });
});
