#!/bin/bash
# Block file edits unless we're in a git worktree (not the main working tree)
INPUT=$(cat)
CWD=$(echo "$INPUT" | jq -r '.cwd')

# Check if git worktree — .git is a file (not a directory) in worktrees
if [ -f "$CWD/.git" ] || git -C "$CWD" rev-parse --is-inside-work-tree &>/dev/null && \
   [ "$(git -C "$CWD" rev-parse --git-common-dir 2>/dev/null)" != "$(git -C "$CWD" rev-parse --git-dir 2>/dev/null)" ]; then
  exit 0  # In worktree, allow
fi

echo "BLOCKED: You must create a worktree before editing files. Run: npm run worktree:create <task-name>" >&2
exit 2
