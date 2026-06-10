import type { ElectronAPI } from "@romper/shared/electronApi.js";

// The canonical contract lives in shared/electronApi.ts and is ENFORCED on
// the preload via `satisfies ElectronAPI` — this file only attaches it to the
// renderer's globals. Do not redeclare API methods here.

export type { ElectronAPI } from "@romper/shared/electronApi.js";

declare global {
  interface ImportMeta {
    env: {
      VITE_APP_VERSION?: string;
    };
  }

  interface Window {
    electronAPI: ElectronAPI;
    electronFileAPI?: {
      getDroppedFilePath: (file: File) => Promise<string>;
    };
  }

  // In the renderer `globalThis === window`, so the preload-injected bridges
  // are also reachable as `globalThis.electronAPI` / `globalThis.electronFileAPI`.
  // Declared as globals so code can prefer `globalThis` over `window` (S7764).

  var electronAPI: ElectronAPI;

  var electronFileAPI:
    | {
        getDroppedFilePath: (file: File) => Promise<string>;
      }
    | undefined;
}
