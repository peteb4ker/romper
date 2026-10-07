import type { ElectronApplication } from "@playwright/test";

import { EventEmitter } from "node:events";
import { describe, expect, it } from "vitest";

import { MessageCollector } from "../collector";
import { KNOWN_NOISE, matchKnownNoise, PLATFORMS } from "../known-noise";

// The e2e error guard and the validation runs ignore main-process stderr
// that matches this list, so every entry has to say why, and the list must
// not swallow anything else.

/** A collector fed these lines on the app's stdout and stderr */
function collect(lines: { stderr?: string[]; stdout?: string[] }) {
  const stdout = new EventEmitter();
  const stderr = new EventEmitter();
  const app = {
    process: () => ({ stderr, stdout }),
  } as unknown as ElectronApplication;
  const collector = new MessageCollector();
  collector.attach(app);
  for (const line of lines.stderr ?? []) {
    stderr.emit("data", Buffer.from(`${line}\n`));
  }
  for (const line of lines.stdout ?? []) {
    stdout.emit("data", Buffer.from(`${line}\n`));
  }
  return collector;
}

describe("[Q-07] known noise", () => {
  describe.each(KNOWN_NOISE.map((entry) => [entry.source, entry] as const))(
    "%s",
    (_source, entry) => {
      it("says why it isn't Romper's error", () => {
        expect(entry.reason.trim().length).toBeGreaterThan(20);
      });

      it("lists the platforms it applies to", () => {
        expect(entry.platforms.length).toBeGreaterThan(0);
        for (const platform of entry.platforms) {
          expect(PLATFORMS).toContain(platform);
        }
        expect(new Set(entry.platforms).size).toBe(entry.platforms.length);
      });

      it("matches each of its example lines", () => {
        expect(entry.examples.length).toBeGreaterThan(0);
        for (const line of entry.examples) {
          expect(line).toMatch(entry.pattern);
        }
      });

      it("is ignored on its platforms only", () => {
        const line = entry.examples[0];
        for (const platform of PLATFORMS) {
          const match = matchKnownNoise(line, platform);
          if (entry.platforms.includes(platform)) {
            expect(match).toBe(entry);
          } else {
            expect(match).toBeUndefined();
          }
        }
      });

      it("links to an issue or upstream source, if it has a link", () => {
        if (entry.link) expect(entry.link).toMatch(/^https:\/\//);
      });
    },
  );

  it("has one entry per source", () => {
    const sources = KNOWN_NOISE.map((entry) => entry.source);
    expect(new Set(sources).size).toBe(sources.length);
  });

  it("covers the spell server and audio IPC lines that failed macOS runs (#544)", () => {
    expect(
      matchKnownNoise(
        "2026-10-03 22:27:44.519 Electron[16090:46112] NSSpellServer dataFromCheckingString timed out, index is 1",
        "darwin",
      )?.source,
    ).toBe("macOS spell server");
    expect(
      matchKnownNoise(
        "[33352:1003/151539.925999:ERROR:third_party/blink/renderer/modules/media/audio/mojo_audio_output_ipc.cc:186] MojoAudioOutputIPC failed to acquire factory",
        "darwin",
      )?.source,
    ).toBe("Blink audio output IPC");
  });

  it("covers the GPU client line that failed a macOS run (#690)", () => {
    const line =
      "[3874:1007/164046.874962:ERROR:gpu/ipc/client/command_buffer_proxy_impl.cc:490] GPU state invalid after WaitForGetOffsetInRange.";
    expect(matchKnownNoise(line, "darwin")?.source).toBe("Chromium GPU client");
    expect(matchKnownNoise(line, "win32")).toBeUndefined();
  });
});

describe("[Q-07] MessageCollector.classify with known noise", () => {
  const noise = KNOWN_NOISE.find((entry) => entry.platforms.length === 3)!;
  const noiseLine = noise.examples[0];

  it("ignores main-process stderr that matches an entry", () => {
    const [message] = collect({ stderr: [noiseLine] }).classify([], "linux");
    expect(message.source).toBe("main-stderr");
    expect(message.expectedBecause).toContain(noise.reason);
  });

  it("still reports a stderr line that matches no entry as an error", () => {
    const [message] = collect({
      stderr: ["[123:1003/120000.000000:ERROR:romper/main.cc:1] Not noise"],
    }).classify([], "darwin");
    expect(message).toMatchObject({ level: "error", source: "main-stderr" });
    expect(message.expectedBecause).toBeUndefined();
  });

  it("still reports an entry's line on a platform the entry doesn't list", () => {
    const macOnly = KNOWN_NOISE.find(
      (entry) => !entry.platforms.includes("linux"),
    )!;
    const [message] = collect({ stderr: [macOnly.examples[0]] }).classify(
      [],
      "linux",
    );
    expect(message.level).toBe("error");
    expect(message.expectedBecause).toBeUndefined();
  });

  it("doesn't apply to the renderer or stdout", () => {
    const collector = collect({ stdout: [`${noiseLine} failed`] });
    collector.messages.push({
      at: new Date().toISOString(),
      level: "error",
      source: "renderer-console",
      step: "test",
      text: noiseLine,
    });
    const messages = collector.classify([], "linux");
    expect(messages.map((m) => m.source)).toEqual([
      "main-stdout",
      "renderer-console",
    ]);
    for (const message of messages) {
      expect(message.expectedBecause).toBeUndefined();
    }
  });
});
