// Setup for integration tests only (VITEST_MODE=integration), after
// vitest.setup.ts.
//
// Each store keeps one database connection open (RE-81), and Windows can't
// delete an open database file. So that no test has to remember to close
// connections before deleting its temp store, the integration runner
// (runner.ts) closes them all when each test's body ends, before any
// afterEach hook runs. This file gives the runner this test file's copy of
// the connection registry to close.
import { closeAllDbConnections } from "../../../electron/main/db/utils/dbConnections.js";
import { registerDbConnectionCloser } from "./dbConnectionCloser.js";

registerDbConnectionCloser(closeAllDbConnections);
