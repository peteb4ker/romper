import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { addKit, getKit } from "../../db/romperDbCoreORM.js";
import { closeAllDbConnections } from "../../db/utils/dbConnections.js";
import { LocalStoreSetupService } from "../localStoreSetupService.js";

// RE-10: pointing setup at a folder that already has a store used to hit a
// primary-key clash on the first kit insert, and the failure cleanup then
// deleted the user's database. Real database, real filesystem.
describe("[UC-01] [UC-02] [UC-03] LocalStoreSetupService with a real database (RE-10)", () => {
  let tmpRoot: string;
  let target: string;
  let dbDir: string;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "romper-setup-int-"));
    target = path.join(tmpRoot, "store");
    fs.mkdirSync(target);
    dbDir = path.join(target, ".romperdb");
  });

  afterEach(() => {
    // Windows can't delete a database file that's still open
    closeAllDbConnections();
    fs.rmSync(tmpRoot, { force: true, recursive: true });
  });

  it("never lets a second setup touch an existing store", () => {
    // An earlier session set up the store and the user added a kit
    const firstSession = new LocalStoreSetupService();
    expect(firstSession.createSetupDatabase(dbDir).success).toBe(true);
    expect(addKit(dbDir, { bank_letter: "A", name: "A0" }).success).toBe(true);

    // A later session runs the wizard against the same folder
    const laterSession = new LocalStoreSetupService();
    expect(laterSession.hasExistingLocalStore(target).exists).toBe(true);
    expect(laterSession.createSetupDatabase(dbDir).success).toBe(false);
    expect(laterSession.cleanupFailedSetup(target).removed).toBe(false);

    // The store and its kit survive
    const kit = getKit(dbDir, "A0");
    expect(kit.success).toBe(true);
    expect(kit.data?.name).toBe("A0");
  });

  it("moves a failed run's database aside so a retry starts fresh", () => {
    const service = new LocalStoreSetupService();
    expect(service.createSetupDatabase(dbDir).success).toBe(true);

    const cleanup = service.cleanupFailedSetup(target);
    expect(cleanup.removed).toBe(true);
    expect(fs.existsSync(dbDir)).toBe(false);
    expect(fs.existsSync(cleanup.movedTo!)).toBe(true);

    // Retry
    expect(service.hasExistingLocalStore(target).exists).toBe(false);
    expect(service.createSetupDatabase(dbDir).success).toBe(true);
    expect(addKit(dbDir, { bank_letter: "A", name: "A0" }).success).toBe(true);
  });
});
