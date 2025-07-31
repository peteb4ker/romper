import { render, screen } from "@testing-library/react";
import { cleanup } from "@testing-library/react";
import { toast } from "sonner";
import { describe, expect, it } from "vitest";
import { afterEach } from "vitest";

import MessageDisplay from "../MessageDisplay";

afterEach(() => {
  cleanup();
});

describe("MessageDisplay (Sonner Toaster)", () => {
  it("displays a message when toast is called", async () => {
    render(<MessageDisplay />);
    toast("Test message", { type: "info", duration: 1000 });
    // Wait for the toast to appear
    const el = await screen.findByText("Test message");
    expect(el).toBeTruthy();
  });
});
