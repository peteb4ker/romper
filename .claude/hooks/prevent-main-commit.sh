#!/bin/bash
# Block git commit and git push when on main branch
INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

# Only check git commit/push commands
if ! echo "$COMMAND" | grep -qE '^\s*git (commit|push)'; then
  exit 0
fi

BRANCH=$(git branch --show-current 2>/dev/null)
if [ "$BRANCH" = "main" ]; then
  echo "BLOCKED: Cannot commit/push on main. Use worktree workflow: npm run worktree:create <task-name>" >&2
  exit 2
fi

exit 0
