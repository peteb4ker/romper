---
title: "Romper Sample Manager - Claude Code Instructions"
owners: ["maintainer"]
last_reviewed: "2025-08-15"
tags: ["documentation"]
---

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

**Fast Test Commands (for Local Development):**
- `npm run test:fast` - Run all tests without coverage (~14s vs ~40s)
- `npm run test:unit:fast` - Unit tests only without coverage (~10s vs ~34s)
- `npm run test:integration:fast` - Integration tests only without coverage (~2s)

**Coverage Test Commands (for CI/CD):**
- `npm run test` - Full test suite with coverage and reporting
- `npm run test:unit` - Unit tests with coverage
- `npm run test:integration` - Integration tests with coverage

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

- **React Components** (`*.tsx`) → [React Component Standards](.agent/standards/react-components.md)
- **Custom Hooks** (`hooks/use*.ts`) → [Custom Hooks Standards](.agent/standards/custom-hooks.md)
- **Database** (`db/*.ts`) → [Database Standards (Drizzle ORM)](.agent/standards/database.md)
- **Tests** (`__tests__/*.test.ts`) → [Testing Standards (Vitest)](.agent/standards/testing.md)

See `.agent/context.md` for pattern matching rules and `.agent/standards/` for detailed coding standards.

## Architecture Overview

See [Architecture Documentation](./docs/developer/architecture.md) for comprehensive architectural concepts including:

- Immutable baseline architecture
- Reference-only sample management
- Kit editing system
- Database schema patterns

## Development Workflow

- **FIRST**: Check [Agent Quick Checklist](./.agent/QUICK_CHECKLIST.md) before making ANY changes
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

## Pull Request Standards

**CRITICAL**: PR titles must be concise and scannable - **short sentences, not paragraphs**.

**PR Title Requirements:**
- **Maximum 50-60 characters** for the main title
- **Format**: `<type>: <concise description>`
- **Use imperative mood**: `add`, `fix`, `update` (not `adding`, `fixed`, `updated`)
- **Examples**: 
  - ✅ `feat: add dark mode toggle to settings`
  - ✅ `fix: resolve sample loading race condition`
  - ❌ `feat: add comprehensive dark mode toggle functionality with proper theme switching...`

**Agent PR Responsibility:**
Agents MUST ensure ALL CI/CD checks pass on created PRs:
- Monitor PR status after creation
- Fix failing checks: TypeScript, linting, tests, build, SonarCloud
- Use `gh pr checks <pr-number>` to monitor status
- **Review ALL comments systematically** - address every comment individually
- **Follow exact suggestions** - when reviewers provide specific code, use it exactly (don't "improve")
- **Test exact code first** - use reviewer's solution before trying alternatives
- **Only resolve conversations marked as outdated** - never resolve outstanding issues
- **Rename terminal** to include PR number: `branch-name-pr-123`
- Commit fixes until all checks pass and PR merges successfully

## Git Workflow Requirements

**CRITICAL**: Use the mandatory worktree workflow for all development:

1. **Pull latest main**: `cd /path/to/main && git pull origin main` (REQUIRED for parallel agents)
2. **Create isolated worktree**: `npm run worktree:create <task-name>` (creates from fresh main)
3. **Work in isolation**: `cd worktrees/<task-name>` and make changes
4. **Enhanced commit**: `npm run commit "message"` - automatically handles:
   - Branch protection (blocks main branch commits)
   - Pre-commit quality checks (TypeScript, linting, tests, build)
   - Push to remote with proper upstream tracking
   - Pull request creation with standard template
5. **Clean up**: `npm run worktree:remove <task-name>` when done

**Parallel Agent Coordination**: Multiple agents work simultaneously - ALWAYS pull main before creating worktrees to avoid conflicts from constantly merging PRs.

## Code Metrics and Analysis Standards

**CRITICAL**: DO NOT make educated guesses about code metrics (complexity scores, coverage percentages, performance metrics, etc.) and present them as facts. When discussing metrics:

- Only report metrics that have been measured by actual tools
- If asked about metrics without having tool output, explain that you need to run appropriate analysis tools
- Never estimate or approximate metric values based on code inspection alone

---

_For detailed architectural concepts, development patterns, and comprehensive guides, see the `docs/` directory. This file provides project context - refer to specific documentation for implementation details._
