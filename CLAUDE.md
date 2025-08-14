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

**Worktree Workflow (Required for Development):**
- `npm run worktree:create <task-name>` - Create new feature branch and worktree
- `npm run worktree:list` - List all active worktrees  
- `npm run worktree:current` - Show current worktree status
- `npm run worktree:remove <task-name>` - Remove completed worktree
- `npm run commit "message"` - Enhanced commit with branch protection, quality checks, push, and PR creation

**Legacy Commands:**
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

- See [Development Workflow](./docs/developer/development-workflow.md) and [Task Execution](./.agent/task-execution.md) for complete workflow guidance.
- ALWAYS update the task file status upon completing a subtask and/or task.

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

## Testing Standards

**CRITICAL**: NEVER skip tests with `.skip()` or similar methods. Always fix failing tests properly by addressing the root cause. If a test is failing, investigate and resolve the underlying issue rather than bypassing it.

## Git Commit Standards

**CRITICAL**: When creating git commits, DO NOT add Claude attribution or Co-Authored-By lines. Commit messages should contain only the actual commit content without any AI attribution.

## Git Workflow Requirements

**CRITICAL**: Use the mandatory worktree workflow for all development:

1. **Create isolated worktree**: `npm run worktree:create <task-name>`
2. **Work in isolation**: `cd worktrees/<task-name>` and make changes
3. **Enhanced commit**: `npm run commit "message"` - automatically handles:
   - Branch protection (blocks main branch commits)
   - Pre-commit quality checks (TypeScript, linting, tests, build)
   - Push to remote with proper upstream tracking
   - Pull request creation with standard template
4. **Clean up**: `npm run worktree:remove <task-name>` when done

This workflow ensures complete isolation, automated quality gates, and proper code review via pull requests.

## Code Metrics and Analysis Standards

**CRITICAL**: DO NOT make educated guesses about code metrics (complexity scores, coverage percentages, performance metrics, etc.) and present them as facts. When discussing metrics:

- Only report metrics that have been measured by actual tools
- If asked about metrics without having tool output, explain that you need to run appropriate analysis tools
- Never estimate or approximate metric values based on code inspection alone

---

_For detailed architectural concepts, development patterns, and comprehensive guides, see the `docs/` directory. This file provides project context - refer to specific documentation for implementation details._
