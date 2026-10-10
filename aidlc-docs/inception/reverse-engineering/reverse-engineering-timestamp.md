# Reverse Engineering Metadata

> **Dated snapshot, not maintained.** This file describes `main` at commit
> `87bea51` (2026-09-29) and hasn't been kept up to date since. For current
> behaviour read the code on `main`; for what's still open, see
> [GitHub issues](https://github.com/peteb4ker/romper/issues).

**Analysis Date**: 2026-09-29T00:00:00Z
**Analyzer**: Claude Code (Claude Opus 5.5), five parallel read-only reviews plus hand verification
**Workspace**: ~/workspace/romper
**Baseline**: `main` @ `87bea51` (app version 1.3.1). The only later commit at the time of writing, `674f2b7`, bumps `brace-expansion` in the lockfile.
**Previous analysis**: 2026-04-08 (app version 1.0.1). All artifacts were rewritten.
**Total Files Analyzed**: 244 TypeScript source files (about 35,200 LOC), 273 test files (238 unit, 27 integration, 8 e2e), 12 SQL migrations, 8 CI workflows, build and packaging configs, and the developer and user docs.

## Measurements taken
- `npm run test`: 3,453 unit and 534 integration tests, all passing; merged coverage 89.67% statements, 80.94% branches, 87.89% functions, 90.44% lines.
- `npm run lint:check`: 0 problems.
- `npm audit`: 45 advisories (1 critical, 30 high, 10 moderate, 4 low); 7 on production paths.
- `npm outdated`: 30 packages at least one major version behind.
- Test code type-check (scratch tsconfig): 3,048 errors in 195 files.
- Bundled runtime: Electron 39.8.10, Node 22.22.1, Chromium 142.
- The SonarQube MCP server was unavailable, so complexity figures are from line counts, not Sonar.

## Artifacts Generated
- [x] business-overview.md
- [x] architecture.md
- [x] code-structure.md
- [x] api-documentation.md
- [x] component-inventory.md
- [x] technology-stack.md
- [x] dependencies.md
- [x] code-quality-assessment.md

## Key Findings
- Mature Electron 39 + React 19 + TypeScript app with a sandboxed renderer, a typed 62-channel IPC bridge, strict typing, clean lint and about 4,000 passing tests.
- **Critical**: the "clear SD card before writing" option deletes everything in whatever folder is chosen (RE-01).
- **High, security**: in packaged builds any local `file://` page passes the navigation guard with the full bridge, and the bridge lets the renderer read and write arbitrary paths (RE-02, RE-03).
- **High, data safety**: Scan and Scan All discard kit edits; sync is add-only, uses a layout import cannot read, blocks the main process, aborts on common WAV variants and hides missing-file errors; a failed setup can delete an existing database (RE-04 to RE-10).
- **High, user experience**: toast messages never appear and there is no error boundary (RE-11, RE-12). The voice choke can fail after edits, and audio nodes leak on every play (RE-13, RE-14).
- **High, delivery**: Electron 39 is out of support; macOS auto-update is broken in packaged builds; the release pipeline runs no tests and its Sonar gate fails open; Windows v1.3.1 shipped unsigned (RE-15 to RE-19).
- User docs promise a pre-sync backup and offline-only operation, neither of which is true (RE-20); the developer docs have drifted widely.
