/**
 * Known noise: lines the main process writes to stderr that come from
 * Chromium, the operating system or the test harness, not from Romper.
 *
 * The rule, applied by `MessageCollector.classify` for the e2e error guard
 * and the validation runs alike:
 * - main-process stderr that matches an entry here, on one of the entry's
 *   platforms, is ignored (shown as expected, with the entry's reason);
 * - every other stderr line stays an error (or a warning, if it says so);
 * - nothing here applies to renderer console errors, page errors or the
 *   UI. Those are Romper's own; a spec that expects one declares it in its
 *   `expectedMessages`.
 *
 * Adding an entry (see docs/developer/coding-guide.md, "Known noise"):
 * - only for a line Romper doesn't write and can't prevent: Chromium's
 *   own logging, the OS, the harness. A Romper error, even an expected
 *   one, belongs in the spec that expects it;
 * - one entry per source (the component that writes the line), so a new
 *   line from a listed source widens that entry's pattern;
 * - a pattern as narrow as the line allows (the Chromium file name, the
 *   message), platforms where it's been seen or its cause applies, a
 *   reason, and a link to the issue, upstream bug or upstream code that
 *   logs it where there is one;
 * - a real example line, which the unit test checks the pattern matches.
 */

export interface KnownNoise {
  /** Real lines from a run, which the pattern must match */
  examples: string[];
  /** The issue, upstream bug or upstream code behind the line */
  link?: string;
  /** Matches one stderr line, as narrowly as the line allows */
  pattern: RegExp;
  /** Where the line is ignored: where it's been seen, or its cause applies */
  platforms: Platform[];
  /** Why it isn't Romper's error */
  reason: string;
  /** What writes the line, e.g. "Chromium GPU client" */
  source: string;
}

export type Platform = "darwin" | "linux" | "win32";

export const PLATFORMS: readonly Platform[] = ["darwin", "linux", "win32"];

const CHROMIUM_SOURCE =
  "https://source.chromium.org/chromium/chromium/src/+/main:";

export const KNOWN_NOISE: KnownNoise[] = [
  {
    examples: [
      '[3669:1001/183927.069347:ERROR:dbus/bus.cc:406] Failed to connect to the bus: Could not parse server address: Unknown address type (examples of valid types are "tcp" and on UNIX "unix")',
      "[3669:1001/183927.467696:ERROR:dbus/object_proxy.cc:572] Failed to call method: org.freedesktop.DBus.NameHasOwner: object_path= /org/freedesktop/DBus: unknown error type: ",
    ],
    link: `${CHROMIUM_SOURCE}dbus/bus.cc`,
    pattern: /:ERROR:dbus\/(bus|object_proxy)\.cc:\d+\]/,
    platforms: ["linux"],
    reason: "Linux CI runners have no D-Bus session for Chromium to connect to",
    source: "Chromium D-Bus client",
  },
  {
    examples: [
      "[4063:1001/200346.787692:ERROR:gpu/ipc/client/command_buffer_proxy_impl.cc:285] ContextResult::kTransientFailure: Failed to send GpuControl.CreateCommandBuffer.",
      "[7167:1003/135553.496539:ERROR:gpu/ipc/client/command_buffer_proxy_impl.cc:490] GPU state invalid after WaitForGetOffsetInRange.",
      // macOS: https://github.com/peteb4ker/romper/actions/runs/37652084347
      "[3874:1007/164046.874962:ERROR:gpu/ipc/client/command_buffer_proxy_impl.cc:490] GPU state invalid after WaitForGetOffsetInRange.",
    ],
    link: `${CHROMIUM_SOURCE}gpu/ipc/client/command_buffer_proxy_impl.cc`,
    pattern:
      /:ERROR:gpu\/ipc\/client\/command_buffer_proxy_impl\.cc:\d+\] (ContextResult::kTransientFailure|GPU state invalid after WaitForGetOffsetInRange)/,
    platforms: ["darwin", "linux"],
    reason:
      "Chromium's GPU process fails on the GPU-less Linux CI runners, and on the virtualized macOS runners (#690), at a time that depends on load",
    source: "Chromium GPU client",
  },
  {
    examples: [
      '[3669:1001/183952.828516:ERROR:sandbox/mac/system_services.cc:35] SetApplicationIsDaemon: Error Domain=NSOSStatusErrorDomain Code=-50 "paramErr: error in user parameter list" (-50)',
    ],
    link: `${CHROMIUM_SOURCE}sandbox/mac/system_services.cc`,
    pattern:
      /:ERROR:sandbox\/mac\/system_services\.cc:\d+\] SetApplicationIsDaemon/,
    platforms: ["darwin"],
    reason:
      "Chromium logs this on macOS when the app runs as an accessory, as it does with the e2e's hidden window",
    source: "Chromium macOS sandbox",
  },
  {
    examples: [
      "[7067:1003/160112.005806:ERROR:base/apple/mach_port_rendezvous.cc:149] mach_msg send: (ipc/send) invalid destination port (0x10000003)",
    ],
    link: `${CHROMIUM_SOURCE}base/apple/mach_port_rendezvous.cc`,
    pattern:
      /:ERROR:base\/apple\/mach_port_rendezvous\.cc:\d+\] mach_msg send: \(ipc\/send\) invalid destination port/,
    platforms: ["darwin"],
    reason:
      "Chromium logs this on macOS when a helper process it signals has already exited; it lands on whichever spec is running",
    source: "Chromium mach port rendezvous",
  },
  {
    examples: [
      "[33352:1003/151539.925999:ERROR:third_party/blink/renderer/modules/media/audio/mojo_audio_output_ipc.cc:186] MojoAudioOutputIPC failed to acquire factory",
    ],
    link: `${CHROMIUM_SOURCE}third_party/blink/renderer/modules/media/audio/mojo_audio_output_ipc.cc`,
    pattern:
      /:ERROR:third_party\/blink\/renderer\/modules\/media\/audio\/mojo_audio_output_ipc\.cc:\d+\] MojoAudioOutputIPC failed to acquire factory$/,
    platforms: ["darwin", "linux", "win32"],
    reason:
      "Blink logs this when an audio output asks for its device and the frame's audio factory isn't there, which a window that's closing or still starting can hit. Seen on macOS (#516); the race isn't platform-specific",
    source: "Blink audio output IPC",
  },
  {
    examples: [
      "[9348:1004/011137.026135:ERROR:components/viz/service/display/display.cc:271] Frame latency is negative: -0.083 ms",
    ],
    link: "https://github.com/peteb4ker/romper/issues/561",
    pattern:
      /:ERROR:components\/viz\/service\/display\/display\.cc:\d+\] Frame latency is negative: -?[\d.]+ ms$/,
    platforms: ["darwin"],
    reason:
      "Chromium's compositor logs this timing check on macOS when a frame's timestamps arrive out of order; it has no effect on the app",
    source: "Chromium viz",
  },
  {
    examples: [
      "2026-10-03 16:05:20.335 Electron[19975:54134] NSSpellServer dataFromCheckingString timed out, index is 1",
      "2026-10-03 16:05:20.852 Electron[19975:54134] NSSpellServer dataFromCheckingString succeeded, index is 0",
    ],
    link: "https://github.com/peteb4ker/romper/issues/544",
    pattern:
      / \S+\[\d+:\d+\] NSSpellServer dataFromCheckingString (timed out|succeeded), index is \d+$/,
    platforms: ["darwin"],
    reason:
      "AppKit's spell checker logs this when it's slow to check text typed into a field, as on a busy macOS runner",
    source: "macOS spell server",
  },
  {
    examples: [
      "Debugger listening on ws://127.0.0.1:50123/1b6f5c9e-4f7a-4a43-9f0c-1f4b2a0d9e11",
      "For help, see: https://nodejs.org/en/docs/inspector",
      "Debugger ending on ws://127.0.0.1:50123/1b6f5c9e-4f7a-4a43-9f0c-1f4b2a0d9e11",
      "Waiting for the debugger to disconnect...",
    ],
    pattern:
      /^(Debugger (listening|ending) on ws:|For help, see: https:\/\/nodejs\.org|Waiting for the debugger to disconnect)/,
    platforms: ["darwin", "linux", "win32"],
    reason: "Playwright drives the main process through the Node inspector",
    source: "Node inspector (Playwright)",
  },
];

/**
 * The known-noise entry a main-process stderr line matches on this
 * platform, if any
 */
export function matchKnownNoise(
  line: string,
  platform: string = process.platform,
  entries: KnownNoise[] = KNOWN_NOISE,
): KnownNoise | undefined {
  return entries.find(
    (entry) =>
      (entry.platforms as string[]).includes(platform) &&
      entry.pattern.test(line),
  );
}
