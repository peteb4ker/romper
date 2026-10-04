import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

// The PreToolUse hook that stops a Claude session bypassing git hooks or
// pushing to main. Each command is piped through it the way Claude Code
// does: exit 2 blocks the command, exit 0 lets it run.
const HOOK = path.resolve(__dirname, "../../.claude/hooks/guard-git.sh");

function runHook(command: string) {
  const result = spawnSync("bash", [HOOK], {
    encoding: "utf8",
    // A directory outside any repo, so the on-main check stays out of it.
    input: JSON.stringify({ cwd: os.tmpdir(), tool_input: { command } }),
  });
  // A hook that never ran has no status; say why instead of "null" (#597).
  if (result.error) {
    throw new Error(`Couldn't run guard-git.sh: ${result.error.message}`);
  }
  return result.status;
}

const BLOCKED = 2;
const ALLOWED = 0;

describe.skipIf(process.platform === "win32")("[Q-07] guard-git.sh", () => {
  it.each([
    "HUSKY=0 git commit -m x",
    "git commit --no-verify -m x",
    "git commit -n -m x",
    "git -c core.hooksPath=/dev/null commit -m x",
    "git push origin main",
    "git push origin HEAD:main",
    "cd /tmp && git push origin refs/heads/main",
    "gh pr merge 12 --admin",
  ])("blocks %s", (command) => {
    expect(runHook(command)).toBe(BLOCKED);
  });

  // #545: quoting the dangerous part used to hide it from the checks.
  it.each([
    `HUSKY="0" git commit -m x`,
    `HUSKY='0' git commit -m x`,
    `export HUSKY="0"; git commit -m x`,
    `git commit "--no-verify" -m x`,
    `git commit '--no-verify' -m x`,
    `git commit --no-verif"y" -m x`,
    `git commit --no-verif\\y -m x`,
    `git push origin "main"`,
    `git push origin 'main'`,
    `git push origin "HEAD:main"`,
    `git push origin $'main'`,
  ])("blocks the quoted form %s", (command) => {
    expect(runHook(command)).toBe(BLOCKED);
  });

  // What the stripping is for: prose that mentions a flag or a push to main.
  it.each([
    `git commit -m "fix: stop HUSKY=0 and --no-verify getting through"`,
    `git commit -m 'docs: never git push origin main'`,
    `git commit -m "fix(hooks): catch \\"--no-verify\\" in quotes"`,
    `git commit -F - <<'EOF'\nfix: catch git push origin main\n\nHUSKY=0 and --no-verify too\nEOF`,
    `git commit -m "$(cat <<'EOF'\nfix: catch HUSKY=0\n\ngit push origin main\nEOF\n)"`,
    `gh pr create --title "fix(hooks): quoted --no-verify" --body "Pushing to main with git push origin main is refused."`,
    `echo "HUSKY=0 git commit --no-verify"`,
    "git push -u origin fix/545-guard-git-quotes",
    `git push origin "feature/main-menu"`,
    "git commit -m wip",
    `git commit -m "wip"`,
    "gh pr list --base main",
  ])("allows %s", (command) => {
    expect(runHook(command)).toBe(ALLOWED);
  });
});
