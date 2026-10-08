import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import WizardTargetStep from "../WizardTargetStep";

describe("WizardTargetStep", () => {
  it("renders target path input and buttons", () => {
    render(
      <WizardTargetStep
        configSdCardPath={"/mock/sdcard"}
        defaultPath="/mock/default"
        safeSelectLocalStorePath={() => {}}
        setTargetPath={() => {}}
        stateTargetPath="/mock/target"
      />,
    );
    expect(screen.getByLabelText(/local store path/i)).toBeInTheDocument();
    expect(screen.getAllByText(/choose/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/use default/i)).toBeInTheDocument();
  });

  describe("[UC-01] [UC-02] [UC-03] choosing a folder", () => {
    /** The path set after choosing `chosen` in the folder picker */
    const targetFor = async (chosen: string | undefined) => {
      const setTargetPath = vi.fn<(path: string) => void>();
      render(
        <WizardTargetStep
          defaultPath="/mock/default"
          safeSelectLocalStorePath={() => Promise.resolve(chosen)}
          setTargetPath={setTargetPath}
          stateTargetPath=""
        />,
      );
      fireEvent.click(screen.getByTestId("wizard-target-browse-btn"));
      await vi.waitFor(() =>
        expect(screen.getByTestId("wizard-target-browse-btn")).toBeEnabled(),
      );
      cleanup();
      return setTargetPath.mock.calls.at(-1)?.[0];
    };

    it("puts the store in a romper folder inside the chosen one", async () => {
      expect(await targetFor("/Users/me/Music")).toBe("/Users/me/Music/romper");
    });

    it("keeps a chosen folder that is already the romper folder", async () => {
      expect(await targetFor("/Users/me/romper")).toBe("/Users/me/romper");
      expect(await targetFor("/Users/me/romper/")).toBe("/Users/me/romper/");
    });

    it("drops trailing slashes or backslashes before adding romper", async () => {
      expect(await targetFor("/Users/me/Music///")).toBe(
        "/Users/me/Music/romper",
      );
      expect(await targetFor("C:\\Music\\\\")).toBe("C:\\Music/romper");
    });

    it("drops only the last kind of separator from mixed slashes", async () => {
      expect(await targetFor("C:\\Music\\//")).toBe("C:\\Music\\/romper");
      expect(await targetFor("/Users/me/Music/\\")).toBe(
        "/Users/me/Music//romper",
      );
    });

    it("sets nothing when the picker is cancelled", async () => {
      expect(await targetFor(undefined)).toBeUndefined();
      expect(await targetFor("")).toBeUndefined();
    });
  });
});
