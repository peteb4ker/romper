---
title: "Contributing to Romper Sample Manager"
owners: ["maintainer", "developer-team"]
last_reviewed: "2025-08-15"
tags: ["contributing", "development", "documentation"]
---

# Contributing to Romper Sample Manager

Thank you for your interest in contributing to Romper Sample Manager! This guide applies equally to both human contributors and AI agents.

## Documentation Standards (ENFORCED)

All contributors MUST follow our documentation compliance standards. These rules are enforced by automated tools and CI/CD pipelines.

### Required Document Structure

Every Markdown file MUST include:

```yaml
---
title: "Human readable title"
owners: ["team-or-agent"]
last_reviewed: "YYYY-MM-DD"
tags: ["category"]
---
```

1. **Exactly one H1 heading** that matches the frontmatter title
2. **A 2-5 sentence summary** after the title
3. **For procedures**: Prerequisites, numbered steps, and verification methods

### Link Requirements

- **No broken internal links**: All links must resolve to existing files
- **No backticked path references**: Use proper Markdown links `[Title](path.md)`
- **Canonical references only**: Link to primary documentation, not duplicates

### Compliance Enforcement

#### For All Contributors

Before any PR can be merged:

1. **Documentation audit MUST pass**: `npm run docs:check`
2. **Compliance score MUST be 100%**
3. **All broken links MUST be fixed**
4. **All documents MUST have valid frontmatter**

#### For AI Agents

AI agents MUST:

1. **Start every development session** by running `npm run docs:check`
2. **Produce structured compliance reports** in JSON format
3. **Self-verify compliance** before making any documentation changes
4. **Never bypass or skip compliance checks**

## Development Workflow (MANDATORY)

### Worktree Usage

ALL development work MUST use the worktree workflow:

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

### Pre-commit Requirements

Every commit MUST pass:

- **TypeScript compilation**: `npm run typecheck`
- **Linting**: `npm run lint:check`
- **Tests**: `npm run test:fast`
- **Documentation compliance**: `npm run docs:check`
- **Build verification**: `npm run build`

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

## Quality Standards

### CI/CD Requirements

Our CI/CD pipeline enforces:

```bash
# Documentation compliance
npm run docs:check || exit 1

# Code quality
npm run lint:check || exit 1
npm run typecheck || exit 1
npm run test || exit 1
npm run build || exit 1
```

### Compliance Scores

- **Documentation compliance**: Must be 100%
- **Test coverage**: Must maintain current levels
- **Linting**: Zero errors or warnings
- **TypeScript**: Zero compilation errors

## Getting Help

- **Documentation issues**: Run `npm run docs:check` for detailed reports
- **Development setup**: See [Development Workflow](./docs/developer/development-workflow.md)
- **Architecture questions**: See [Architecture Overview](./docs/developer/architecture.md)

## Enforcement

- **Non-compliant commits**: Automatically rejected
- **Non-compliant PRs**: Cannot merge until fixed
- **Repeated violations**: May result in contributor restrictions

Thank you for helping maintain our quality standards!
