import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { setupElectronAPIMock } from "../../../../tests/mocks/electron/electronAPI";
import { SettingsProvider } from "../../utils/SettingsContext";
import PreferencesDialog from "../dialogs/PreferencesDialog";
import { useMessageDisplay } from "../hooks/shared/useMessageDisplay";
import {
  CONFIRM_DESTRUCTIVE_NOT_SAVED,
  THEME_NOT_SAVED,
} from "../hooks/shared/usePreferenceSaves";
import { MessageDisplayContext } from "../MessageDisplayContext";
import StatusBar from "../StatusBar";

// The app's real settings and message providers, with the messages listed
function Harness({ children }: { children: React.ReactNode }) {
  const messageDisplay = useMessageDisplay();
  return (
    <MessageDisplayContext.Provider value={messageDisplay}>
      <ul data-testid="messages">
        {messageDisplay.messages.map((m) => (
          <li key={m.id}>{`${m.type}: ${m.text}`}</li>
        ))}
      </ul>
      {children}
    </MessageDisplayContext.Provider>
  );
}

function renderWithSettings(ui: React.ReactElement) {
  return render(
    <SettingsProvider>
      <Harness>{ui}</Harness>
    </SettingsProvider>,
  );
}

// #570: a failed theme or confirmation save used to be only logged
describe("[Q-02] preference saves that fail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupElectronAPIMock();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(globalThis.electronAPI.readSettings).mockResolvedValue({
      confirmDestructiveActions: true,
      localStorePath: "/test/path",
      themeMode: "light",
    });
    vi.mocked(globalThis.electronAPI.setSetting).mockRejectedValue(
      new Error("EACCES"),
    );
    document.documentElement.classList.remove("dark");
  });

  it("says the confirmation setting wasn't saved and keeps it checked", async () => {
    renderWithSettings(<PreferencesDialog isOpen onClose={vi.fn()} />);
    const checkbox = await screen.findByLabelText(
      "Confirm destructive actions",
    );
    expect(checkbox).toBeChecked();

    fireEvent.click(checkbox);

    await waitFor(() =>
      expect(screen.getByTestId("messages")).toHaveTextContent(
        `error: ${CONFIRM_DESTRUCTIVE_NOT_SAVED}`,
      ),
    );
    expect(globalThis.electronAPI.setSetting).toHaveBeenCalledWith(
      "confirmDestructiveActions",
      false,
    );
    expect(checkbox).toBeChecked();
  });

  it("says the theme wasn't saved and keeps the saved theme", async () => {
    renderWithSettings(<PreferencesDialog isOpen onClose={vi.fn()} />);
    fireEvent.click(await screen.findByText("Appearance"));

    fireEvent.click(screen.getByRole("button", { name: "Dark theme" }));

    await waitFor(() =>
      expect(screen.getByTestId("messages")).toHaveTextContent(
        `error: ${THEME_NOT_SAVED}`,
      ),
    );
    expect(screen.getByRole("button", { name: "Light theme" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Dark theme" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(document.documentElement).not.toHaveClass("dark");
  });

  it("says the status bar's theme change wasn't saved", async () => {
    renderWithSettings(<StatusBar />);
    const toggle = await screen.findByRole("button", {
      name: "Toggle theme mode",
    });

    fireEvent.click(toggle);

    await waitFor(() =>
      expect(screen.getByTestId("messages")).toHaveTextContent(
        `error: ${THEME_NOT_SAVED}`,
      ),
    );
    expect(toggle).toHaveAttribute("title", "Current: light");
    expect(document.documentElement).not.toHaveClass("dark");
  });

  it("says nothing when the save works", async () => {
    vi.mocked(globalThis.electronAPI.setSetting).mockResolvedValue(undefined);
    renderWithSettings(<PreferencesDialog isOpen onClose={vi.fn()} />);
    const checkbox = await screen.findByLabelText(
      "Confirm destructive actions",
    );

    fireEvent.click(checkbox);

    await waitFor(() => expect(checkbox).not.toBeChecked());
    expect(screen.getByTestId("messages")).toBeEmptyDOMElement();
  });
});
