/**
 * Captures every error and warning the app shows or logs during a run:
 * - renderer console warnings and errors, and uncaught page errors;
 * - the main process's stderr (console.warn/error, Chromium) and any stdout
 *   line that mentions an error, warning or failure;
 * - UI surfaces, through a MutationObserver installed in the page, since
 *   toasts disappear after a few seconds: toasts (`message-*`), the error
 *   boundary, the wizard's error and truncation notice, and the write
 *   panel's warnings, errors, invalid files and removals.
 *
 * Each run declares the messages it expects (with a reason); anything else
 * at warning or error level is unexpected and fails the run.
 */
import type {
  ConsoleMessage,
  ElectronApplication,
  Page,
} from "@playwright/test";

export interface CapturedMessage {
  at: string;
  level: Level;
  source: Source;
  step: string;
  /** For UI captures: the element's data-testid */
  testId?: string;
  text: string;
}
export interface ClassifiedMessage extends CapturedMessage {
  expectedBecause?: string;
  ref?: string;
}

export interface Expectation {
  pattern: RegExp;
  /** Why this message is expected */
  reason: string;
  /** Findings register ID when the message comes from a known bug */
  ref?: string;
  /** Limit to these sources; any source when omitted */
  sources?: Source[];
}

export type Level = "error" | "info" | "warning";

export type Source =
  | "main-stderr"
  | "main-stdout"
  | "pageerror"
  | "renderer-console"
  | "ui";

const UI_LEVELS: Record<string, Level> = {
  "bulk-scan-error": "error",
  "card-removals": "info",
  "error-boundary": "error",
  "invalid-files": "warning",
  "message-error": "error",
  "message-info": "info",
  "message-success": "info",
  "message-warning": "warning",
  "summary-error": "error",
  "sync-warnings": "warning",
  "truncation-warnings": "warning",
  "wizard-error": "error",
};

/** Runs in the page: returns entries not yet harvested, with current text */
function harvestEntries(): { at: string; id: string; text: string }[] {
  const w = globalThis as unknown as {
    __harness?: {
      entries: { at: string; el: Element; id: string; text: string }[];
      harvested: number;
    };
  };
  const state = w.__harness;
  if (!state) return [];
  // Text often fills in after the element appears; read it again if the
  // element is still on screen
  for (const e of state.entries) {
    if (e.el.isConnected) {
      const text = (e.el.textContent ?? "").trim();
      if (text) e.text = text;
    }
  }
  const fresh = state.entries.slice(state.harvested);
  state.harvested = state.entries.length;
  return fresh.map(({ at, id, text }) => ({ at, id, text }));
}

/** Runs in the page: records watched elements as they appear */
function installObserver(watchedIds: string[]): void {
  type Entry = { at: string; el: Element; id: string; text: string };
  const w = globalThis as unknown as {
    __harness?: { entries: Entry[]; harvested: number };
  };
  if (w.__harness) return;
  const state = { entries: [] as Entry[], harvested: 0 };
  w.__harness = state;
  const watched = new Set(watchedIds);
  const seen = new WeakSet<Element>();
  const record = (el: Element) => {
    const id = el.getAttribute("data-testid");
    if (!id || !watched.has(id) || seen.has(el)) return;
    seen.add(el);
    state.entries.push({
      at: new Date().toISOString(),
      el,
      id,
      text: (el.textContent ?? "").trim(),
    });
  };
  const scan = (node: Node) => {
    if (!(node instanceof Element)) return;
    record(node);
    node.querySelectorAll("[data-testid]").forEach(record);
  };
  new MutationObserver((mutations) => {
    for (const m of mutations) m.addedNodes.forEach(scan);
  }).observe(document.documentElement, { childList: true, subtree: true });
  scan(document.documentElement);
}

const STDOUT_PROBLEM =
  /\b(error|errors|warn|warning|failed|failure|exception)\b/i;
// Lines that mention a problem word without reporting one
const STDOUT_BENIGN =
  /\b(0 errors|errors: 0|no errors|without errors)\b|\berrors?: (null|undefined|\[\])/i;

export class MessageCollector {
  /** Full logs, for the report folder */
  readonly logs: Record<"main" | "renderer", string[]> = {
    main: [],
    renderer: [],
  };
  readonly messages: CapturedMessage[] = [];
  step = "launch";
  private pages = new Set<Page>();

  attach(app: ElectronApplication): void {
    const proc = app.process();
    proc.stdout?.on("data", (chunk: Buffer) =>
      this.mainOutput("main-stdout", chunk),
    );
    proc.stderr?.on("data", (chunk: Buffer) =>
      this.mainOutput("main-stderr", chunk),
    );
  }

  /**
   * `acceptDialogs` (the default) accepts every confirm(), as a user going
   * ahead would. Off, a dialog is only recorded, and dismissed as Playwright
   * does by default unless the test has its own dialog handler.
   */
  async attachPage(
    page: Page,
    { acceptDialogs = true }: { acceptDialogs?: boolean } = {},
  ): Promise<void> {
    if (this.pages.has(page)) return;
    this.pages.add(page);
    page.on("console", (msg) => {
      const type = msg.type();
      const step = this.step;
      void consoleText(msg).then((text) => {
        this.logs.renderer.push(`[${step}] ${type}: ${text}`);
        if (type === "error" || type === "warning") {
          this.add({
            level: type === "error" ? "error" : "warning",
            source: "renderer-console",
            step,
            text,
          });
        }
      });
    });
    // Playwright dismisses dialogs by default, which would answer "Cancel"
    // to every confirm()
    page.on("dialog", (dialog) => {
      this.add({
        level: dialog.type() === "alert" ? "warning" : "info",
        source: "ui",
        text: `${dialog.type()} dialog: ${dialog.message()}`,
      });
      if (acceptDialogs) {
        void dialog.accept().catch(() => {});
      } else if (page.listenerCount("dialog") === 1) {
        void dialog.dismiss().catch(() => {});
      }
    });
    page.on("pageerror", (error) =>
      this.add({
        level: "error",
        source: "pageerror",
        text: `${error.name}: ${error.message}`,
      }),
    );
    // Reinstall after any reload, and install now for the current document
    page.on("domcontentloaded", () => {
      void page
        .evaluate(installObserver, Object.keys(UI_LEVELS))
        .catch(() => {});
    });
    // The first document may still be loading or replaced during startup
    for (let attempt = 0; ; attempt++) {
      try {
        await page.waitForLoadState("domcontentloaded");
        await page.evaluate(installObserver, Object.keys(UI_LEVELS));
        return;
      } catch (error) {
        if (attempt >= 20) throw error;
        await new Promise((r) => setTimeout(r, 250));
      }
    }
  }

  classify(expectations: Expectation[]): ClassifiedMessage[] {
    return this.messages.map((m) => {
      const match = expectations.find(
        (e) =>
          (!e.sources || e.sources.includes(m.source)) &&
          e.pattern.test(m.text),
      );
      return match
        ? { ...m, expectedBecause: match.reason, ref: match.ref }
        : m;
    });
  }

  /** Pull UI captures out of the page. Call at the end of every step. */
  async harvest(page: Page): Promise<void> {
    const entries = await page.evaluate(harvestEntries).catch(() => []);
    for (const e of entries) {
      this.messages.push({
        at: e.at,
        level: UI_LEVELS[e.id] ?? "info",
        source: "ui",
        step: this.step,
        testId: e.id,
        text: e.text,
      });
    }
  }

  private add(
    m: { step?: string } & Omit<CapturedMessage, "at" | "step">,
  ): void {
    this.messages.push({
      ...m,
      at: new Date().toISOString(),
      step: m.step ?? this.step,
    });
  }

  private mainOutput(source: "main-stderr" | "main-stdout", chunk: Buffer) {
    const text = chunk.toString("utf8").replaceAll(/\u001b\[[0-9;]*m/g, "");
    for (const line of text.split(/\r?\n/)) {
      if (!line.trim()) continue;
      this.logs.main.push(`[${this.step}] ${source}: ${line}`);
      if (source === "main-stderr") {
        this.add({
          level: /warn/i.test(line) ? "warning" : "error",
          source,
          text: line,
        });
      } else if (
        // Not a path that happens to contain "error" (a folder name)
        STDOUT_PROBLEM.test(line.replaceAll(/\S*[/\\]\S*/g, "")) &&
        !STDOUT_BENIGN.test(line)
      ) {
        this.add({ level: "warning", source, text: line });
      }
    }
  }
}

export function isProblem(m: CapturedMessage): boolean {
  return m.level === "error" || m.level === "warning";
}

/**
 * A console message's text with logged objects expanded: `msg.text()`
 * prints them as "[Object]" or "JSHandle@object", which hides what went
 * wrong.
 */
async function consoleText(msg: ConsoleMessage): Promise<string> {
  const text = msg.text();
  if (!/\[Object\]|JSHandle@|\[object Object\]/.test(text)) return text;
  try {
    const parts = await Promise.all(
      msg.args().map(async (arg) => {
        const value: unknown = await arg.jsonValue();
        return typeof value === "string" ? value : JSON.stringify(value);
      }),
    );
    return parts.join(" ");
  } catch {
    return text;
  }
}
