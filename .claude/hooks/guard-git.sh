#!/bin/bash
# PreToolUse(Bash) guard for the repo's hard git rules:
#   - no hook bypass (--no-verify, -n on commit, HUSKY=0)
#   - no commits on main, no pushes to main
# Matches anywhere in the command, so `cd x && git push origin HEAD:main`
# and `git -C path push` are caught too.
INPUT=$(cat)
COMMAND=$(printf '%s' "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null)
[ -z "$COMMAND" ] && exit 0

# Drop heredoc bodies and quoted strings, so commit messages that mention a
# flag or `git push origin main` don't trip the checks.
COMMAND=$(printf '%s\n' "$COMMAND" | awk '
  delim != "" { line = $0; gsub(/^[ \t]+|[ \t]+$/, "", line); if (line == delim) delim = ""; next }
  match($0, /<<-?[ \t]*["\047]?[A-Za-z_][A-Za-z0-9_]*/) {
    d = substr($0, RSTART, RLENGTH); sub(/^<<-?[ \t]*["\047]?/, "", d); delim = d
  }
  { print }')
COMMAND=$(printf '%s' "$COMMAND" | sed -E "s/'[^']*'//g; s/\"[^\"]*\"//g")

block() {
  echo "BLOCKED: $1" >&2
  exit 2
}

if printf '%s' "$COMMAND" | grep -qE '(^|[^[:alnum:]_])HUSKY=0'; then
  block "HUSKY=0 bypasses the pre-commit hook. Fix the failing check instead."
fi

if printf '%s' "$COMMAND" | grep -qE '\bgit\b.*--no-verify'; then
  block "--no-verify bypasses git hooks. Fix the failing check instead."
fi

if printf '%s' "$COMMAND" | grep -qE '\bgit\b[^;&|]*\bcommit\b[^;&|]*[[:space:]]-[[:alpha:]]*n'; then
  block "git commit -n bypasses git hooks. Fix the failing check instead."
fi

if printf '%s' "$COMMAND" | grep -qE '\bcore\.hooksPath\b'; then
  block "Overriding core.hooksPath bypasses git hooks. Fix the failing check instead."
fi

# enforce_admins is off on main, so --admin merges past required checks.
if printf '%s' "$COMMAND" | grep -qE '\bgh\b[^;&|]*\bpr\b[^;&|]*\bmerge\b[^;&|]*--admin'; then
  block "gh pr merge --admin skips required checks. Let CI pass (see the ship-pr skill)."
fi

# Pushing to main by refspec (origin main, HEAD:main, refs/heads/main).
if printf '%s' "$COMMAND" | grep -qE '\bgit\b[^;&|]*\bpush\b[^;&|]*([[:space:]:]|refs/heads/)main([[:space:]]|$)'; then
  block "Never push to main. Push your branch and open a PR."
fi

# Check the branch where the command runs (the hook input's cwd), not the
# hook process's own directory, which may be a different checkout.
CWD=$(printf '%s' "$INPUT" | jq -r '.cwd // empty' 2>/dev/null)
BRANCH=$(git -C "${CWD:-.}" branch --show-current 2>/dev/null)
if [ "$BRANCH" = "main" ] && printf '%s' "$COMMAND" | grep -qE '\bgit\b[^;&|]*\b(commit|push)\b'; then
  block "On main. Work in a worktree branched from origin/main (npm run worktree:create <task-name>)."
fi

exit 0
