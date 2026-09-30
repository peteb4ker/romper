---
description: Create a new isolated worktree following the mandatory worktree workflow
argument-hint: "[task-name]"
---

Create a new worktree for task `$ARGUMENTS`:

1. Create the worktree: `npm run worktree:create $ARGUMENTS`
   (the script fetches origin and branches `feature/$ARGUMENTS` from
   `origin/main` — no manual pull or checkout needed)
2. Work in the path it prints, `../romper-worktrees/$ARGUMENTS` next to the
   main checkout, using absolute paths.
3. Confirm the branch base is clean: `git log --oneline origin/main..HEAD`
   should be empty before any commits are made.
