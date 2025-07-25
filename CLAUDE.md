# Romper Sample Manager - Claude Code Instructions

> **Auto-Loading Context**: Additional file-specific instructions are automatically loaded based on the current working file. See `.agent/context.md` for pattern matching rules.

## Project Overview
Cross-platform desktop app for managing sample kits for the **Squarp Rample** Eurorack sampler. Built with Electron, React, TypeScript, and Drizzle ORM using reference-only sample management.

**Current Development Phase:** Implementing kit editing system with Drizzle ORM transition.

## Tech Stack & Versions
- **Electron** + **React** + **Vite** + **TypeScript**
- **Tailwind CSS** for styling
- **Drizzle ORM** with **better-sqlite3** (synchronous driver)
- **Vitest** for testing (not Jest)
- **Node.js** native filesystem APIs

## Essential Commands
```bash
# Development
npm run dev              # Start Vite dev server
npm run electron:dev     # Start Electron in development
npm run start           # Alternative Electron start

# Building & Type Checking
npm run build           # Build for production
npx tsc --noEmit       # TypeScript validation (REQUIRED before task completion)

# Testing
npm test               # Run all tests
npm run test:unit      # Unit tests only
npm run test:integration # Integration tests only
npx vitest            # Interactive test runner

# Linting
npm run lint          # ESLint
```

## Project Structure
```
romper/
├── app/renderer/           # React UI components
│   ├── components/         # UI components with matching __tests__/
│   └── utils/             # Utility functions
├── electron/main/          # Electron main process
│   └── db/                # Drizzle ORM database layer
├── shared/                # Shared types and utilities
├── docs/                  # Documentation (single source of truth)
├── tasks/                 # PRD and task lists
└── .github/chatmodes/     # GitHub Copilot workflows
```

## Code Standards & Architecture

### Context-Aware Instructions
Based on the file you're working on, additional specific standards are automatically loaded:
- **React Components** (`*.tsx`) → Hook-based architecture patterns
- **Custom Hooks** (`hooks/use*.ts`) → Single responsibility and dependency injection
- **Database** (`db/*.ts`) → Drizzle ORM and DbResult patterns
- **Tests** (`__tests__/*.test.ts`) → Vitest and mocking patterns

### Core Requirements (Always Apply)
- **ESM modules ONLY**: Use ES modules everywhere except `electron/preload/index.ts`
- **TypeScript strict**: Zero compilation errors required
- **Reference-only samples**: Store paths, don't copy files until sync
- **80% test coverage**: Maintain high coverage across codebase
- **NO trailing whitespace**: Never add whitespace at the end of lines
- **Keep code DRY**: Avoid unnecessary complexity, duplication, or code bloat

## Current Architecture Concepts

### Immutable Baseline Architecture
- **Local store** serves as immutable baseline from setup (SD card/factory samples/blank)
- **User samples referenced by `source_path`** - never copied to local store
- Only copied/converted during SD card sync operations
- Reference: [Architecture Documentation](./docs/architecture.md) *(to be created)*

### Kit Editing System
- **Editable mode** - ON for user kits, OFF for factory kits
- **Reference-only samples** - stored via `source_path` field
- **Voice-based organization** - 4 voices per kit, 12 slots per voice
- **Undo/redo system** with action history in database

### Database Schema
- **kit_name as foreign key** (not kit_id) for human-readable references
- **voice_number field** (1-4) for explicit voice tracking  
- **source_path field** for external sample references
- **Drizzle ORM** with schema-first approach

## Development Workflow

### Task Execution Process
1. **Read current task** from `tasks/tasks-PRD.md`
2. **Implement one sub-task at a time**
3. **Run `npx tsc --noEmit`** to validate TypeScript
4. **Run tests** to ensure functionality
5. **Update task file** and mark sub-task complete
6. **Ask for permission** before proceeding to next sub-task

### Build Validation (CRITICAL)
- **Always run `npx tsc --noEmit`** before marking tasks complete
- Fix all TypeScript errors before proceeding
- Maintain test coverage during development

### Git Workflow
- Follow project commit standards (see CONTRIBUTING.md)
- Reference task numbers when applicable
- Mention test status if relevant
- **IMPORTANT:** Do not add authorship or co-author tags to commit messages

## Key Documentation Links
- [Product Requirements Document](./tasks/PRD.md) - Complete project vision
- [Current Task List](./tasks/tasks-PRD.md) - Development progress
- [Architecture Overview](./docs/developer/architecture.md) - Core design patterns and decisions
- [Context-Aware Standards](./.agent/context.md) - Auto-loading file-type specific instructions
- [Coding Guide](./docs/developer/coding-guide.md) - Human-readable development guide
- [Database Schema](./docs/developer/romper-db.md) - Current schema reference
- [Development Workflow](./docs/developer/development-workflow.md) - Task execution and quality standards
- [IPC Error Handling](./.agent/patterns/ipc-error-handling.md) - Electron IPC best practices

## Error Handling & Edge Cases
- **Graceful degradation** - app remains functional on non-critical errors
- **File system safety** - validate paths, handle missing files
- **Reference integrity** - handle missing `source_path` files
- **User data protection** - confirm destructive actions

## Performance Requirements
- **Sub-50ms UI interactions**
- **Handle 0-2600 kits efficiently**
- **Memoize expensive computations**
- **Reference-only file handling** (no unnecessary copying)

## Current Development Focus
Working on **Task 5.0: Kit Editing and Slot Management** - implementing editable mode system with reference-only sample management using the new Drizzle ORM architecture.

---

*For detailed architectural concepts, development patterns, and comprehensive guides, see the `docs/` directory. This file provides project context - refer to specific documentation for implementation details.*