---
applyTo: '**/tasks-*.md'
---
# Task List Management

Guidelines for managing task lists in markdown files to track progress on completing a PRD

## Task Implementation
- **One sub-task at a time:** Do **NOT** start the next sub‑task until you ask the user for permission and they say “yes” or "y"
- **Validation**
   - When you are done with a task, when all tests pass and immediately before offering to move on to the next task, check the newly added code for potential refactorings that may remove any spurious code.
- **Completion protocol:**
  1. When you finish a **sub‑task**, immediately mark it as completed by changing `[ ]` to `[x]`.
  2. If **all** subtasks underneath a parent task are now `[x]`, also mark the **parent task** as completed.
- Stop after each sub‑task and wait for the user’s go‑ahead.

## Task List Maintenance

1. **Update the task list as you work:**
   - Mark tasks and subtasks as completed (`[x]`) per the protocol above.
   - Add new tasks as they emerge.

2. **Maintain the “Relevant Files” section:**
   - List every file created or modified.
   - Give each file a one‑line description of its purpose.

## AI Instructions

When working with task lists, the AI must:

1. Regularly update the task list file after finishing any significant work.
2. Follow the completion protocol:
   - Mark each finished **sub‑task** `[x]`.
   - Mark the **parent task** `[x]` once **all** its subtasks are `[x]`.
3. Add newly discovered tasks.
4. Keep “Relevant Files” accurate and up to date.
5. Before starting work, check which sub‑task is next.
6. After implementing a sub‑task, update the file and then pause for user approval.
7. Before starting on a task, check whether it has already been implemented.

## Accessibility

- All UI elements must be accessible in both light and dark modes, including keyboard navigation, visible focus indicators, and sufficient color contrast.
- All kits in KitList must be keyboard focusable and have a visible focus indicator when focused (see 5.5.4).
- Accessibility must be considered and tested for every UI-related task.

## Accessibility Note

- All UI elements must be accessible in both light and dark mode, with sufficient color contrast and keyboard navigation support. Accessibility must be verified for every new or updated UI feature.
- Aria / screen reader compatibility is not required.
- For element selection, we can use internal selection. focus() is not important.

## Checks

- A task or sub-task may only be marked as complete ([x]) after the corresponding code has been implemented or changed in the codebase.

- Do not mark a task as complete based on planning or intent alone.
- Each completion must be accompanied by a code change (or verification that the code already exists and meets requirements).
- If a task is marked complete in error, revert it to incomplete ([ ]) until the code is present.

## Romper DB Schema Documentation
- Any change to the Romper DB schema (including migrations, new tables, or column changes) **must** be reflected in `/docs/romper-db.md`.
- The ERD in that file must always match the current schema in `/src/main/dbIpcHandlers.ts` and related DB code.
