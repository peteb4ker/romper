import { describe, expect, it } from "vitest";

import { favoriteFailedMessage } from "../favoriteMessages";

describe("[UC-10] favoriteFailedMessage", () => {
  it("says the kit couldn't be added when it wasn't a favorite", () => {
    expect(favoriteFailedMessage("A0", false)).toBe(
      "Couldn't add kit A0 to favorites. Try again.",
    );
  });

  it("says the kit couldn't be removed when it was a favorite", () => {
    expect(favoriteFailedMessage("A0", true)).toBe(
      "Couldn't remove kit A0 from favorites. Try again.",
    );
  });
});
