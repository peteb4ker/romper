<!-- Title: conventional, ending with the issue number, e.g. "fix(scan): keep stereo samples stereo after importing a card (#537)". Branch: fix/<issue>-<slug>. -->

## What and why

<!-- What a user notices, and what changed. -->

## Siblings

<!-- Other callers or code paths with the same bug, and what happened to each: fixed here, or filed as an issue (link it). "None found" is an answer. If this PR deletes an API, IPC channel or exported function, re-check its callers on current main when rebasing to merge (`git grep <name> origin/main`). -->

## Decisions

<!-- A UX or product choice this PR makes (shortcut, wording, behaviour): link Pete's sign-off on the issue. Delete if none. -->

## Verified

<!-- Tests added or run (tagged [UC-NN] / [Q-NN]), and anything checked by hand. Claims about Rample behaviour quote the manual or say "unverified on hardware". -->

## Before handover

<!-- The author ticks these before handing the PR to the shepherd. How to check each: the ship-pr skill, "Before handover" (.claude/skills/ship-pr/SKILL.md). -->

- [ ] Rebased on current `origin/main`
- [ ] `npm run typecheck` passes (both configs)
- [ ] `npm run test:e2e` passes, or the PR doesn't touch `electron/main`, app startup or the write path
- [ ] SonarCloud shows 0 new issues on this PR, not just a passing quality gate (`npm run sonar:pr -- <N>`)
- [ ] The removal grep shows nothing this PR removes is still used on main (or it removes nothing)

Fixes #
