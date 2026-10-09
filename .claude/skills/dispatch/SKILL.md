---
name: dispatch
description: Subagent dispatch templates for Romper. Use when a coordinating session starts a subagent for a Romper task (CI watching, a fix, a feature, an investigation, a spec) to pick the right model, fill in the matching prompt template, and pass the shared repo rules.
---

A coordinating session uses this to start a subagent. The templates set the
model and point the subagent at the shared rules in
[`templates/conventions.md`](templates/conventions.md), so the rules live in
one place and each prompt stays short.

## Steps

1. **Pick a template** from the table below. When two fit, take the higher
   tier.
2. **Copy** the template's prompt (everything under its `---` line) and
   replace every `{{placeholder}}`. Delete a section only if it is empty
   ("none" is a fine answer; a leftover `{{...}}` is not).
3. **Start the subagent** with that text as its prompt and the template's
   model set explicitly, not inherited from the coordinator.
4. **Read the final report** (format in `conventions.md`). Product decisions
   in it are Pete's: pass them on with the recommendation.

## Which template

| Template                                    | Model            | Use for                                                                                                                                                                                                                                |
| ------------------------------------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`mechanic`](templates/mechanic.md)         | Haiku            | Mechanical work with one right answer: watching CI and SonarCloud, reruns, worktree clean-up, recording decisions and labels on issues, Dependabot bumps, regenerating screenshots, status roll-ups, shipping PRs with `npm run ship`. |
| [`implementer`](templates/implementer.md)   | Sonnet (default) | A fix or feature the issue already specifies, bulk refactors and type fixes, Sonar, test and conflict fixes on the author's own PR, docs.                                                                                              |
| [`investigator`](templates/investigator.md) | Opus             | Root causes, plans and contracts (specs, IPC, data formats), anything touching the card write, migrations, `_save` or a release.                                                                                                       |

## Filling one in

- `{{issue}}`: the issue number (`#N`) the work fixes, or "none" with the
  reason.
- `{{goal}}`: one or two sentences saying what done looks like.
- `{{context}}`: what the subagent can't see: links to the issue, PR or
  spec, relevant files, what other sessions are doing. A cloud session sees
  only what is pushed, so put it on GitHub or in the repo first.
- `{{decisions_made}}`: choices already settled, especially Pete's, with
  where they are recorded. The subagent must not reopen them.
- `{{out_of_scope}}`: what to leave alone, even if it looks wrong. The
  subagent reports it instead of fixing it.
- `{{worktree_name}}`: a short kebab-case name, also the branch slug.

## The coordinator's duties

- Before shipping a Haiku or Sonnet PR that touches `electron/main` or the
  card write, read its diff yourself.
- Move a task that stalls or comes back wrong up a tier, and say what the
  lower tier got wrong in the new prompt's `{{context}}`.
- Subagents report decisions for Pete; they never make them. Relay each with
  its recommendation.
