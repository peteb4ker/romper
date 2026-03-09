#!/bin/bash
# Block file edits to the main working tree — require worktree usage
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // empty')

# If no file path provided, allow (defensive)
if [ -z "$FILE_PATH" ]; then
  exit 0
fi

PROJECT_DIR="$CLAUDE_PROJECT_DIR"

# Guard: if PROJECT_DIR is unset, allow (don't block without context)
if [ -z "$PROJECT_DIR" ]; then
  exit 0
fi

# Allow writes outside the project directory (e.g., ~/.claude/plans/)
case "$FILE_PATH" in
  "$PROJECT_DIR"/*) ;; # Inside project, continue checks
  *) exit 0 ;;         # Outside project, allow
esac

# Allow writes inside a worktree subdirectory
case "$FILE_PATH" in
  "$PROJECT_DIR"/worktrees/*) exit 0 ;;
esac

# File is inside the main repo but NOT in a worktree — block
echo "BLOCKED: You must create a worktree before editing project files." >&2
echo "Run: npm run worktree:create <task-name>" >&2
echo "Then edit files in worktrees/<task-name>/ using absolute paths." >&2
exit 2
