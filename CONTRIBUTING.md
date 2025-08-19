<!-- 
title: Contributing to Romper Sample Manager
owners: maintainer, developer-team
last_reviewed: 2025-08-15
tags: contributing, development, documentation
-->

# Contributing to Romper Sample Manager

Thank you for your interest in contributing to Romper Sample Manager! This guide covers development standards for both human contributors and AI agents.

## Development Workflow

### Agent Workflow (MANDATORY)

ALL agent development work MUST use the worktree workflow to enable **concurrent multi-agent development**:

```bash
# 1. Create isolated worktree
npm run worktree:create <task-name>

# 2. Work in isolation
cd worktrees/<task-name>

# 3. Enhanced commit with quality checks
npm run commit "description"

# 4. Clean up when done
npm run worktree:remove <task-name>
```

**Why worktrees**: Worktrees enable multiple agents to work simultaneously on different features without conflicts. Each agent operates in complete isolation while staying synchronized with the latest main branch changes.

**Compliance check**: verify agent commits originate from worktree branches only

### Human Workflow (RECOMMENDED)

Human contributors are encouraged to use the worktree workflow but may use standard Git workflows if preferred.

## Code Quality Standards

### Pre-commit Requirements

Every commit MUST pass:

- **TypeScript compilation**: `npm run typecheck`
- **Linting**: `npm run lint:check`
- **Tests**: `npm run test:fast`
- **Build verification**: `npm run build`
- **Documentation compliance**: `npm run docs:check`

**Compliance check**: exit nonzero if any pre-commit check fails

### Code Standards

- Follow existing code conventions in the codebase
- Run `npx tsc --noEmit` before committing
- Maintain test coverage
- Use ESLint and Prettier configurations
- Follow architectural patterns established in the project

## Commit Message Standards

### Commit Types

- **feat:** new features or capabilities
- **fix:** bug fixes
- **refactor:** code restructuring without changing functionality
- **docs:** documentation changes
- **test:** adding or updating tests
- **chore:** maintenance tasks, dependencies, build changes

### Format

```
type: brief description in imperative mood

- Bullet point details of changes
- Use present tense, imperative mood ("add", not "added" or "adds")
- Reference task numbers when applicable (e.g., "Task 5.0")
- Mention test status if relevant
```

### Important Rules

- ✅ Use imperative mood ("add", not "added")
- ✅ Brief, descriptive subject line (50 chars or less)
- ✅ Bullet points for details when needed
- ✅ Reference task numbers when applicable
- ❌ **No authorship, co-author tags, or AI attribution**
- ❌ No generic messages like "Update files" or "Fix issues"

## CI/CD Requirements

Our CI/CD pipeline enforces:

```bash
# Code quality (primary focus)
npm run lint:check || exit 1
npm run typecheck || exit 1
npm run test || exit 1
npm run build || exit 1

# Documentation compliance (agent alignment)
npm run docs:check || exit 1
```

### Quality Standards

- **Test coverage**: Must maintain current levels
- **Linting**: Zero errors or warnings
- **TypeScript**: Zero compilation errors
- **Documentation compliance**: Must be ≥75% (for agent alignment)

## Getting Help

- **Code setup**: See [Development Workflow](./docs/developer/development-workflow.md)
- **Architecture**: See [Architecture Overview](./docs/developer/architecture.md)
- **Documentation issues**: Run `npm run docs:check` for reports

## Quality Focus

Code quality is the primary concern. Documentation standards exist solely to keep AI agents aligned when reading and writing documentation.

Thank you for contributing to Romper Sample Manager!

---

## Documentation Standards (Agent Alignment Only)

**Purpose**: Keep AI agents aligned when reading `.agent/` directory documentation. This is purely for agent coordination and **not a development requirement for humans**.

### For Human Contributors

Write **comprehensive, verbose documentation** as normal:
- **README files**: Detailed front page for users
- **Technical docs**: Full explanations in `docs/` directory  
- **Task tracking**: Detailed progress in `tasks/` files
- **No documentation compliance requirements** for human work

### For AI Agents Only

**Token efficiency rules apply ONLY to `.agent/` directory:**
- Checklist items: ≤ 20 tokens
- Procedural steps: ≤ 50 tokens  
- Summaries: ≤ 75 tokens
- One requirement per line
- Use `**Compliance check**:` markers for verifiable requirements

**Scope**: These rules ensure agents stay aligned with project standards. Human contributors should ignore these restrictions and focus on comprehensive documentation.

### Universal Requirements

All Markdown files need basic structure:

```yaml
---
title: "Human readable title"
owners: ["team-or-agent"]
last_reviewed: "YYYY-MM-DD"
tags: ["category"]
---
```

- Exactly one H1 heading matching title
- No broken internal links
- Proper Markdown links instead of backticked paths