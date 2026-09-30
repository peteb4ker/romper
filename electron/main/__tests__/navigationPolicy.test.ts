import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

import {
  type AppNavigationTarget,
  isAllowedAppNavigation,
  isExternalHttpUrl,
} from "../navigationPolicy";

const INDEX_PATH =
  "/Applications/Romper.app/Contents/Resources/renderer/index.html";
const INDEX_URL = pathToFileURL(INDEX_PATH).href;
const fileTarget: AppNavigationTarget = { indexPath: INDEX_PATH, kind: "file" };
const devTarget: AppNavigationTarget = {
  devServerOrigin: "http://localhost:5173",
  kind: "dev",
};

describe("isAllowedAppNavigation (RE-02)", () => {
  describe("packaged build (file: target)", () => {
    it("allows the app's own index.html", () => {
      expect(isAllowedAppNavigation(INDEX_URL, fileTarget)).toBe(true);
    });

    it("allows index.html with a hash route or query string", () => {
      expect(isAllowedAppNavigation(`${INDEX_URL}#/kits`, fileTarget)).toBe(
        true,
      );
      expect(isAllowedAppNavigation(`${INDEX_URL}#/about`, fileTarget)).toBe(
        true,
      );
      expect(
        isAllowedAppNavigation(`${INDEX_URL}?reload=1#/`, fileTarget),
      ).toBe(true);
    });

    it("handles install paths with spaces and non-ASCII characters", () => {
      const indexPath = "/Users/Zoë/My Apps/Romper.app/renderer/index.html";
      const target: AppNavigationTarget = { indexPath, kind: "file" };
      const url = pathToFileURL(indexPath).href;
      expect(url).toContain("%20");
      expect(isAllowedAppNavigation(`${url}#/kits`, target)).toBe(true);
      expect(
        isAllowedAppNavigation(url.replace("My%20Apps", "Other"), target),
      ).toBe(false);
    });

    it("allows a host of localhost, which URL parsing drops for file:", () => {
      expect(
        isAllowedAppNavigation(`file://localhost${INDEX_PATH}`, fileTarget),
      ).toBe(true);
    });

    it("blocks any other local file (the RE-02 hole: origin is 'null' for all file: URLs)", () => {
      expect(new URL("file:///tmp/evil.html").origin).toBe(
        new URL(INDEX_URL).origin,
      );
      expect(isAllowedAppNavigation("file:///tmp/evil.html", fileTarget)).toBe(
        false,
      );
      expect(
        isAllowedAppNavigation("file:///Users/me/Downloads/x.html", fileTarget),
      ).toBe(false);
    });

    it("blocks other files next to index.html", () => {
      const sibling = INDEX_URL.replace("index.html", "other.html");
      expect(isAllowedAppNavigation(sibling, fileTarget)).toBe(false);
      const asset = INDEX_URL.replace("index.html", "assets/index.js");
      expect(isAllowedAppNavigation(asset, fileTarget)).toBe(false);
    });

    it("blocks look-alike paths that merely end in renderer/index.html", () => {
      expect(
        isAllowedAppNavigation("file:///tmp/renderer/index.html", fileTarget),
      ).toBe(false);
      expect(
        isAllowedAppNavigation(`file:///tmp${INDEX_PATH}`, fileTarget),
      ).toBe(false);
      expect(isAllowedAppNavigation(`${INDEX_URL}.html`, fileTarget)).toBe(
        false,
      );
      expect(isAllowedAppNavigation(`${INDEX_URL}/`, fileTarget)).toBe(false);
    });

    it("blocks ../ traversal that starts at index.html but leaves it", () => {
      expect(
        isAllowedAppNavigation(`${INDEX_URL}/../../evil.html`, fileTarget),
      ).toBe(false);
      expect(
        isAllowedAppNavigation(`${INDEX_URL}/../evil.html`, fileTarget),
      ).toBe(false);
      expect(
        isAllowedAppNavigation(
          `${INDEX_URL}/%2e%2e/%2e%2e/%2e%2e/tmp/evil.html`,
          fileTarget,
        ),
      ).toBe(false);
      expect(
        isAllowedAppNavigation(
          "file:///Applications/Romper.app/Contents/Resources/renderer/../../../../../tmp/index.html",
          fileTarget,
        ),
      ).toBe(false);
    });

    it("compares the normalized path, so ../ that lands back on index.html is the same file", () => {
      // WHATWG URL parsing collapses dot segments before we see the path, so
      // this is literally the app's own page, not a bypass.
      expect(
        isAllowedAppNavigation(
          "file:///Applications/Romper.app/Contents/Resources/renderer/../renderer/index.html",
          fileTarget,
        ),
      ).toBe(true);
    });

    it("blocks encoded path separators", () => {
      const encoded = INDEX_URL.replace("/renderer/", "/renderer%2F");
      expect(isAllowedAppNavigation(encoded, fileTarget)).toBe(false);
    });

    it("blocks file: URLs with a network host (UNC paths)", () => {
      expect(
        isAllowedAppNavigation(`file://evil.example${INDEX_PATH}`, fileTarget),
      ).toBe(false);
    });

    it("blocks case variants of the path (fail closed on case-insensitive disks)", () => {
      expect(
        isAllowedAppNavigation(INDEX_URL.replace("index", "INDEX"), fileTarget),
      ).toBe(false);
    });

    it("blocks data:, javascript:, blob:, about: and custom schemes", () => {
      for (const url of [
        "data:text/html,<script>alert(1)</script>",
        "data:text/html;base64,PGgxPmhpPC9oMT4=",
        "javascript:alert(1)",
        "blob:file:///1234-5678",
        "about:blank",
        "chrome://settings",
        "devtools://devtools/bundled/inspector.html",
        "romper://index.html",
        "ftp://example.com/index.html",
      ]) {
        expect(isAllowedAppNavigation(url, fileTarget), url).toBe(false);
      }
    });

    it("blocks http(s) URLs, including the dev server", () => {
      expect(isAllowedAppNavigation("https://example.com/", fileTarget)).toBe(
        false,
      );
      expect(isAllowedAppNavigation("http://localhost:5173/", fileTarget)).toBe(
        false,
      );
    });

    it("blocks empty and unparseable URLs", () => {
      expect(isAllowedAppNavigation("", fileTarget)).toBe(false);
      expect(isAllowedAppNavigation("not a url", fileTarget)).toBe(false);
      expect(isAllowedAppNavigation("/relative/index.html", fileTarget)).toBe(
        false,
      );
    });
  });

  describe("development (dev-server target)", () => {
    it("allows the dev-server origin, with any path, query or hash", () => {
      expect(isAllowedAppNavigation("http://localhost:5173", devTarget)).toBe(
        true,
      );
      expect(isAllowedAppNavigation("http://localhost:5173/", devTarget)).toBe(
        true,
      );
      expect(
        isAllowedAppNavigation("http://localhost:5173/#/kits", devTarget),
      ).toBe(true);
      expect(
        isAllowedAppNavigation(
          "http://localhost:5173/index.html?x=1",
          devTarget,
        ),
      ).toBe(true);
    });

    it("blocks other ports, hosts and schemes on the same host", () => {
      for (const url of [
        "http://localhost:5174/",
        "http://localhost/",
        "https://localhost:5173/",
        "http://127.0.0.1:5173/",
        "http://localhost.evil.example:5173/",
        "http://evil.example/",
        "https://example.com/",
        "ws://localhost:5173/",
      ]) {
        expect(isAllowedAppNavigation(url, devTarget), url).toBe(false);
      }
    });

    it("blocks userinfo tricks that point at another host", () => {
      expect(
        isAllowedAppNavigation(
          "http://localhost:5173@evil.example/",
          devTarget,
        ),
      ).toBe(false);
    });

    it("blocks file:, data: and javascript: URLs in dev too", () => {
      expect(isAllowedAppNavigation(INDEX_URL, devTarget)).toBe(false);
      expect(isAllowedAppNavigation("file:///tmp/evil.html", devTarget)).toBe(
        false,
      );
      expect(isAllowedAppNavigation("data:text/html,hi", devTarget)).toBe(
        false,
      );
      expect(isAllowedAppNavigation("javascript:alert(1)", devTarget)).toBe(
        false,
      );
    });

    it("honours a non-default dev-server port", () => {
      const target: AppNavigationTarget = {
        devServerOrigin: "http://localhost:5199",
        kind: "dev",
      };
      expect(isAllowedAppNavigation("http://localhost:5199/#/", target)).toBe(
        true,
      );
      expect(isAllowedAppNavigation("http://localhost:5173/#/", target)).toBe(
        false,
      );
    });

    it("blocks everything when the configured dev origin is malformed or not http", () => {
      expect(
        isAllowedAppNavigation("http://localhost:5173/", {
          devServerOrigin: "not a url",
          kind: "dev",
        }),
      ).toBe(false);
      expect(
        isAllowedAppNavigation("file:///tmp/x.html", {
          devServerOrigin: "file:///tmp/x.html",
          kind: "dev",
        }),
      ).toBe(false);
    });
  });
});

describe("isExternalHttpUrl", () => {
  it("accepts http and https URLs", () => {
    expect(isExternalHttpUrl("https://squarp.net/rample/manual/")).toBe(true);
    expect(isExternalHttpUrl("HTTP://EXAMPLE.COM")).toBe(true);
  });

  it("rejects everything else", () => {
    for (const url of [
      "file:///tmp/evil.html",
      "data:text/html,hi",
      "javascript:alert(1)",
      "mailto:someone@example.com",
      "smb://server/share",
      "",
      "not a url",
    ]) {
      expect(isExternalHttpUrl(url), url).toBe(false);
    }
  });
});
