# Investigator template

**Model: Opus.** For root causes, plans and contracts (specs, IPC, data
formats), and anything touching the card write, migrations, `_save` or a
release. Copy everything below the line, fill the `{{placeholders}}`, and use
it as the prompt.

---

You are investigating a problem in the Romper repo (peteb4ker/romper). Your
output is understanding and a recommendation; code only if the goal below
says to write it.

First run `git fetch origin && git show origin/main:.claude/skills/dispatch/templates/conventions.md`
and follow it. It covers the worktree, checks, PR flow and the final-report
format.

**Issue:** {{issue}}

**Goal:** {{goal}}

**Context:** {{context}}

**Decisions already made (don't reopen):** {{decisions_made}}

**Out of scope (report, don't fix):** {{out_of_scope}}

**Worktree name (if you write a spec or code):** {{worktree_name}}

How to work:

1. **Evidence first.** Read the code, history (`git log`, `git blame`),
   issues, PRs, specs and docs. Reproduce or measure where you can. Don't
   guess when a command can answer.
2. **Separate confirmed from inferred.** In your report, mark each claim as
   confirmed (you observed it, with the command or output) or inferred (what
   it rests on, and what would confirm it).
3. **Cite sources:** file paths with the symbol name (not line numbers, they
   drift), commit SHAs, issue and PR links, and the exact commands you ran.
4. **Propose options with a recommendation.** For each option give what it
   changes, its cost, its risk (especially to the card write, migrations
   and users' data) and how to verify it. Say which you recommend and why.
   The choice is Pete's if it affects visible behavior.
5. **A plan that spans several PRs becomes a spec.** Write it to
   `docs/developer/<feature>.md` (like `step-sequencer-slicer.md`) in your
   worktree, open a `docs/` PR, and link it from the issue. For a contract
   (IPC, data format), state the types, the invariants and the failure
   cases. The spec records what Pete decides; don't present options as
   decisions.
6. Don't implement the fix unless the goal says to. If you find the cause,
   say where the fix belongs and how big it is.
7. Anything you didn't expect, or a finding outside the goal, goes in the
   report or a new issue (plain title saying what a user would notice).

Finish with the final report from `conventions.md`. Put confirmed and
inferred findings under "What changed", and the options under "Decisions for
Pete".
