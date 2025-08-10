# Task Tracking Rules for Claude

## CRITICAL: Task Completion Protocol

### When Working on Tasks:

1. **Before starting a task**: Update TodoWrite to mark it as "in_progress"
2. **After completing a task**:
   - Mark it as complete in TodoWrite
   - Update tasks-PRD.md to mark the task with [x]
   - Commit the tasks-PRD.md changes with the code changes

### Task Status Management:

- Use TodoWrite for immediate task tracking during the session
- Update tasks-PRD.md for permanent record of completion
- Keep both in sync at all times

### Verification Steps:

1. After marking a task complete, verify:
   - Code works and tests pass
   - Task is marked [x] in tasks-PRD.md
   - TodoWrite shows task as "completed"
   - Changes are committed

### Current Task Status Check:

Always check both:

- TodoWrite (session state)
- tasks-PRD.md (permanent state)

## Example Workflow:

```
1. Read task from tasks-PRD.md
2. Add to TodoWrite as "pending"
3. Mark as "in_progress" in TodoWrite
4. Do the work
5. Run tests
6. Mark as "completed" in TodoWrite
7. Update tasks-PRD.md with [x]
8. Commit all changes including tasks-PRD.md
```

## Red Flags:

- Completing work without updating task list
- Moving to next task without marking previous complete
- TodoWrite out of sync with tasks-PRD.md
- Forgetting to commit tasks-PRD.md updates
