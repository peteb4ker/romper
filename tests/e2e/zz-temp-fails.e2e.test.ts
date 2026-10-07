import { expect, test } from "@playwright/test";

// TEMP (#660 proof): fails on purpose, to show that one failing shard fails
// e2e-tests-check. Never merged.
test("[Q-07] TEMP fails on purpose to prove the e2e gate (#660)", () => {
  expect(1 + 1).toBe(3);
});
