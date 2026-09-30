import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Where the app's own renderer page lives, which decides which navigations
 * the main window may make (RE-02).
 *
 * - `dev`: the renderer is served by the Vite dev server, so any URL on that
 *   exact origin (scheme + host + port) is the app.
 * - `file`: the renderer is loaded with `loadFile`, so only that one file is
 *   the app. `URL.origin` is the opaque string `"null"` for every `file:` URL,
 *   so origins can't be compared here; the resolved file path is compared
 *   instead.
 */
export type AppNavigationTarget =
  | { devServerOrigin: string; kind: "dev" }
  | { indexPath: string; kind: "file" };

/**
 * Decide whether the main window may navigate to `targetUrl`.
 *
 * Allowed:
 * - `file` target: a `file:` URL with no host whose path resolves to exactly
 *   `indexPath`. Query strings and hash fragments are ignored, so hash-router
 *   changes still work.
 * - `dev` target: an `http:` URL whose origin equals `devServerOrigin`.
 *
 * Everything else (other local files, other origins, `data:`, `javascript:`,
 * `blob:`, custom schemes, unparseable URLs) is refused.
 */
export function isAllowedAppNavigation(
  targetUrl: string,
  target: AppNavigationTarget,
): boolean {
  const url = parseUrl(targetUrl);
  if (!url) return false;

  if (target.kind === "dev") {
    const devOrigin = parseUrl(target.devServerOrigin);
    return (
      devOrigin !== null &&
      url.protocol === "http:" &&
      devOrigin.protocol === "http:" &&
      url.origin === devOrigin.origin
    );
  }

  if (url.protocol !== "file:") return false;
  // `loadFile` produces host-less URLs; a host would mean a UNC/network path.
  if (url.host !== "") return false;

  let filePath: string;
  try {
    // Strips query and hash; rejects encoded path separators (%2F).
    filePath = fileURLToPath(url);
  } catch {
    return false;
  }
  // `fileURLToPath` output is already absolute with dot segments collapsed;
  // it is compared as-is (not re-resolved) so a trailing slash still fails.
  return filePath === path.resolve(target.indexPath);
}

/** True for URLs that should be handed to the user's browser. */
export function isExternalHttpUrl(targetUrl: string): boolean {
  const url = parseUrl(targetUrl);
  return (
    url !== null && (url.protocol === "http:" || url.protocol === "https:")
  );
}

function parseUrl(value: string): null | URL {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}
