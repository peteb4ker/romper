# Romper Agent Context

## Auto-Loading Instructions Based on File Patterns

**IMPORTANT**: This file is always loaded. Based on the current file being worked on, automatically include additional specific instructions using the patterns below.

### File Pattern Detection Rules

When working on a file, automatically include these additional instruction files based on file path patterns:

#### React Components (`*.tsx`)
- **Primary**: `.agent/standards/react-components.md`
- **Secondary**: `.agent/patterns/performance.md`
- **Context**: UI components with rendering logic

#### Custom Hooks (`**/hooks/use*.ts`)
- **Primary**: `.agent/standards/custom-hooks.md`
- **Secondary**: `.agent/patterns/anti-patterns.md`
- **Context**: Business logic hooks

#### Database Operations (`**/db/*.ts`)
- **Primary**: `.agent/standards/database.md`
- **Secondary**: `.agent/patterns/security.md`
- **Context**: Drizzle ORM and database operations

#### Test Files (`**/__tests__/*.test.ts`, `**/__tests__/*.test.tsx`)
- **Primary**: `.agent/standards/testing.md`
- **Secondary**: `.agent/patterns/testing-patterns.md`
- **Context**: Vitest unit and integration tests

#### TypeScript Definitions (`*.d.ts`)
- **Primary**: `.agent/standards/typescript-types.md`
- **Context**: Type definitions and interfaces

#### Utility Functions (`**/utils/*.ts`)
- **Primary**: `.agent/standards/utilities.md`
- **Secondary**: `.agent/patterns/pure-functions.md`
- **Context**: Pure utility functions

#### Shared Code (`**/shared/*.ts`)
- **Primary**: `.agent/standards/shared-code.md`
- **Context**: Cross-process shared utilities

#### IPC-Heavy Files (`**/hooks/**`, `**/utils/**` with electron API usage)
- **Secondary**: `.agent/patterns/ipc-error-handling.md`
- **Context**: Electron IPC error handling patterns

#### Default Pattern (any other `.ts` or `.tsx` file)
- **Primary**: `.agent/standards/general.md`
- **Context**: General TypeScript/React patterns

## Core Principles (Always Apply)

### Architecture Foundation
- **Separation of concerns**: Each module has a single, clear responsibility
- **Reference-only samples**: Store absolute paths (`source_path`), never copy files locally until sync  
- **Type-safe operations**: Zero TypeScript compilation errors required
- **Graceful degradation**: App remains functional when non-critical components fail

### Quality Gates
- **TypeScript validation**: `npx tsc --noEmit` MUST pass before task completion
- **Test coverage**: Maintain 80% minimum coverage
- **ESM modules ONLY**: Use ES modules everywhere except electron/preload/index.ts (which can use CommonJS)
- **Production cleanliness**: Remove all `console.log` statements

### Error Handling Pattern
All database and async operations use the consistent `DbResult<T>` pattern:
```typescript
type DbResult<T> = 
  | { success: true; data: T }
  | { success: false; error: string };
```

## Auto-Generation Rule

**CRITICAL**: Whenever `.agent/standards/comprehensive.md` is updated, ALL file-type specific instruction files MUST be regenerated automatically to maintain consistency. This rule applies to all development agents and tools.

## Current Development Context

**Project**: Romper Sample Manager for Squarp Rample
**Phase**: Transitioning to reference-only sample management with kit editing
**Current Task**: Implementation of kit editing system with Drizzle ORM
**Architecture**: Electron + React + TypeScript + Drizzle ORM + Vitest

---

*This context file ensures efficient, targeted instruction loading based on the specific file being worked on, while maintaining consistency across all development activities.*