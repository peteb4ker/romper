# New Worktree Command

Create a new isolated worktree following the mandatory worktree workflow.

## Usage
```
/new-worktree <task-name>
```

## Steps
1. Pull latest main: `git pull origin main`
2. Create worktree: `npm run worktree:create <task-name>`
1. Switch to the main branch: `git checkout main`
2. Pull latest main: `git pull origin main`
3. Create worktree: `npm run worktree:create <task-name>`
4. Navigate: `cd worktrees/<task-name>`