// Where feature worktrees live, shared by worktree-create and worktree-remove.
//
// Worktrees go in a sibling of the main checkout (e.g. ~/workspace/romper ->
// ~/workspace/romper-worktrees/<task>), not inside it. Nested worktrees get
// picked up by every tool that walks the repo (ESLint, Vitest, Playwright,
// Vite's watcher, search), and hooks running from the main checkout mistake
// them for the main tree. Override the location with ROMPER_WORKTREES_DIR.

import { execSync } from "child_process";
import path from "path";

/** The main checkout's root, from any worktree. */
export function getMainRoot() {
  const gitCommonDir = execSync(
    "git rev-parse --path-format=absolute --git-common-dir",
    {
      encoding: "utf8",
    },
  ).trim();
  return path.dirname(gitCommonDir);
}

/** Directory that holds feature worktrees. */
export function getWorktreesDir(mainRoot = getMainRoot()) {
  if (process.env.ROMPER_WORKTREES_DIR) {
    return path.resolve(process.env.ROMPER_WORKTREES_DIR);
  }
  return path.join(
    path.dirname(mainRoot),
    `${path.basename(mainRoot)}-worktrees`,
  );
}

/**
 * Parse `git worktree list --porcelain` into [{ path, head, branch }].
 * `branch` is undefined for a detached HEAD.
 */
export function listWorktrees(mainRoot = getMainRoot()) {
  const output = execSync("git worktree list --porcelain", {
    cwd: mainRoot,
    encoding: "utf8",
  });
  const worktrees = [];
  let current = null;
  for (const line of output.split("\n")) {
    if (line.startsWith("worktree ")) {
      if (current) worktrees.push(current);
      current = { path: line.slice("worktree ".length) };
    } else if (line.startsWith("HEAD ") && current) {
      current.head = line.slice("HEAD ".length);
    } else if (line.startsWith("branch ") && current) {
      current.branch = line.slice("branch refs/heads/".length);
    }
  }
  if (current) worktrees.push(current);
  return worktrees;
}
