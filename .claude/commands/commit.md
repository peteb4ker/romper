---
description: Create a detailed git commit with pre-commit validation following project best practices
argument-hint: optional commit message
allowed-tools: Bash, Grep, Read, Edit, TodoWrite
---

I'll create a detailed git commit following the project's best practices, ensuring all pre-commit checks pass before finalizing the commit.

**CRITICAL**: I will NEVER use `--no-verify`. All pre-commit issues (tests, linting, type checking, etc.) must be fixed iteratively by adding changes to the working copy.

Let me start by analyzing the current changes:

!git status --porcelain

!git diff --cached --stat

!git diff --stat

Now I'll analyze what has been modified:

!git diff --cached --name-only | head -10

Based on the changes, I'll create a commit message following these patterns:

- Use conventional commit format: `type: description`
- Common types: feat, fix, test, refactor, docs, chore
- Be specific about what was changed
- Keep the summary under 72 characters

Now I'll attempt the commit. If pre-commit hooks fail, I will:

1. **Analyze the failures** (lint, test, type errors, etc.)
2. **Fix each issue** by editing the relevant files
3. **Add the fixes** to the staging area
4. **Retry the commit** until all checks pass
5. **Repeat iteratively** until the commit succeeds

This ensures we never commit broken/unlinted code and then fix it in a separate commit.

If you provided a commit message argument, I'll use that as guidance: $ARGUMENTS
