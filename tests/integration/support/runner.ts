// The Vitest runner for integration tests: the default runner, plus closing
// every store connection when a test's body ends.
//
// Windows can't delete an open database file, and each store keeps its
// connection open (RE-81), so a test that deletes its temp store in
// afterEach must close connections first. An afterEach in a setup file
// can't do it: setup-file hooks belong to the file's root suite, and Vitest
// runs a test's own afterEach hooks (innermost describe first) before the
// root suite's. `onTaskFinished` runs after the test body, passed or
// failed, and before any afterEach hook, so the connections are always
// closed by the time a test's own cleanup deletes files.
import type { RunnerTestCase } from "vitest";

import { VitestTestRunner } from "vitest/runners";

import { closeRegisteredDbConnections } from "./dbConnectionCloser.js";

export default class IntegrationTestRunner extends VitestTestRunner {
  onTaskFinished(_test: RunnerTestCase): void {
    closeRegisteredDbConnections();
  }
}
