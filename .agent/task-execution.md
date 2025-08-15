# Task Execution Framework

## Core Principles

### One Task at a Time (CRITICAL)

- Execute exactly ONE sub-task per cycle
- Mark complete only when fully implemented and validated
- Request user approval before proceeding to next task

### Automated Validation Approach

Quality validation is **automated via pre-commit hooks**:

- ✅ TypeScript checking, ESLint, tests, and build run automatically on commit
- ✅ Focus on implementation - quality gates handle validation
- ✅ Manual validation: `npm run pre-commit` (optional)

**Result**: Commit changes to trigger automatic validation.

## Pre-Task Analysis

### Dependency Check

Before starting any task:

1. **Verify prerequisites**: Ensure parent/dependent tasks are truly complete
2. **Check technical debt**: Address any pending sub-tasks in "complete" sections
3. **Confirm infrastructure**: Validate required systems (ORM, types, context) are ready

### Context Loading

1. **Load relevant standards**: Context-aware instructions from `.agent/` based on file type
2. **Reference architecture**: Apply patterns from `docs/developer/architecture.md`
3. **Check IPC patterns**: Use `.agent/patterns/ipc-error-handling.md` when applicable

## Task Execution Process

### Phase 1: Planning

```markdown
1. Read task description and acceptance criteria
2. Identify files to be created/modified
3. Load appropriate coding standards (.agent/context.md + file-specific)
4. Plan implementation approach
5. Check for any blocking dependencies
```

### Phase 2: Implementation

```markdown
1. Implement the specific task requirement
2. Follow context-aware coding standards
3. Apply appropriate patterns (React hooks, Drizzle ORM, etc.)
4. Ensure ESM module compliance (except electron/preload/index.ts)
5. Write unit tests if not already present
```

### Phase 3: Validation (Automated)

```markdown
1. Verify task meets acceptance criteria from PRD
2. Check code follows .agent/ standards
3. Commit changes (triggers automatic TypeScript, linting, tests, build)
4. Validation results reported by pre-commit hooks
5. If pre-commit hooks fail, fix issues - do NOT use --no-verify without explicit user permission
```

### Phase 4: Documentation

```markdown
1. Update task list with [x] completion
2. Update "Relevant Files" section with changes
3. Update database documentation if schema affected
4. Add any newly discovered tasks to list
```

### Phase 5: User Approval

```markdown
1. Provide concise summary of what was completed
2. Mention any issues or decisions made
3. Request approval to proceed: "Ready for next task?"
4. Wait for user confirmation before continuing
```

## Git Worktree Execution Model

### Required Worktree Usage

**CRITICAL**: All agent work MUST use git worktrees for task isolation. This is a mandatory workflow requirement.

#### Worktree Creation Pattern

**For each new task, create a dedicated worktree:**

```bash
# MANDATORY: Pull latest main first (multiple agents working in parallel)
cd /path/to/main/worktree
git pull origin main

# Create worktree from fresh main branch
git worktree add worktrees/$(date +%Y%m%d)-task-5.2-kit-editor -b feature/task-5.2-kit-editor main
cd worktrees/$(date +%Y%m%d)-task-5.2-kit-editor

# Install dependencies in new worktree
npm install
```

#### Task Isolation Requirements

- **One task per worktree**: Each worktree handles exactly one task from tasks-PRD.md
- **Branch naming**: Use conventional `feature/`, `fix/`, `docs/` prefixes
- **Directory isolation**: All work happens within the worktree directory
- **Clean environment**: Fresh worktree ensures no cross-task contamination

#### Worktree Lifecycle Management

**Phase 1: Setup (CRITICAL - Parallel Agent Coordination)**
```bash
# MANDATORY: Pull latest main changes first (parallel agents working!)
cd /path/to/main/worktree
git pull origin main

# Create worktree from fresh main branch
git worktree add worktrees/$(date +%Y%m%d)-task-name -b feature/task-name main
cd worktrees/$(date +%Y%m%d)-task-name
npm install  # Required for each worktree
```

**Phase 2: Development**
- All implementation work in worktree context
- Pre-commit hooks run normally within worktree
- Quality gates apply with full isolation
- Database access coordinated with other worktrees

**Phase 3: Completion**
```bash
# Validate all changes
npm run pre-commit

# Commit and push
git add .
git commit -m "feat: implement task 5.2 kit editor functionality"
git push origin feature/task-name

# Clean up
cd ../../main
git worktree remove worktrees/$(date +%Y%m%d)-task-name
```

#### Database Coordination

**SQLite Shared Database Considerations:**
- Database file shared across all worktrees
- **Coordinate schema changes**: Only one worktree should modify schema
- **Test migrations**: Run database changes in isolation first
- **Backup before changes**: Always backup before schema modifications

#### Quality Gates in Worktrees

**Pre-commit Hooks Work Normally:**
- TypeScript validation runs in worktree context
- ESLint and test suites execute within worktree
- SonarCloud analysis processes worktree changes
- Build validation uses worktree-specific artifacts

**Isolation Benefits:**
- No interference between parallel agent tasks
- Clean testing environment per task
- Dependency conflicts avoided
- Build artifacts separated

#### Error Recovery

**Worktree Corruption:**
```bash
# Repair connections
git worktree repair

# Force remove if needed
git worktree remove --force worktrees/problem-worktree

# Re-create if necessary
git worktree add worktrees/recovered-task -b feature/recovered-task
```

**Database Conflicts:**
```bash
# Check for database locks
lsof romper.db

# Kill conflicting processes if needed
# Restart development in clean worktree
```

#### Integration with Task Execution

**Modified Task Workflow:**
1. Read task from tasks-PRD.md
2. **Create dedicated worktree** (NEW STEP)
3. Implement task in worktree isolation
4. Validate with quality gates
5. Commit changes from worktree
6. **Clean up worktree** (NEW STEP)
7. Update task documentation

**Parallel Development Enablement:**
- Multiple agents can work simultaneously
- Each agent operates in isolated worktree
- No context switching or stashing required
- Clean task boundaries maintained

## Git Commit Guidelines

### Pre-commit Hook Policy

- **NEVER use `git commit --no-verify` without explicit user permission**
- **NEVER commit with failing tests - all tests must pass before committing**
- Pre-commit hooks exist for quality assurance and should be respected
- If hooks fail:
  1. Fix the underlying issues (TypeScript errors, linting, test failures)
  2. Only ask for `--no-verify` permission in exceptional circumstances
  3. Clearly explain why bypassing hooks is necessary
  4. Wait for explicit user approval before using `--no-verify`
- **Test failures are blocking** - commits must not proceed with any failing tests

### PR Review Response Protocol (CRITICAL)

When addressing PR review comments, follow this systematic approach to prevent common mistakes:

#### Systematic Review Comment Processing

1. **Read ALL review comments first** - Never implement fixes piecemeal
2. **Create TodoWrite items** for each specific comment/fix needed  
3. **Follow exact suggestions when provided** - Don't try to "improve" on reviewer feedback
4. **Use `npm run commit` for validation** - Let pre-commit hooks catch issues immediately
5. **Address each todo systematically** - Mark complete only when verified working

#### Critical Mistake Prevention

- **Syntax errors**: `npm run commit` will catch these via pre-commit hooks - no need for separate linting
- **Incomplete implementation**: Address all comments in comprehensive fix, not one-by-one
- **Process shortcuts**: Use TodoWrite to track progress systematically  
- **Quality bypassing**: NEVER use `--no-verify` - fix issues properly instead

#### Implementation Pattern

```bash
# 1. Plan systematically using TodoWrite for each review comment
# 2. Fix each issue with immediate validation via npm run commit  
# 3. Let pre-commit hooks provide quality feedback automatically
# 4. Fix any hook failures properly (never bypass with --no-verify)
# 5. Final commit when all issues resolved and hooks pass
```

This systematic approach prevents rushing through fixes and missing issues that create additional review cycles.

### Commit Message Standards

- Use conventional commit format: `type: description`
- Common types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`
- Provide clear, concise descriptions of changes
- Include context about why changes were made when not obvious

### PR Title Guidelines (CRITICAL)

(CRITICAL): Keep PR titles concise and scannable. Titles should be **short sentences, not paragraphs**.

**Length Requirements:**
- **Maximum 50-60 characters** for the main title
- Use body/description for implementation details, not the title

**Format:**
```
<type>: <concise description>
```

**Examples:**
- ✅ `feat: add dark mode toggle to settings`
- ✅ `fix: resolve sample loading race condition`
- ✅ `docs: update PR title guidelines`
- ❌ `feat: add comprehensive dark mode toggle functionality to application settings with proper theme switching and CSS variable management for improved user experience`

**Guidelines:**
- Use imperative mood (`add`, `fix`, `update` not `adding`, `fixed`, `updated`)
- Focus on the "what" in title, save "why" and "how" for description
- Include conventional commit prefix (`feat:`, `fix:`, `docs:`, etc.)
- Be specific but concise (`fix auth bug` → `fix: resolve login timeout issue`)

## Quality Gates

### Code Quality Requirements

- **TypeScript**: Zero compilation errors
- **Testing**: 80% coverage maintained, relevant tests pass
- **Standards**: Follows context-aware .agent/ patterns
- **ESM**: Uses ES modules (except preload script)
- **IPC**: Direct calls without unnecessary availability checks

### Documentation Requirements

- **Task hygiene**: Relevant Files section updated
- **Schema changes**: docs/developer/romper-db.md updated if needed
- **New patterns**: .agent/ standards updated if new patterns emerge

### Architecture Compliance

- **Hook-based**: React business logic in custom hooks
- **DbResult pattern**: Database operations return consistent DbResult<T>
- **Reference-only**: Samples stored as paths, not copied until sync
- **Single responsibility**: Each module has one clear purpose

## Error Handling

### When Tasks Cannot Be Completed

1. **Identify blocking issue**: Missing dependencies, technical problems, unclear requirements
2. **Document the blocker**: Add to task list as sub-task or note
3. **Propose alternatives**: Suggest different approach or prerequisite work
4. **Seek clarification**: Ask user for guidance on resolution

### When Tasks Are Already Complete

1. **Verify implementation**: Check if existing code meets requirements
2. **Validate against standards**: Ensure code follows current .agent/ patterns
3. **Update if needed**: Refactor to meet current standards if outdated
4. **Mark complete**: Update task list if verification passes

## Anti-Patterns to Avoid

### Task Execution

- ❌ **Multi-task execution**: Never work on multiple tasks simultaneously
- ❌ **Skipping validation**: Commit changes to trigger automatic validation
- ❌ **Marking incomplete work**: Only mark [x] when fully implemented
- ❌ **Ignoring dependencies**: Check prerequisites before starting

### Code Implementation

- ❌ **Bypassing standards**: Always follow context-aware .agent/ patterns
- ❌ **Over-defensive IPC**: Don't check availability of guaranteed methods
- ❌ **CommonJS usage**: Use ESM except in preload script
- ❌ **Business logic in components**: Use custom hooks for logic

## Success Criteria

### Task Completion Checklist

- [ ] Task requirement fully implemented
- [ ] Code follows .agent/ standards for file type
- [ ] Documentation updated (task list, relevant files, schema if needed)
- [ ] Changes committed (automatic validation via pre-commit hooks)
- [ ] No regressions introduced in existing functionality
- [ ] User approval received before proceeding

---

_This framework ensures systematic, high-quality task execution while maintaining project standards and architecture integrity._
