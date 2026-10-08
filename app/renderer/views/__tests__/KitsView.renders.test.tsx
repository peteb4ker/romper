import { act, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createMockKitWithRelations } from "../../../../tests/factories/kit.factory";
import { TestSettingsProvider } from "../../../../tests/providers/TestSettingsProvider";
import { useMessageDisplay } from "../../components/hooks/shared/useMessageDisplay";
import { MessageDisplayContext } from "../../components/MessageDisplayContext";
import KitsView from "../KitsView";

// Every kit card's render calls useKitItem once, so its calls count the
// card renders (#462)
const cardRenders = vi.hoisted(() => vi.fn());
vi.mock(
  "../../components/hooks/kit-management/useKitItem",
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import("../../components/hooks/kit-management/useKitItem")
      >();
    return {
      useKitItem: (...args: Parameters<typeof actual.useKitItem>) => {
        cardRenders();
        return actual.useKitItem(...args);
      },
    };
  },
);

const kits = ["A", "B"].flatMap((bank) =>
  Array.from({ length: 4 }, (_, i) =>
    createMockKitWithRelations({ bank_letter: bank, name: `${bank}${i}` }),
  ),
);

/** The app's message stack, as main.tsx provides it, with a way to post */
function MessageProvider({ children }: { children: React.ReactNode }) {
  const messageDisplay = useMessageDisplay();
  return (
    <MessageDisplayContext.Provider value={messageDisplay}>
      <button onClick={() => messageDisplay.showMessage("Kit saved")}>
        Post message
      </button>
      {children}
    </MessageDisplayContext.Provider>
  );
}

async function renderKitsView() {
  render(
    <TestSettingsProvider>
      <MessageProvider>
        <KitsView />
      </MessageProvider>
    </TestSettingsProvider>,
  );
  await screen.findByTestId("kit-item-B3");
  // Let the browser's loads (bank names, sample counts) settle
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 50));
  });
  cardRenders.mockClear();
}

describe("[Q-01] [UC-07] [UC-09] Kit browser renders only what changed (#462)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(globalThis.electronAPI.getKits).mockResolvedValue({
      data: kits,
      success: true,
    });
  });

  it("doesn't redraw the kit cards when a message is shown", async () => {
    await renderKitsView();

    fireEvent.click(screen.getByText("Post message"));

    expect(cardRenders).not.toHaveBeenCalled();
  });

  it("doesn't redraw the kit cards while the first letter of a search is typed", async () => {
    await renderKitsView();

    fireEvent.change(screen.getByLabelText("Search kits"), {
      target: { value: "A" },
    });
    // The searching indicator clears after a moment
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 150));
    });

    expect(cardRenders).not.toHaveBeenCalled();
    expect(screen.getByTestId("kit-item-B3")).toBeInTheDocument();
  });
});
