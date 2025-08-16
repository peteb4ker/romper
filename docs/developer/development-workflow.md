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
5. **Create pull request** - use enhanced commit workflow for automated PR creation with auto-merge
6. **Ask for permission** before proceeding to next sub-task

### Automated Quality Gates (Pre-commit Hooks)

**All quality checks are automated via pre-commit hooks** that run on every `git commit`:

✅ **TypeScript type checking** - compilation validation
✅ **ESLint linting** - code style enforcement
✅ **Full test suite** - functionality validation
✅ **Production build** - deployability check
✅ **SonarCloud analysis** - quality/security scan

```bash
# Manual pre-commit validation (auto on commit)
npm run pre-commit

# Individual validation commands (automated)
npm run typecheck    # TypeScript validation
npm run lint         # ESLint with auto-fix
npm run test         # Full test suite
npm run build        # Production build
npm run sonar:scan   # Local preview scan (requires SONAR_TOKEN)
```

#### Token-Efficient Test Output

**Pre-commit hooks use optimized test configuration** to minimize CI/automated output:

- **`NO_COLOR=true`** - removes ANSI color codes for cleaner logs
- **`--silent --reporter=dot`** - shows only dots (`.`) for passing tests and `x` for failures
- **Failure details only** - verbose output only shown when tests fail
- **Development vs CI** - regular `npm run test` keeps full output for debugging

```bash
# Token-efficient testing (used by pre-commit hooks)
npm run test:husky   # Minimal output for automated workflows

# Development testing (verbose output)
npm run test         # Full details for interactive development
```

**Result**: Focus on implementation - quality gates handle validation automatically with minimal noise!

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
- **Component size limit**: Refactor components over 400 lines

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

### Git Worktree for Agent Development

**Git worktree** is the **required workflow** for all agent-based development work. It enables parallel development by maintaining multiple isolated working directories that share the same Git repository.

#### Core Benefits

- **Agent Isolation**: Each agent works in its own directory without interfering with others
- **Parallel Development**: Multiple tasks can be worked on simultaneously
- **Context Preservation**: No need to stash changes when switching between tasks
- **Zero Setup Overhead**: New worktrees created instantly without full repository cloning

#### Required Worktree Setup

**Directory Structure** (recommended):
```
romper/
├── .git/                    # Main repository (bare-like)
├── main/                    # Primary worktree (main branch)
├── worktrees/              # Agent worktrees directory
│   ├── task-5.2-kit-editor/    # Feature worktree
│   ├── fix-sample-loading/     # Bug fix worktree
│   └── docs-worktree-guide/    # Documentation worktree
```

#### Essential Commands

**Create a worktree for new feature:**
```bash
# Create new branch and worktree
git worktree add worktrees/task-5.2-kit-editor -b feature/task-5.2-kit-editor

# Create worktree from existing branch
git worktree add worktrees/bug-fix-sample main
```

**List all worktrees:**
```bash
git worktree list
```

**Remove completed worktree:**
```bash
# Remove worktree (after merging branch)
git worktree remove worktrees/task-5.2-kit-editor

# Force remove if needed
git worktree remove worktrees/task-5.2-kit-editor --force
```

**Maintenance commands:**
```bash
# Clean up deleted worktree references
git worktree prune

# Repair worktree connections if needed
git worktree repair
```

#### Agent Worktree Workflow

**For Each New Task (CRITICAL - Parallel Agent Coordination):**

1. **Pull latest main changes** (Required for parallel agents):
   ```bash
   cd /path/to/main/worktree  # Navigate to main branch worktree
   git pull origin main       # Get latest changes from other agents
   ```

2. **Create task-specific worktree from fresh main**:
   ```bash
   git worktree add worktrees/$(date +%Y%m%d)-task-name -b feature/task-name main
   cd worktrees/$(date +%Y%m%d)-task-name
   npm install  # Required for each worktree
   ```

3. **Work in isolation**: All development happens in the worktree directory

4. **Validate with quality gates**: Pre-commit hooks run in worktree context
   ```bash
   npm run pre-commit  # All quality checks pass in isolation
   ```

5. **Complete and clean up**:
   ```bash
   git push origin feature/task-name  # Push completed work
   cd ../../main                      # Return to main worktree
   git worktree remove worktrees/$(date +%Y%m%d)-task-name
   ```

#### Worktree Best Practices

**Naming Conventions:**
- Use task IDs: `worktrees/task-5.2-kit-editor`
- Include dates for clarity: `worktrees/20240814-fix-sample-loading` 
- Describe purpose: `worktrees/docs-worktree-setup`

**Development Flow:**
- **One task per worktree**: Maintain clear task isolation
- **Always start from main**: Pull latest main before creating worktrees to avoid conflicts
- **Parallel agent safety**: Multiple agents working simultaneously - fresh main prevents merge conflicts
- **Quality gates apply**: All pre-commit hooks work normally in worktrees
- **Database considerations**: SQLite database is shared - coordinate access carefully
- **Clean up regularly**: Remove merged worktrees to prevent clutter

**Integration with CI/CD:**
- Pre-commit hooks run normally in worktree context
- SonarCloud analysis works across all worktrees
- Build validation maintains full compatibility
- Release pipeline triggers from main branch as usual

#### Troubleshooting Worktrees

**Common Issues:**

```bash
# If worktree becomes corrupted
git worktree repair

# If cleanup fails
git worktree remove --force <worktree-path>

# If branch cannot be deleted
git branch -D feature/branch-name

# List all worktrees for debugging
git worktree list --porcelain
```

**Database Conflicts:**
- Only one worktree should run database migrations
- Coordinate schema changes across active worktrees
- Test database operations in isolation before committing

**Performance Notes:**
- Worktrees share `.git` directory - no space overhead
- Node modules need installation in each worktree: `npm install`
- Build artifacts are worktree-specific

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

### Pull Request Standards

All pull requests are created automatically via the enhanced commit workflow with standardized features:

#### Automated PR Creation

The `npm run commit` command automatically:
1. **Creates PR with standard template** including summary and test plan
2. **Enables auto-merge** for automatic merging when all checks pass
3. **Sets up proper branch tracking** with upstream remote
4. **Provides PR URL** for immediate review access

#### PR Title Guidelines

CRITICAL: Keep PR titles concise and scannable. Titles should be **short sentences, not paragraphs**.

**Length Limits:**
- **Maximum 50-60 characters** for the main title
- **Use description/body for details** - not the title

**Format:**
```
<type>: <concise description>
```

**Good Examples:**
- `feat: add dark mode toggle to settings`
- `fix: resolve sample loading race condition`
- `refactor: extract authentication middleware`
- `docs: update PR title guidelines`

**Bad Examples (Too Long):**
- `feat: add comprehensive dark mode toggle functionality to application settings with proper theme switching and CSS variable management for improved user experience`
- `fix: resolve critical sample loading race condition that occurs during rapid kit switching and causes UI to become unresponsive with detailed error handling`

**Guidelines:**
- **Use imperative mood** (`add`, `fix`, `update` not `adding`, `fixed`, `updated`)
- **Focus on the "what"** in title
- **Save "why" and "how"** for description
- **Include conventional commit prefix** (`feat:`, `fix:`, `docs:`, etc.)
- **Be specific but concise** (`fix auth bug` → `fix: resolve login timeout issue`)

#### Auto-Merge Requirements

Auto-merge is enabled by default and will merge PRs when:
- ✅ All required status checks have passed (pre-commit hooks)
- ✅ All required reviews are met (if configured)
- ✅ No blocking conversations remain unresolved

#### Agent Responsibility for PR Quality

**CRITICAL**: Agents are responsible for ensuring ALL CI/CD checks pass on created PRs.

**Required Actions:**
1. **Monitor PR status** after creation via enhanced commit workflow
2. **Check all required status checks**: build, lint, unit-tests, e2e-tests-check, SonarCloud
3. **Fix failing checks immediately**:
   - TypeScript compilation errors: `npm run typecheck`
   - Linting issues: `npm run lint`
   - Test failures: `npm run test:fast` or `npm run test`
   - Build failures: `npm run build`
   - SonarCloud issues: Review quality gate failures and fix code quality issues
4. **Commit fixes and push updates** until all checks pass
5. **Ensure PR merges successfully** through auto-merge process

**Available Commands:**
- `gh pr checks <pr-number>` - Monitor PR check status
- `gh pr view <pr-number>` - View PR details and status
- Standard validation commands: `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`

#### Manual Auto-Merge Control

If you need to manually enable/disable auto-merge for a PR:

```bash
# Enable auto-merge for current branch's PR
gh pr merge --auto

# Enable auto-merge for specific PR number
gh pr merge 123 --auto

# Disable auto-merge (web interface only)
# Visit PR page and click "Disable auto-merge"
```

This streamlined approach ensures consistent PR quality while minimizing manual intervention in the development workflow.

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
npm run sonar:scan   # Local preview scan (requires SONAR_TOKEN)
```

**Husky Configuration**: Pre-commit hooks are configured in `.husky/pre-commit` and use lint-staged for efficient file processing.

### SonarCloud Integration

**SonarCloud** provides automated code quality and security analysis as part of the pre-commit hooks.

#### Setup SONAR_TOKEN (Required for SonarCloud Analysis)

**For CLI Development (Recommended):**
Add to your shell profile file:

```bash
# For bash (~/.bashrc or ~/.bash_profile)
export SONAR_TOKEN="your_sonarcloud_token_here"

# For zsh (~/.zshrc)
export SONAR_TOKEN="your_sonarcloud_token_here"
```

After adding, reload your shell:

```bash
source ~/.zshrc  # or ~/.bashrc
```

**Alternative Methods:**

```bash
# Temporary session (current terminal only)
export SONAR_TOKEN="your_token_here"
npm run sonar:scan

# Using .env file (local development)
echo "SONAR_TOKEN=your_token_here" >> .env
source .env && npm run sonar:scan
```

#### SonarCloud Analysis Workflows

**Two-tier SonarQube analysis strategy:**

1. **Local Preview Scan (Pre-commit)**:
   - Runs during `git commit` if `SONAR_TOKEN` is available
   - **Preview mode** - analyzes locally without uploading to SonarCloud
   - **Catches ALL SonarCloud rules early** in development workflow
   - Prevents failures in main branch CI/CD pipeline
   - Uses `sonar-project-local.properties` configuration

2. **Full SonarCloud Analysis (GitHub Action)**:
   - Runs on `push` to `main` branch and `pull_request`
   - **Full analysis mode** - uploads results to SonarCloud dashboard
   - Runs after tests with coverage reports
   - Uses main `sonar-project.properties` configuration

**Local Behavior:**

- **With SONAR_TOKEN**: Runs preview scan during pre-commit (recommended)
- **Without SONAR_TOKEN**: Gracefully skips with warning message
- **Configuration**: Uses `https://sonarcloud.io` (no SONAR_HOST_URL needed)

**Result**: Catch SonarCloud issues locally before they cause CI failures!

#### Security Best Practices

- **Never commit tokens to git** - ensure `.env` is in `.gitignore`
- **Use SonarCloud User Token** (not Organization token)
- **Keep tokens private** and rotate them periodically

### Development Commands

```bash
# Development
npm run dev              # Start Vite dev server
npm run electron:dev     # Start Electron in development
npm run start           # Alternative Electron start

# Building & Type Checking
npm run build           # Build for production
npm run typecheck       # TypeScript validation

# Testing
npm run test            # Run all tests (unit + integration)
npm run test:unit       # Unit tests only
npm run test:integration # Integration tests only

# Linting
npm run lint            # ESLint with auto-fix

# Quality Checks (Automated)
npm run pre-commit      # All quality checks (automated on commit)

# SonarCloud Analysis
npm run sonar:scan      # Local preview scan (catches issues early, requires SONAR_TOKEN)
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

_Following this workflow ensures consistent, high-quality development while maintaining the project's architectural integrity and user experience standards._
