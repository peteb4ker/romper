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
See [Development Workflow](./docs/developer/development-workflow.md) for complete command reference.

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
File-specific standards automatically load based on current working file:
- **React Components** (`*.tsx`) → `.agent/standards/react-components.md`
- **Custom Hooks** (`hooks/use*.ts`) → `.agent/standards/custom-hooks.md`
- **Database** (`db/*.ts`) → `.agent/standards/database.md`
- **Tests** (`__tests__/*.test.ts`) → `.agent/standards/testing.md`

See `.agent/context.md` for pattern matching rules and `.agent/standards/` for detailed coding standards.

## Architecture Overview
See [Architecture Documentation](./docs/developer/architecture.md) for comprehensive architectural concepts including:
- Immutable baseline architecture
- Reference-only sample management
- Kit editing system
- Database schema patterns

## Development Workflow
See [Development Workflow](./docs/developer/development-workflow.md) and [Task Execution](./.agent/task-execution.md) for complete workflow guidance.

### Documentation Organization Rule
**CRITICAL**: Documentation belongs in specific locations:
- **Human-readable docs** → `docs/` directory
- **Agent instructions** → `.agent/` directory  
- **NEVER put documentation in CLAUDE.md** - this file is for project context only

## Key Documentation Links
- [Product Requirements Document](./tasks/PRD.md) - Complete project vision
- [Current Task List](./tasks/tasks-PRD.md) - Development progress
- [Architecture Overview](./docs/developer/architecture.md) - Core design patterns and decisions
- [Development Workflow](./docs/developer/development-workflow.md) - Task execution and quality standards
- [Context-Aware Standards](./.agent/context.md) - Auto-loading file-type specific instructions
- [Task Execution Framework](./.agent/task-execution.md) - Agent execution patterns
- [Database Schema](./docs/developer/romper-db.md) - Current schema reference

## Current Development Focus
Working on **Task 5.0: Kit Editing and Slot Management** - implementing editable mode system with reference-only sample management using the new Drizzle ORM architecture.

---

*For detailed architectural concepts, development patterns, and comprehensive guides, see the `docs/` directory. This file provides project context - refer to specific documentation for implementation details.*