---
name: release
description: Cut a Romper release or release candidate — version-bump PR, tag, automated build/sign/publish. Use to release a new version, cut an RC, or promote an RC to stable.
argument-hint: "[version, e.g. 1.4.0 or 1.4.0-rc.1]"
disable-model-invocation: true
allowed-tools: Bash(git fetch *), Bash(git tag *), Bash(git log *), Bash(npm version *)
---

Cut release `$ARGUMENTS` (a bare semver, no `v` prefix; the tag adds it).

## Non-negotiables

- **A hyphen in the tag marks it prerelease.** `.github/workflows/release.yml`
  derives `prerelease` and `makeLatest` from `contains(github.ref_name, '-')`.
  The macOS auto-updater (update.electronjs.org) serves whatever GitHub marks
  **Latest**, so tagging a test build in stable format (`v1.4.0` instead of
  `v1.4.0-rc.1`) ships it to every existing user. Check the tag format twice.
- **The version bump goes through a PR; only the tag is pushed directly.**
  Never push commits to `main`.

## Steps

1. **Bump** in a worktree: `npm version $ARGUMENTS --no-git-tag-version`
   (updates `package.json` + `package-lock.json`), commit, push, open a PR,
   and arm auto-merge immediately — see the `ship-pr` skill.
2. **Tag** once the bump PR is merged:

   ```sh
   git fetch origin main
   git tag v$ARGUMENTS origin/main
   git push origin v$ARGUMENTS
   ```

   Remote Claude Code sessions cannot push tags (the git proxy only allows
   the session branch) — in that case hand these exact commands to the user.
3. **Watch the workflow.** The tag fires `release.yml`:
   SonarCloud quality gate → 3-platform builds (macOS sign/notarize, Windows
   Azure Trusted Signing) → GitHub release with generated notes
   (`scripts/release/generate-notes.js` handles prerelease versions).
   A failed quality gate auto-files a GitHub issue; fix the issues and re-tag.
4. **Verify** on the releases page: RCs must show the *Pre-release* badge and
   **Latest** must still point at the previous stable. A stable release must
   become Latest.

## Promoting an RC to stable

Semver orders `1.4.0-rc.1 < 1.4.0`, so RC users auto-update forward to the
final. Promotion is just steps 1–4 again with the final version. Leave RC
releases up; they are inert once a stable release is Latest.

## Rolling back a bad tag

```sh
git push origin :refs/tags/v$ARGUMENTS
```

Then delete the GitHub release if it published. If a bad *stable* release
went out, ship a fixed higher version rather than re-using the tag — the
auto-updater caches by version.

For pipeline depth (signing, notarization, artifact layout), see
[docs/developer/release-process.md](../../../docs/developer/release-process.md).
