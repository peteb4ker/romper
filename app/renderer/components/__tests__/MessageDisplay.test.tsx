import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import MessageDisplay from "../MessageDisplay";

describe("MessageDisplay", () => {
  it("renders without crashing", () => {
    const { container } = render(<MessageDisplay />);
    // MessageDisplay is now a no-op — renders null
    expect(container.innerHTML).toBe("");
  });
});
