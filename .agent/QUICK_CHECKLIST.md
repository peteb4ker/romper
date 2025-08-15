# Agent Quick Checklist - CHECK FIRST!

## Pre-Work Verification (Required Before ANY Changes)

**STOP:** Before making any file changes or commits, verify all of these:

### ✅ Location & Workflow
- [ ] **Am I in a worktree?** `pwd` must show `/worktrees/` directory
- [ ] **Is terminal named correctly?** Should be `branch-name` (then `branch-name-pr-123`)
- [ ] **Latest main pulled?** Required before creating worktrees for parallel agents
- [ ] **Working on ONE task only?** Focus on single task from tasks-PRD.md

### ✅ Git Workflow Rules
- [ ] **NEVER merge** - ALWAYS rebase: `git rebase origin/main` 
- [ ] **ALL tasks use worktrees** - never work directly on branches
- [ ] **Rebase before pushing** any changes to remote

### ✅ PR Review Protocol (CRITICAL)
- [ ] **Follow exact suggestions** - don't "improve" on reviewer feedback
- [ ] **Address ALL comments systematically** - never skip or batch
- [ ] **Only resolve conversations marked as outdated** - never resolve active issues
- [ ] **Test reviewer's exact code** before trying alternatives

## Red Flags - STOP and Fix
❌ Working in main repository root instead of worktree
❌ Terminal not renamed to branch name
❌ Trying to "improve" exact reviewer suggestions
❌ Resolving conversations with outstanding issues
❌ Using `git merge` instead of `git rebase`

## Quick Commands
```bash
# Verify location
pwd  # Should be in /worktrees/

# Check branch
git branch  # Should NOT be main

# Rebase before push
git fetch origin main && git rebase origin/main

# PR monitoring
gh pr checks <pr-number>
gh pr view <pr-number> --comments
```

---
**Remember:** These rules prevent the most common workflow violations. Reference this checklist FIRST, before starting any work.