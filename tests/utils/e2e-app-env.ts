/**
 * The environment an e2e spec launches the app with: the runner's own, which
 * carries ROMPER_HEADLESS and ROMPER_USER_DATA_DIR from playwright.config.ts,
 * plus the spec's overrides.
 *
 * Electron's launch `env` takes only strings, while a `process.env` value
 * may be undefined, so unset variables are left out rather than spread in.
 */
export function appEnv(
  overrides: Record<string, string> = {},
  { omit = [] }: { omit?: readonly string[] } = {},
): Record<string, string> {
  const inherited = Object.entries(process.env).filter(
    (entry): entry is [string, string] =>
      entry[1] !== undefined && !omit.includes(entry[0]),
  );
  return { ...Object.fromEntries(inherited), ...overrides };
}
