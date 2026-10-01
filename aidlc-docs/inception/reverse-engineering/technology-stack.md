# Technology Stack

> Reverse-engineered from `main` @ `87bea51` (app version 1.3.1) on 2026-09-29.
> Versions are the installed versions from `node_modules`, not just the
> `package.json` ranges.

## Programming Languages

- **TypeScript** - 5.9.3 - All application code (renderer, preload, main,
  shared). `tsconfig.json` sets `strict: true`, target/module ES2022,
  `moduleResolution: "node"`, `jsx: react-jsx`, and path aliases
  `@romper/app`, `@romper/electron`, `@romper/shared`. Stricter flags
  (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
  `noImplicitOverride`) are off. Test code is not type-checked (see
  code-quality-assessment.md).
- **JavaScript (ESM/CJS)** - Build and release scripts in `scripts/`,
  `forge.config.cjs`, `electron/run-vitest-in-electron.cjs`.
- **SQL** - 12 Drizzle-generated SQLite migrations in
  `electron/main/db/migrations/`.
- **CSS** - Tailwind v4 CSS-first theme in `app/renderer/styles/index.css`.

## Frameworks

### Desktop runtime

| Component | Version | Notes |
|---|---|---|
| Electron | 39.8.10 | Shipped runtime (declared as a devDependency, which is normal with Forge). **Out of support**: 39.x got its last patch on 2026-05-05. Supported majors are now 42 to 44. `npm audit` reports four High advisories against 39.x. |
| Bundled Node.js | 22.22.1 | Measured with `ELECTRON_RUN_AS_NODE=1 electron -p process.versions`. |
| Bundled Chromium | 142.0.7444.265 | |

### Renderer (UI)

| Component | Version | Purpose |
|---|---|---|
| React / react-dom | 19.2.4 | UI. No `StrictMode` and no error boundary. |
| react-router-dom | 7.18.2 | `HashRouter` with 3 routes (`/`, `/kits`, `/about`). The browser/editor switch is driven by state, not by the route. `/about` is unreachable. |
| Tailwind CSS | 4.3.1 via `@tailwindcss/vite` | CSS-first `@theme` tokens in `styles/index.css`. `tailwind.config.js` is a dead v3-style file. |
| @phosphor-icons/react | 2.1.10 | Icons (28 files). |
| react-window | 1.8.11 | Virtualised kit grid (`KitGrid.tsx`). |
| Web Audio API | Chromium | Sample preview and waveform drawing. One `AudioContext` per sample slot. |
| Web Worker (inline Blob) | Chromium | Step-sequencer clock (`useKitStepSequencerLogic.ts`). |

### Main process and data

| Component | Version | Purpose |
|---|---|---|
| better-sqlite3 | 12.10.0 | SQLite driver. Rebuilt for the Electron ABI by `postinstall` (`electron-rebuild`), so it will not load under plain Node. |
| drizzle-orm | 0.45.2 | ORM and migrator. Bundled into the main-process build. |
| drizzle-kit | 0.31.10 | Migration generator (CLI only). Misplaced in `dependencies`. |
| unzipper | 0.12.3 | Streaming extraction of the Squarp factory archive. |
| update-electron-app | 3.2.0 | macOS auto-update through update.electronjs.org. **Broken in packaged builds** (see code-quality-assessment.md). |

## Infrastructure

Romper is a local desktop app. There are no servers, cloud resources or
infrastructure-as-code stacks. External services it touches:

- **GitHub Releases** - distribution of installers, and the feed for
  auto-update.
- **update.electronjs.org** - auto-update server (macOS only, by design).
- **Squarp factory sample archive** - an HTTPS zip (about 313 MiB)
  downloaded by the setup wizard.
- **Apple notary service** - notarisation during the release build.
- **Azure Trusted Signing** - Windows signing during the release build.
  Currently inactive because the `AZURE_CLIENT_ID` secret is empty.
- **SonarCloud** and **Codecov** - code analysis and coverage (CI only).
- **GitHub Pages** - the Jekyll website and user manual under `docs/`.

## Build Tools

| Tool | Version | Purpose |
|---|---|---|
| npm | 10.9.x | Package manager. There is no `engines`, `.nvmrc` or `packageManager` field. The README says Node 18+, but Vite 8 and `@electron/rebuild` need Node 20.19+ or 22.12+. CI uses Node 22. |
| Vite | 8.0.16 (Rolldown) | `vite.config.ts` builds the renderer and swaps in a hardened production CSP. `vite.main.config.ts` builds the main process as an ES library (target `node18`, externals `better-sqlite3` and `unzipper`) and copies migrations and resources. `vite.preload.config.ts` is unused. |
| tsc | 5.9.3 | Builds the preload (`electron/preload/tsconfig.preload.json`, CommonJS) and type-checks (`npm run typecheck`). |
| Electron Forge | 7.11.2 | Packaging and installers: Squirrel (Windows x64), zip (macOS, Linux), deb, rpm, DMG. The Fuses plugin turns off RunAsNode, NODE_OPTIONS and CLI inspect. No asar. Forge 8.0.1 is available. |
| @electron/rebuild | 4.0.3 | Rebuilds better-sqlite3 for Electron on install. |
| concurrently | 9.2.1 | Runs build steps and the pre-commit checks in parallel. |
| rcodesign | 0.29.0 (pinned SHA-256) | macOS signing, notarisation and stapling in `release.yml`. Per-helper entitlements come from `electron/resources/rcodesign.toml`. |
| husky | 9.1.7 | Pre-commit hook: blocks commits on `main`, then runs typecheck, lint, fast unit and integration tests, and a full build. |
| ESLint | 9.39.3 | Flat config with typescript-eslint (including type-checked rules), sonarjs, react-hooks, perfectionist and prettier. 0 findings today. Does not lint `scripts/**`. |
| Prettier | 3.8.1 | Formatting, through eslint-plugin-prettier. Not a declared dependency. |
| SonarCloud | hosted | Static analysis on `main` pushes, and a release gate. |

## Testing Tools

| Tool | Version | Purpose |
|---|---|---|
| Vitest | 4.1.11 | Unit tests (jsdom; 238 files, 3,453 tests) and integration tests (run inside Electron-as-Node; 27 files, 534 tests). |
| @vitest/coverage-v8 | 4.1.11 | Coverage. Unit thresholds: statements 84, branches 77, functions 82, lines 85. |
| jsdom | 26.1.0 | DOM environment for unit tests. |
| Testing Library | react 16.3.2, jest-dom 6.9.1, user-event 14.6.1 | Component tests. |
| fast-check | 4.6.0 | Property-based tests (4 files). |
| Playwright | 1.58.2 | End-to-end tests that drive the real Electron app through `_electron.launch` (8 files, 24 tests). |
| istanbul-merge, nyc, lcov | 2.0.0, 18.0.0, 1.16.0 | Merge unit and integration coverage for Codecov and SonarCloud. |

## Platform Support

| Platform | Artifacts | Architecture | Signing |
|---|---|---|---|
| macOS | `Romper.dmg`, `Romper-darwin-arm64-<v>.zip` | arm64 only (no Intel or universal build) | Developer ID, notarised and stapled |
| Windows | `Romper-<v>.Setup.exe` (Squirrel) | x64 | **Unsigned** in practice (the Azure step is skipped) |
| Linux | `.deb`, `.rpm`, zip | x64 | none |
