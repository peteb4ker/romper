import type { StoreCheckKitFinding } from "@romper/shared/electronApi";

/** A kit's store check finding with nothing found, with `overrides` on it */
export function createStoreCheckFinding(
  overrides: { kitName: string } & Partial<StoreCheckKitFinding>,
): StoreCheckKitFinding {
  return {
    folderMissing: false,
    missing: 0,
    notConnected: [],
    notResponding: [],
    quarantined: false,
    unavailableVolumes: [],
    unreadable: 0,
    untracked: [],
    ...overrides,
  };
}
