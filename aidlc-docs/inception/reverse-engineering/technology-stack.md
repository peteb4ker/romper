# Technology Stack

## Programming Languages
- **TypeScript 5.8.3** - Strict mode, ES2022 target, zero `any` types

## Core Frameworks
- **Electron 36.8.1** - Desktop application framework (cross-platform)
- **React 19.1.0** - UI framework with concurrent rendering
- **Vite 6.4.2** - Build tool (3 separate configs: main, preload, renderer)
- **React Router DOM 7.12.0** - Client-side routing

## Database
- **Drizzle ORM 0.44.3** - Type-safe ORM with schema-first approach
- **better-sqlite3 11.10.0** - Synchronous SQLite for Node.js
- **Drizzle Kit 0.31.4** - Schema migration management

## Styling
- **Tailwind CSS 4.1.8** - Utility-first CSS with Vite plugin
- **Phosphor Icons 2.1.10** - Icon library

## Build and Packaging
- **Electron Forge 7.11.1** - Packaging and distribution
  - Squirrel (Windows), ZIP (macOS/Linux), DMG (macOS), DEB/RPM (Linux)
- **Electron Rebuild 4.0.1** - Native module compilation
- **Concurrently 9.1.2** - Parallel build steps

## Testing
- **Vitest 3.2.3** - Unit testing (V8 coverage, 85% thresholds)
- **Playwright 1.56.1** - E2E testing
- **Testing Library** - React 16.3.0, jest-dom 6.6.3, user-event 14.6.1
- **JSDOM 26.1.0** - DOM simulation for unit tests
- **nyc 17.1.0** - Coverage aggregation

## Audio
- **wavesurfer.js 7.9.5** - Waveform visualization
- **node-wav 0.0.2** - WAV file parsing
- **play-sound 1.1.6** - Cross-platform audio playback

## Code Quality
- **ESLint 9.0.0** - Linting (sonarjs, react-hooks, perfectionist, prettier plugins)
- **Husky 9.1.7** - Pre-commit hooks (typecheck + lint + test + build)
- **SonarCloud** - Quality gate analysis
- **Madge 8.0.0** - Circular dependency detection
- **Dependency-cruiser 17.3.10** - Architecture validation

## CI/CD
- **GitHub Actions** - 8 workflows (build, test, lint, typecheck, e2e, release, pages, sonar)
- **Codecov** - Coverage reporting

## File Handling
- **Archiver 7.0.1** / **Unzipper 0.12.3** / **Tar 7.5.8** - Archive operations
- **Sharp 0.34.5** - Image processing for icons

## UI Components
- **React Window 1.8.11** - Virtual list rendering
- **React Dropzone 14.3.8** - Drag-and-drop file upload
