---
layout: default
title: Development Workflow
---

# Development Workflow

This document describes the development workflow, task execution patterns, and quality standards for Romper development.

## Task Execution Process

### Step-by-Step Workflow
1. **Read current task** from [tasks/tasks-PRD.md](../tasks/tasks-PRD.md)
2. **Implement one sub-task at a time** - never skip ahead or work on multiple tasks
3. **Update task file** - mark sub-task as complete `[x]`
4. **Commit changes** - pre-commit hooks automatically validate (TypeScript, linting, tests, build)
5. **Ask for permission** before proceeding to next sub-task

### Automated Quality Gates (Pre-commit Hooks)
**All quality checks are automated via pre-commit hooks** that run on every `git commit`:

✅ **TypeScript type checking** - catches compilation errors  
✅ **ESLint linting with auto-fix** - enforces code style  
✅ **Full test suite execution** - ensures functionality  
✅ **Production build validation** - confirms deployability

```bash
# Manual pre-commit validation (optional - runs automatically on commit)
npm run pre-commit

# Individual validation commands (now automated)
npm run typecheck    # TypeScript validation
npm run lint         # ESLint with auto-fix  
npm run test         # Full test suite
npm run build        # Production build
```

**Result**: Focus on implementation - quality gates handle validation automatically!

### Task File Management
- Keep "Relevant Files" section up to date with created/modified files
- Add new tasks if discovered during implementation
- Only mark `[x]` if corresponding code is implemented and validated
- Revert incorrectly marked tasks back to `[ ]`

## Code Quality Standards

### TypeScript Requirements
- **Zero compilation errors**: `npx tsc --noEmit` must pass
- **Strict type checking**: No `any` types except in legacy code
- **Import statements only**: Never use `require()` - always use ES modules
- **Type-safe database operations**: Use Drizzle ORM types throughout

### Component Architecture
- **Hook-based logic**: All business logic in `hooks/use<ComponentName>.ts`
- **Presentation-only components**: UI components contain only rendering logic
- **Empty file cleanup**: Delete unused hook files immediately
- **Component size limit**: Refactor components over 350 lines

### Database Operations (Drizzle ORM)
- **Synchronous operations**: Use better-sqlite3 synchronous driver
- **Terminal methods required**: Always call `.all()`, `.get()`, `.run()`, or `.values()`
- **No await**: Do not use `await` with synchronous better-sqlite3 operations
- **Schema consistency**: Keep schema definitions in sync with actual database

## Testing Standards

### Test Structure
- **Co-location**: Unit tests in `__tests__/` subdirectories next to source code
- **One test file per source file**: Each code file has exactly one corresponding test file
- **Test isolation**: Each test must be independent with proper cleanup
- **80% coverage minimum**: Maintain high test coverage across codebase

### Testing Tools
- **Vitest (not Jest)**: Use `npx vitest` for all test operations
- **Centralized mocks**: Reference `vitest.setup.ts` for common mocks
- **Mock strategy**: Mock dependencies, test only the code under test
- **Clear DOM**: Clear DOM between tests to prevent state leakage

### Test Commands
```bash
# Interactive test runner
npx vitest

# Run all tests once
npm test

# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration
```

## Performance Standards

### UI Responsiveness
- **Sub-50ms interactions**: All user actions must respond within 50ms
- **Memoization**: Use React.memo, useMemo for expensive computations
- **List virtualization**: Use react-window for large lists (>100 items)
- **Debounced input**: Debounce search/filter inputs appropriately

### Database Performance
- **Prepared statements**: Drizzle automatically uses prepared statements
- **Batch operations**: Group related database operations
- **Reference-only architecture**: Avoid unnecessary file copying during editing
- **Efficient queries**: Optimize for common access patterns

## File Organization Patterns

### Directory Structure
```
app/renderer/components/
├── ComponentName.tsx          # UI component
├── hooks/
│   ├── useComponentName.ts    # Business logic hook
│   └── __tests__/
│       └── useComponentName.test.ts
├── utils/
│   ├── componentUtils.ts      # Utility functions
│   └── __tests__/
│       └── componentUtils.test.ts
└── __tests__/
    └── ComponentName.test.tsx # Component tests
```

### Import Conventions
- **Absolute paths**: Use absolute imports for shared modules
- **Relative paths**: Use relative imports for local files
- **Barrel exports**: Use index.ts files for clean imports
- **Type imports**: Use `import type` for type-only imports

## Error Handling Patterns

### Error Boundaries
- **Component-level**: Wrap components that might fail
- **User-friendly messages**: Provide actionable error messages
- **Graceful degradation**: App remains functional when non-critical components fail
- **Error reporting**: Log errors for debugging but don't expose internal details

### File System Operations
- **Path validation**: Sanitize and validate all file paths
- **Permission checking**: Verify access rights before operations
- **Missing file handling**: Detect and handle missing `source_path` references
- **Atomic operations**: Use proper file locking during operations

## Git Workflow

### Commit Message Format
Use conventional commit format:
```
<type>: <description>

- Bullet point summary of key changes
- Include specific technical details
- Reference files modified
- Note any breaking changes

Closes #<task-number> - <task-description>
Tests: <passing>/<total> passing
```

### Commit Types
- `feat:` - New features
- `fix:` - Bug fixes
- `refactor:` - Code refactoring
- `docs:` - Documentation changes
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

## Build and Release

### Build Validation (Automated)
Pre-commit hooks automatically run all validation steps. Manual commands available:

```bash
# All validations in one command (runs automatically on commit)
npm run pre-commit

# Individual validation steps (if needed)
npm run typecheck    # TypeScript validation  
npm run lint         # ESLint with auto-fix
npm run test         # Full test suite
npm run build        # Production build validation
```

**Husky Configuration**: Pre-commit hooks are configured in `.husky/pre-commit` and use lint-staged for efficient file processing.

### Development Commands
```bash
# Start development
npm run dev              # Vite dev server
npm run electron:dev     # Electron development mode

# Production build
npm run build           # Build for production
npm run electron:prod   # Electron production mode
```

## Documentation Maintenance

### Documentation Updates
- **Architecture changes**: Update [docs/architecture.md](./architecture.md)
- **Schema changes**: Update [docs/romper-db.md](./romper-db.md)
- **API changes**: Update relevant documentation
- **Breaking changes**: Document migration guides

### Documentation Review
- **Accuracy**: Ensure docs match current implementation
- **Completeness**: Cover all user-facing features
- **Clarity**: Write for junior developers
- **Links**: Maintain working links between documents

---

*Following this workflow ensures consistent, high-quality development while maintaining the project's architectural integrity and user experience standards.*