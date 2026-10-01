<!--
title: Release Process
-->

# Release Process

Releases are cut by pushing a `v*` tag. The tag triggers
`.github/workflows/release.yml`, which builds, signs, and publishes. The
`release` Claude Code skill (`.claude/skills/release/SKILL.md`) is the
condensed checklist for these steps.

## Steps

1. **Validate (optional):** `npm run pre-release` checks the Forge config,
   icons, makers, package metadata, and the signing environment.
2. **Bump the version through a PR.** Direct pushes to `main` are blocked.

   ```bash
   npm version 1.4.0 --no-git-tag-version   # package.json + package-lock.json
   git commit -am "release: bump version to 1.4.0"
   # push, open a PR, merge it
   ```

3. **Tag the merged commit:**

   ```bash
   git fetch origin main
   git tag v1.4.0 origin/main
   git push origin v1.4.0
   ```

4. **Watch the workflow** at https://github.com/peteb4ker/romper/actions.
   Nothing is built until the first two steps pass (RE-17):
   1. Preflight. The tag must be on `main` and match `package.json`'s
      version, and SonarCloud's quality gate must be `OK` with no open
      CRITICAL/BLOCKER issue or unreviewed security hotspot. An unreachable
      SonarCloud API also blocks. A failure files a GitHub issue; fix it and
      re-tag.
   2. Lint, typecheck, unit and integration tests (all three OSes) and e2e
      tests (all three OSes), run on the tagged commit by calling the CI
      workflows. CI results on `main` don't count: a push to `main` replaces
      the queued run for the previous commit, so many commits never get a
      complete run.
   3. Builds on macOS (rcodesign sign + notarize, see
      [code-signing.md](code-signing.md)), Windows (Azure Trusted Signing),
      and Linux. The macOS job launches the packaged app
      (`scripts/smoke-packaged-app.mjs`) and fails unless it starts its
      auto-updater, which no unpackaged test can check (RE-16).
   4. GitHub Release with notes from
      `scripts/generate-github-release-notes.js`, which renders
      `docs/templates/RELEASE_NOTES_TEMPLATE.md` from the conventional
      commits since the last tag.
5. **Verify** the release page: all six artifacts are attached, and **Latest**
   points where you expect.

Only a tag-triggered run exercises macOS signing
(`electron/resources/rcodesign.toml`). PR CI doesn't, so treat any change to
signing config as release-blocking and verify it deliberately.

## Release candidates

A hyphen in the tag (`v1.4.0-rc.1`) makes the release a GitHub
**prerelease** that is never marked **Latest**. `release.yml` derives both flags
from the tag name. This matters because the macOS auto-updater
(update.electronjs.org) serves whatever GitHub marks Latest: an RC tagged in
stable format ships to every user.

Cut an RC exactly like a release with the prerelease version. Promote it by
repeating the process with the final version; semver orders
`1.4.0-rc.1 < 1.4.0`, so RC users auto-update forward.

## Artifacts

| Platform | Files |
| --- | --- |
| Windows | `Romper-X.Y.Z.Setup.exe` |
| macOS (arm64) | `Romper.dmg`, `Romper-darwin-arm64-X.Y.Z.zip` |
| Linux | `romper_X.Y.Z_amd64.deb`, `romper-X.Y.Z-1.x86_64.rpm`, `Romper-linux-x64-X.Y.Z.zip` |

## When something goes wrong

- **Preflight failed:** the run says which check. Tag a commit that's on
  `main`, bump `package.json` to match the tag, or fix what SonarCloud
  reports; then delete and re-push the tag.
- **Platform build failed:** re-run only the failed job
  (`gh run rerun <run-id> --failed`). A macOS notarization 403 mentioning
  agreements means the Apple Developer account holder must re-accept the
  agreement; nothing in the repo can fix it.
- **Bad tag, nothing published yet:** delete it
  (`git push origin :refs/tags/vX.Y.Z`), fix, and tag again.
- **Bad stable release published:** ship a fixed, higher version. Don't
  re-use the tag, because the auto-updater caches by version.
