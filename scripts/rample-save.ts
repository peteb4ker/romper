/**
 * Print a copy of the Rample's `_save` folder, decoded, or the differences
 * between two copies (#788). Read-only. See
 * docs/developer/rample-save-integration.md, "Hardware verification
 * protocol".
 *
 * Usage:
 *   npm run rample:save -- <_save folder> [<another copy>]
 */

import { runRampleSaveCli } from "../electron/main/rample/rampleSaveCli.js";

process.exitCode = await runRampleSaveCli(process.argv.slice(2), (line) =>
  console.log(line),
);
