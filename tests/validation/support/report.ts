/**
 * The validation report: steps with timings, checks, and every captured
 * message, written as `report.md` and `report.json` (plus full logs) to the
 * report folder.
 *
 * A check tied to a known bug (`knownBug: "RE-NN"`) that fails is reported
 * as "known" and doesn't fail the run. If it passes, the bug looks fixed and
 * the run fails until the marker is removed, so markers can't go stale.
 */
import fs from "node:fs/promises";
import path from "node:path";

import type { ClassifiedMessage } from "./collector";

import { isProblem } from "./collector";

export interface CheckResult {
  details?: string;
  name: string;
  ref?: string;
  status: CheckStatus;
  step: string;
}

export type CheckStatus = "fail" | "known" | "pass" | "stale-known";

export interface StepResult {
  durationMs: number;
  error?: string;
  name: string;
  notes: string[];
  status: "fail" | "pass";
}

export class ValidationReport {
  readonly checks: CheckResult[] = [];
  readonly facts: Record<string, number | string> = {};
  readonly steps: StepResult[] = [];
  private current: null | StepResult = null;

  constructor(
    readonly dir: string,
    readonly meta: Record<string, string>,
  ) {}

  /**
   * Record a check. Returns whether it passed. Failures are collected, not
   * thrown, so one run reports everything that's wrong.
   */
  check(
    name: string,
    ok: boolean,
    options: { details?: string; knownBug?: string } = {},
  ): boolean {
    let status: CheckStatus;
    if (options.knownBug) {
      status = ok ? "stale-known" : "known";
    } else {
      status = ok ? "pass" : "fail";
    }
    this.checks.push({
      details: options.details,
      name,
      ref: options.knownBug,
      status,
      step: this.current?.name ?? "(after steps)",
    });
    return ok;
  }

  fact(key: string, value: number | string): void {
    this.facts[key] = value;
  }

  failures(messages: ClassifiedMessage[]): string[] {
    const out: string[] = [];
    for (const s of this.steps) {
      if (s.status === "fail") out.push(`Step failed: ${s.name}: ${s.error}`);
    }
    for (const c of this.checks) {
      if (c.status === "fail") {
        out.push(
          `Check failed: ${c.name}${c.details ? ` (${c.details})` : ""}`,
        );
      } else if (c.status === "stale-known") {
        out.push(
          `Check passed but is marked as known bug ${c.ref}: ${c.name}. ` +
            `If ${c.ref} is fixed, remove the knownBug marker.`,
        );
      }
    }
    for (const m of messages) {
      if (isProblem(m) && !m.expectedBecause) {
        out.push(`Unexpected ${m.level} (${m.source}, ${m.step}): ${m.text}`);
      }
    }
    return out;
  }

  note(text: string): void {
    this.current?.notes.push(text);
  }

  async step<T>(name: string, run: () => Promise<T>): Promise<T> {
    const result: StepResult = {
      durationMs: 0,
      name,
      notes: [],
      status: "pass",
    };
    this.steps.push(result);
    this.current = result;
    const started = Date.now();
    try {
      return await run();
    } catch (error) {
      result.status = "fail";
      result.error = error instanceof Error ? error.message : String(error);
      throw error;
    } finally {
      result.durationMs = Date.now() - started;
      this.current = null;
    }
  }

  async write(
    messages: ClassifiedMessage[],
    logs: Record<string, string[]>,
  ): Promise<void> {
    await fs.mkdir(this.dir, { recursive: true });
    const failures = this.failures(messages);
    await fs.writeFile(
      path.join(this.dir, "report.json"),
      JSON.stringify(
        {
          checks: this.checks,
          facts: this.facts,
          failures,
          messages,
          meta: this.meta,
          steps: this.steps,
        },
        null,
        2,
      ),
    );
    for (const [name, lines] of Object.entries(logs)) {
      await fs.writeFile(path.join(this.dir, `${name}.log`), lines.join("\n"));
    }
    await fs.writeFile(
      path.join(this.dir, "report.md"),
      this.markdown(messages, failures),
    );
  }

  private checksSection(): string[] {
    const lines: string[] = [];
    if (Object.keys(this.facts).length > 0) {
      lines.push("## Counts", "", "| | |", "|---|---|");
      for (const [k, v] of Object.entries(this.facts)) {
        lines.push(`| ${k} | ${v} |`);
      }
      lines.push("");
    }
    lines.push("## Checks", "", "| Step | Check | Result |", "|---|---|---|");
    for (const c of this.checks) {
      const result = c.ref ? `${c.status} (${c.ref})` : c.status;
      lines.push(
        `| ${c.step} | ${escape(c.name)}${c.details ? `: ${escape(c.details)}` : ""} | ${result} |`,
      );
    }
    lines.push("");
    return lines;
  }

  private markdown(messages: ClassifiedMessage[], failures: string[]): string {
    return [
      ...this.summarySection(failures),
      ...this.stepsSection(),
      ...this.checksSection(),
      ...messagesSection(messages),
    ].join("\n");
  }

  private stepsSection(): string[] {
    const lines = ["## Steps", "", "| Step | Result | Time |", "|---|---|---|"];
    for (const s of this.steps) {
      lines.push(
        `| ${s.name} | ${s.status}${s.error ? `: ${escape(s.error)}` : ""} | ${(s.durationMs / 1000).toFixed(1)} s |`,
      );
    }
    lines.push("");
    for (const s of this.steps.filter((step) => step.notes.length > 0)) {
      lines.push(`**${s.name}**`, "", ...s.notes.map((n) => `- ${n}`), "");
    }
    return lines;
  }

  private summarySection(failures: string[]): string[] {
    const lines: string[] = [];
    const verdict = failures.length === 0 ? "PASSED" : "FAILED";
    lines.push(`# Full-pipeline validation: ${verdict}`, "");
    for (const [k, v] of Object.entries(this.meta)) lines.push(`- ${k}: ${v}`);
    lines.push("");

    if (failures.length > 0) {
      lines.push("## Failures", "");
      for (const f of failures) lines.push(`- ${f}`);
      lines.push("");
    }

    // The same known failure shows up in every comparison; list it once
    const known = [
      ...new Map(
        this.checks
          .filter((c) => c.status === "known")
          .map((c) => [`${c.ref} ${c.name} ${c.details}`, c]),
      ).values(),
    ];
    if (known.length > 0) {
      lines.push("## Known bugs seen", "");
      for (const c of known) {
        lines.push(
          `- **${c.ref}** ${c.name}${c.details ? `: ${c.details}` : ""}`,
        );
      }
      lines.push("");
    }
    return lines;
  }
}

function escape(text: string): string {
  return text.replaceAll("|", "\\|").replaceAll(/\r?\n/g, " ");
}

function messagesSection(messages: ClassifiedMessage[]): string[] {
  const problems = messages.filter(isProblem);
  const lines = [
    "## Errors and warnings",
    "",
    `${problems.length} captured, ${problems.filter((m) => !m.expectedBecause).length} unexpected.`,
    "",
    "| Step | Source | Level | Message | Expected because |",
    "|---|---|---|---|---|",
  ];
  for (const m of problems) {
    const why = m.expectedBecause
      ? `${m.expectedBecause}${m.ref ? ` (${m.ref})` : ""}`
      : "**unexpected**";
    lines.push(
      `| ${m.step} | ${m.source}${m.testId ? ` \`${m.testId}\`` : ""} | ${m.level} | ${escape(m.text.slice(0, 300))} | ${escape(why)} |`,
    );
  }
  lines.push("");
  return lines;
}
