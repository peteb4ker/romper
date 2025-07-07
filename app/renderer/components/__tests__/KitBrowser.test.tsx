// Test suite for KitBrowser component
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import KitBrowser from "../KitBrowser";
import { MockMessageDisplayProvider } from "./MockMessageDisplayProvider";

const baseProps = {
  onSelectKit: vi.fn(),
  localStorePath: "/mock/sd",
  kits: ["A0", "A1", "B0"],
  kitLabels: {
    A0: { voiceNames: ["Kick", "Snare", "Hat", "Tom"] },
    A1: { voiceNames: ["Kick", "Snare", "Hat", "Tom"] },
    B0: { voiceNames: ["Kick", "Snare", "Hat", "Tom"] },
  },
  onRescanAllVoiceNames: vi.fn(),
  sampleCounts: { A0: [1, 1, 1, 1], A1: [1, 1, 1, 1], B0: [1, 1, 1, 1] },
  onRefreshKits: vi.fn(),
};

describe("KitBrowser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.electronAPI = {
      listFilesInRoot: vi.fn().mockResolvedValue([]),
      createKit: vi.fn().mockResolvedValue(undefined),
      copyKit: vi.fn().mockResolvedValue(undefined),
      selectSdCard: vi.fn().mockResolvedValue("/mock/sd"),
      setSetting: vi.fn(),
      validateLocalStore: vi.fn().mockResolvedValue({
        isValid: true,
        errors: [],
        errorSummary: undefined,
      }),
    };
    // Mock scrollTo for jsdom
    Object.defineProperty(HTMLElement.prototype, "scrollTo", {
      value: () => {},
      writable: true,
    });
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  describe("rendering", () => {
    it("renders kit list and header", async () => {
      render(
        <MockMessageDisplayProvider>
          <KitBrowser {...baseProps} />
        </MockMessageDisplayProvider>,
      );
      expect(screen.getByText("Rescan All Kit Voice Names")).toBeTruthy();
      expect(screen.getByText("+ New Kit")).toBeTruthy();
      expect(screen.getByTestId("kit-item-A0")).toBeTruthy();
      expect(screen.getByTestId("kit-item-A1")).toBeTruthy();
      expect(screen.getByTestId("kit-item-B0")).toBeTruthy();
    });
  });

  describe("actions", () => {
    it("calls onSelectKit when a kit is clicked", () => {
      render(
        <MockMessageDisplayProvider>
          <KitBrowser {...baseProps} />
        </MockMessageDisplayProvider>,
      );
      const kit = screen.getByTestId("kit-item-A0");
      fireEvent.click(kit);
      expect(baseProps.onSelectKit).toHaveBeenCalledWith("A0");
    });
    it("shows new kit dialog when + New Kit is clicked", () => {
      render(
        <MockMessageDisplayProvider>
          <KitBrowser {...baseProps} />
        </MockMessageDisplayProvider>,
      );
      fireEvent.click(screen.getByText("+ New Kit"));
      expect(screen.getByText("Kit Slot (A0-Z99):")).toBeTruthy();
      expect(screen.getByText("Create")).toBeTruthy();
    });
    it("calls onRescanAllVoiceNames when button is clicked", () => {
      render(
        <MockMessageDisplayProvider>
          <KitBrowser {...baseProps} />
        </MockMessageDisplayProvider>,
      );
      fireEvent.click(screen.getByText("Rescan All Kit Voice Names"));
      expect(baseProps.onRescanAllVoiceNames).toHaveBeenCalled();
    });
  });

  describe("keyboard navigation", () => {
    it("does not highlight/select a bank button when pressing a key for a bank with no kits", async () => {
      render(
        <MockMessageDisplayProvider>
          <KitBrowser {...baseProps} kits={["A0", "A1", "B0"]} />
        </MockMessageDisplayProvider>,
      );
      const kitList = screen.getAllByTestId("kit-list")[0];
      kitList.focus();
      // Bank C has no kits, so pressing 'C' should not highlight/select the C button
      const cButtons = screen.getAllByRole("button", {
        name: "Jump to bank C",
      });
      // There may be more than one due to virtualization, but all should be disabled
      cButtons.forEach((cButton) => {
        expect(cButton.getAttribute("disabled")).not.toBeNull();
      });
      fireEvent.keyDown(kitList, { key: "C" });
      await waitFor(() => {
        cButtons.forEach((cButton) => {
          expect(cButton.getAttribute("aria-current")).not.toBe("true");
          expect(cButton.className).not.toMatch(/bg-blue-800/);
        });
      });
    });

    describe("KitBrowser keyboard navigation bugs", () => {
      const navProps = {
        ...baseProps,
        kits: ["A1", "A2", "B1", "B2"],
        kitLabels: {
          A1: { label: "Kick" },
          A2: { label: "Snare" },
          B1: { label: "Hat" },
          B2: { label: "Tom" },
        },
        sampleCounts: {
          A1: [1, 1, 1, 1],
          A2: [1, 1, 1, 1],
          B1: [1, 1, 1, 1],
          B2: [1, 1, 1, 1],
        },
      };

      it("should highlight/select the first kit in a bank when a bank button is clicked", async () => {
        render(
          <MockMessageDisplayProvider>
            <KitBrowser {...navProps} />
          </MockMessageDisplayProvider>,
        );
        // Click bank B
        const bButtons = screen.getAllByRole("button", {
          name: "Jump to bank B",
        });
        const bButton = bButtons.find((btn) => !btn.disabled);
        fireEvent.click(bButton);
        // The first kit in bank B should be focused/highlighted
        await waitFor(
          () => {
            const kitB1s = screen.getAllByTestId("kit-item-B1");
            const selected = kitB1s.filter(
              (el) => el.getAttribute("aria-selected") === "true",
            );
            if (selected.length !== 1) {
              console.log(
                "kitB1s:",
                kitB1s.map((el) => el.outerHTML),
              );
            }
            expect(selected.length).toBe(1);
            expect(selected[0].getAttribute("tabindex")).toBe("0");
            kitB1s.forEach((el) => {
              if (el !== selected[0]) {
                expect(el.getAttribute("aria-selected")).toBe("false");
                expect(el.getAttribute("tabindex")).toBe("-1");
              }
            });
          },
          { timeout: 2000 },
        );
      });
      it("should highlight/select the first kit in a bank when A-Z hotkey is pressed", async () => {
        render(
          <MockMessageDisplayProvider>
            <KitBrowser {...navProps} />
          </MockMessageDisplayProvider>,
        );
        const kitList = screen.getAllByTestId("kit-list")[0];
        kitList.focus();
        fireEvent.keyDown(kitList, { key: "B" });
        await waitFor(
          () => {
            const kitB1s = screen.getAllByTestId("kit-item-B1");
            const selected = kitB1s.filter(
              (el) => el.getAttribute("aria-selected") === "true",
            );
            if (selected.length !== 1) {
              console.log(
                "kitB1s:",
                kitB1s.map((el) => el.outerHTML),
              );
            }
            expect(selected.length).toBe(1);
            expect(selected[0].getAttribute("tabindex")).toBe("0");
            kitB1s.forEach((el) => {
              if (el !== selected[0]) {
                expect(el.getAttribute("aria-selected")).toBe("false");
                expect(el.getAttribute("tabindex")).toBe("-1");
              }
            });
          },
          { timeout: 2000 },
        );
      });
    });
  });

  describe("Validation Results", () => {
    it("should open validation dialog when validate button is clicked", async () => {
      // Mock validation results for test
      window.electronAPI.validateLocalStore = vi.fn().mockResolvedValue({
        isValid: false,
        errors: [
          {
            kitName: "A1",
            missingFiles: ["kick.wav"],
            extraFiles: [],
          },
        ],
        errorSummary: "Found validation errors",
      });

      render(
        <MockMessageDisplayProvider>
          <KitBrowser {...baseProps} />
        </MockMessageDisplayProvider>,
      );

      // Find and click the validate button
      const validateButton = screen.getByText("Validate Local Store");
      fireEvent.click(validateButton);

      // Wait for dialog to appear
      await waitFor(() => {
        expect(
          screen.getByText("Local Store Validation Results"),
        ).toBeInTheDocument();
        expect(window.electronAPI.validateLocalStore).toHaveBeenCalled();
      });
    });
  });
});
