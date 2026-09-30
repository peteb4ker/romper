#!/bin/bash
# PreToolUse(Edit|Write|NotebookEdit): block edits to this repo's main
# checkout; changes belong in a worktree. Asks git rather than matching
# paths, so it works wherever worktrees live (the sibling romper-worktrees/
# dir, Claude Code's .claude/worktrees/, or the legacy in-repo worktrees/).
INPUT=$(cat)
FILE_PATH=$(printf '%s' "$INPUT" | jq -r '.tool_input.file_path // .tool_input.notebook_path // .tool_input.path // empty' 2>/dev/null)
[ -z "$FILE_PATH" ] && exit 0

# The file may not exist yet; start from its nearest existing directory.
DIR=$(dirname "$FILE_PATH")
while [ ! -d "$DIR" ] && [ "$DIR" != "/" ]; do DIR=$(dirname "$DIR"); done

GIT_DIR=$(git -C "$DIR" rev-parse --path-format=absolute --git-dir 2>/dev/null) || exit 0
COMMON_DIR=$(git -C "$DIR" rev-parse --path-format=absolute --git-common-dir 2>/dev/null) || exit 0

# A linked worktree has its own git dir; only the main checkout shares it.
[ "$GIT_DIR" != "$COMMON_DIR" ] && exit 0

# Only guard this repository, not other repos Claude might touch.
PROJECT_COMMON=$(git -C "${CLAUDE_PROJECT_DIR:-.}" rev-parse --path-format=absolute --git-common-dir 2>/dev/null)
[ "$COMMON_DIR" != "$PROJECT_COMMON" ] && exit 0

# Gitignored files in the main checkout (e.g. .claude/settings.local.json,
# .env.local) aren't part of any change; allow them.
git -C "$DIR" check-ignore -q "$FILE_PATH" 2>/dev/null && exit 0

echo "BLOCKED: $FILE_PATH is in the main checkout. Make changes in a worktree:" >&2
echo "  npm run worktree:create <task-name>   (creates ../romper-worktrees/<task-name>)" >&2
exit 2
