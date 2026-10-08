import type { LocalStoreValidationDetailedResult } from "@romper/shared/db/schema";

import { act, fireEvent, render, screen, within } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createMockKitWithRelations } from "../../../../tests/factories/kit.factory";
import { setupElectronAPIMock } from "../../../../tests/mocks/electron/electronAPI";
import { useMessageDisplay } from "../../components/hooks/shared/useMessageDisplay";
import { MessageDisplayContext } from "../../components/MessageDisplayContext";
import { favoriteFailedMessage } from "../../utils/favoriteMessages";
import { SettingsProvider } from "../../utils/SettingsContext";
import KitsView from "../KitsView";

const STORE = "/mock/local/store";
const VALID: LocalStoreValidationDetailedResult = {
  hasLocalStore: true,
  isValid: true,
  localStorePath: STORE,
};
// What main reports for a store whose romper.sqlite is gone
const DB_GONE: LocalStoreValidationDetailedResult = {
  error: "Romper DB file not found",
  hasLocalStore: true,
  isValid: false,
  localStorePath: STORE,
};

/** Main's "the database file is missing" event, as the preload forwards it */
function databaseMissingEvent(): () => void {
  const subscribe = vi.mocked(
    globalThis.electronAPI.onLocalStoreDatabaseMissing,
  );
  const callback = subscribe.mock.calls.at(-1)?.[0];
  if (!callback) throw new Error("Nothing listens for the event");
  return callback;
}

/** The app's message stack, as main.tsx provides it, listed for the test */
function Messages({ children }: { children: React.ReactNode }) {
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

/**
 * Render the kits view with the app's real settings, as main.tsx does, and
 * let it load: the settings, the store's status, then the kits
 */
async function renderKitsView() {
  await settle(() => {
    render(
      <SettingsProvider>
        <Messages>
          <KitsView />
        </Messages>
      </SettingsProvider>,
    );
  });
  expect(screen.getByTestId("kit-item-A0")).toBeInTheDocument();
}

/**
 * Run `work` and everything it sets off: the mocked IPC calls resolve and
 * React renders their results before act returns. Nothing races a timer,
 * however slowly the machine renders (CI runs the suite with coverage).
 */
async function settle(work: () => void) {
  await act(async () => {
    work();
  });
}

describe("[Q-02] [UC-05] The library's database file goes missing while Romper runs (#535)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupElectronAPIMock();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.mocked(globalThis.electronAPI.readSettings).mockResolvedValue({
      confirmDestructiveActions: true,
      localStorePath: STORE,
      themeMode: "light",
    });
    vi.mocked(globalThis.electronAPI.getLocalStoreStatus).mockResolvedValue(
      VALID,
    );
    vi.mocked(globalThis.electronAPI.getKits).mockResolvedValue({
      data: [createMockKitWithRelations({ bank_letter: "A", name: "A0" })],
      success: true,
    });
  });

  it("shows the Invalid Local Store dialog when main reports it", async () => {
    await renderKitsView();
    expect(screen.queryByText("Invalid Local Store")).not.toBeInTheDocument();

    vi.mocked(globalThis.electronAPI.getLocalStoreStatus).mockResolvedValue(
      DB_GONE,
    );
    await settle(() => databaseMissingEvent()());

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Invalid Local Store")).toBeInTheDocument();
    expect(
      within(dialog).getByText("Romper DB file not found"),
    ).toBeInTheDocument();
  });

  it("doesn't show a failed edit as saved, and shows the dialog", async () => {
    await renderKitsView();

    // Main fails the edit: the file is gone, and it says so to the renderer
    vi.mocked(globalThis.electronAPI.getLocalStoreStatus).mockResolvedValue(
      DB_GONE,
    );
    vi.mocked(globalThis.electronAPI.toggleKitFavorite).mockImplementation(
      async () => {
        databaseMissingEvent()();
        return {
          error: `Database file does not exist: ${STORE}/.romperdb/romper.sqlite`,
          success: false,
        };
      },
    );

    await settle(() => fireEvent.click(screen.getByTitle("Add to favorites")));

    expect(screen.getByText("Invalid Local Store")).toBeInTheDocument();
    expect(screen.getByTestId("messages")).toHaveTextContent(
      `error: ${favoriteFailedMessage("A0", false)}`,
    );
    expect(
      screen.queryByTitle("Remove from favorites"),
    ).not.toBeInTheDocument();
  });

  it("stops listening when the app unmounts", async () => {
    const stopListening = vi.fn();
    vi.mocked(
      globalThis.electronAPI.onLocalStoreDatabaseMissing,
    ).mockReturnValue(stopListening);
    const { unmount } = render(
      <SettingsProvider>
        <div />
      </SettingsProvider>,
    );

    unmount();

    expect(stopListening).toHaveBeenCalled();
  });
});
