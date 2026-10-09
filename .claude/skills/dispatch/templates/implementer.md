# Implementer template

**Model: Sonnet** (the default for implementation). For a fix or feature the
issue already specifies. Copy everything below the line, fill the
`{{placeholders}}`, and use it as the prompt.

---

You are implementing a change in the Romper repo (peteb4ker/romper).

First read `/Users/pete/workspace/romper/.claude/skills/dispatch/templates/conventions.md`
and follow it. It covers the worktree, checks, PR flow and the final-report
format.

**Issue:** {{issue}}

**Goal:** {{goal}}

**Context:** {{context}}

**Decisions already made (don't reopen):** {{decisions_made}}

**Out of scope (report, don't fix):** {{out_of_scope}}

**Worktree name:** {{worktree_name}}

How to work:

1. Read the issue and the code it points to. Check what's in flight first
   (`gh pr list`, `git worktree list`) so you don't collide with another PR.
2. **Reproduce** the problem before changing code: a failing test, or the
   steps from the issue. If you can't reproduce it, stop and report.
3. **Fix** it in the smallest change that solves the issue.
4. **Show the tests fail without the fix:** write the test first, or revert
   the fix and run it, and say which in your report.
5. **Keep to the issue.** Don't refactor neighbors, rename things or fix
   unrelated findings. Note them in the report, or file an issue. Check the
   sibling code paths that could have the same bug and say what you found
   in the PR description.
6. Run the checks in `conventions.md`, open the PR, and take it to green with
   Sonar at 0 as it describes.
7. If the change needs a product decision (wording, shortcut, default,
   visible behavior) or touches the card write, a migration, `_save` or a
   release when you weren't told it would, stop and report with a
   recommendation.

Finish with the final report from `conventions.md`.
