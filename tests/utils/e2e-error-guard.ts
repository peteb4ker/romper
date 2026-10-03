/**
 * The e2e error guard (RE-67): fails any e2e test in which the app reports
 * an error nobody expected.
 *
 * Specs import `test` and `expect` from here instead of `@playwright/test`.
 * Every app a test launches is then watched by the full-pipeline
 * validation's `MessageCollector`: renderer console errors, uncaught page
 * errors, error toasts, the error boundary and the wizard's error, and the
 * main process's stderr. When the test ends, any error-level message that
 * isn't expected fails it. Unexpected warnings are listed as annotations
 * and don't fail it. Main-process stderr from Chromium, the OS or the
 * harness is expected everywhere through the known-noise list
 * (tests/validation/support/known-noise.ts); see its header for when to
 * add an entry.
 *
 * A spec declares what it expects, keyed by the reason it's expected, as
 * the validation does:
 *
 *   test.use({
 *     expectedMessages: {
 *       "why this error is right here": { pattern: /.../, sources: ["ui"] },
 *     },
 *   });
 *
 * (An object, not an array: `test.use` reads a two-element array as a
 * `[value, options]` fixture tuple.)
 */
import {
  _electron,
  test as base,
  type ElectronApplication,
  type Page,
  type TestInfo,
} from "@playwright/test";

import { BASELINE_EXPECTED } from "../validation/support/baseline";
import {
  type ClassifiedMessage,
  type Expectation,
  MessageCollector,
} from "../validation/support/collector";

export { expect } from "@playwright/test";

/** Messages a spec expects, keyed by the reason each one is expected */
export type ExpectedMessages = Record<string, Omit<Expectation, "reason">>;

interface ErrorGuardFixtures {
  errorGuard: void;
  /** Messages this spec expects (`test.use`) */
  expectedMessages: ExpectedMessages;
}

export const test = base.extend<ErrorGuardFixtures>({
  errorGuard: [
    async ({ expectedMessages }, use, testInfo) => {
      const collector = new MessageCollector();
      collector.step = testInfo.title;
      const apps: ElectronApplication[] = [];

      // Specs launch the app themselves, in hooks or in the test; watch
      // every launch while this test runs
      const launch = _electron.launch;
      _electron.launch = async (...args) => {
        const app = await launch.apply(_electron, args);
        apps.push(app);
        watch(app, collector);
        return app;
      };
      try {
        await use();
      } finally {
        _electron.launch = launch;
      }

      // Apps the test left open
      for (const app of apps) await harvestWindows(app, collector);
      const declared = Object.entries(expectedMessages).map(
        ([reason, expectation]) => ({ ...expectation, reason }),
      );
      await check(
        collector.classify([...BASELINE_EXPECTED, ...declared]),
        testInfo,
      );
    },
    { auto: true },
  ],
  expectedMessages: [{}, { option: true }],
});

async function check(messages: ClassifiedMessage[], testInfo: TestInfo) {
  const unexpected = (level: string) =>
    messages.filter((m) => m.level === level && !m.expectedBecause);
  const errors = unexpected("error");

  if (messages.some((m) => m.level !== "info")) {
    await testInfo.attach("app-messages.json", {
      body: JSON.stringify(messages, null, 2),
      contentType: "application/json",
    });
  }
  for (const m of unexpected("warning")) {
    testInfo.annotations.push({
      description: `${m.source}: ${m.text}`,
      type: "unexpected warning",
    });
  }
  if (errors.length > 0) {
    throw new Error(
      [
        `The app reported ${errors.length} unexpected error(s). Fix them, or ` +
          "declare them in the spec's expectedMessages with a reason. " +
          "Main-process stderr from Chromium or the OS, not Romper, goes " +
          "in tests/validation/support/known-noise.ts instead:",
        ...errors.map((m) => `  [${m.source}] ${m.text}`),
      ].join("\n"),
    );
  }
}

async function harvestWindows(
  app: ElectronApplication,
  collector: MessageCollector,
) {
  for (const page of app.windows()) {
    await collector.harvest(page).catch(() => {});
  }
}

function watch(app: ElectronApplication, collector: MessageCollector) {
  collector.attach(app);
  const attachPage = (page: Page) => {
    // Dialogs are left to the test, or dismissed as Playwright does
    collector.attachPage(page, { acceptDialogs: false }).catch(() => {});
  };
  app.windows().forEach(attachPage);
  app.on("window", attachPage);

  // Toasts and the other UI captures are read from the page, so read them
  // before the window goes
  const close = app.close.bind(app);
  app.close = async () => {
    await harvestWindows(app, collector);
    return close();
  };
}
