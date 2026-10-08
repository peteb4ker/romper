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
   icons, makers, and package metadata. Its signing checks look for local
   environment variables (`APPLE_ID`, `WINDOWS_CERTIFICATE_FILE`) that the
   release workflow doesn't use, so treat those warnings as noise; signing
   is checked by the workflow's preflight.
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
      version. Signing must be configured, and Apple must accept the App
      Store Connect key (see [code-signing.md](code-signing.md)). The open
      GitHub issues, which set each use case's status, must be readable,
      and every issue and use case must have its label, and every supported
      use case a test above unit level or a declared gap
      (`npm run trace:check -- --strict-issues`; pull requests only warn on
      this). SonarCloud's
      quality gate must be `OK` with no open
      CRITICAL/BLOCKER issue or unreviewed security hotspot. An unreachable
      SonarCloud API also blocks. A failure files a GitHub issue; fix it and
      re-tag.
   2. Lint, typecheck, unit tests (Ubuntu), integration tests (all three
      OSes) and e2e tests (all three OSes), run on the tagged commit by calling the CI
      workflows. CI results on `main` don't count: a push to `main` replaces
      the queued run for the previous commit, so many commits never get a
      complete run. The full-pipeline rehearsal (`validate-full.yml`: the
      factory archive to a card, byte for byte, plus the performance
      profile) runs too, on all three OSes; nothing is built until it
      passes. A flaky rehearsal job can be re-run on its own.
   3. Builds on macOS, arm64 only (rcodesign sign + notarize, see
      [code-signing.md](code-signing.md)), Windows x64 (Azure Trusted
      Signing, or unsigned while `ALLOW_UNSIGNED_WINDOWS` is `true`), and
      Linux x64. The macOS job launches the packaged app
      (`scripts/smoke-packaged-app.mjs`) and fails unless it starts its
      auto-updater, which no unpackaged test can check (RE-16). It first
      checks the app's folder holds the files the app loads and nothing
      the packaging allowlist leaves out (#464).
   4. GitHub Release with notes from
      `scripts/generate-github-release-notes.js`, which renders
      `docs/templates/RELEASE_NOTES_TEMPLATE.md`. The notes open with
      **Fixed in this release**: the issues closed as completed since the
      previous tag (of any kind, so an RC counts), grouped under their use
      case or quality label and skipping `ops`, `duplicate` and
      `sonarcloud`. That's why a fix PR must say `Fixes #N`: merging it
      closes the issue, and only closed issues reach the notes. The conventional commits since the
      last tag follow. The step reads issues with `GH_TOKEN`; run locally,
      the script uses your `gh` login, or leaves the section out and says
      so on stderr. `scripts/testing-summary.mjs` turns the run's test
      results, rehearsal reports and performance budget results into
      `testing-summary.json`, attached to the release. It reads the open
      issues with `GH_TOKEN` too, to generate each use case's status as
      the release ships. After publishing a
      stable release, the job starts the Pages workflow, which rebuilds the
      website so its
      [testing page](https://peteb4ker.github.io/romper/testing/) shows the
      latest release's summary. The Pages build fails if that summary is
      missing or has no results. To republish it by hand:
      `gh workflow run pages.yml --ref main`.
5. **Verify** the release page: all six artifacts and `testing-summary.json`
   are attached, and **Latest** points where you expect. Check the testing
   page shows the new version.

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
| Windows (x64) | `Romper-X.Y.Z.Setup.exe` |
| macOS (arm64) | `Romper.dmg`, `Romper-darwin-arm64-X.Y.Z.zip` |
| Linux (x64) | `romper_X.Y.Z_amd64.deb`, `romper-X.Y.Z-1.x86_64.rpm`, `Romper-linux-x64-X.Y.Z.zip` |

There is no Intel Mac, ARM Windows or ARM Linux build (RE-55), and no
AppImage. Only macOS updates itself (`electron/main/autoUpdater.ts`); Windows
and Linux users download each release.

## When something goes wrong

- **Preflight failed:** the run says which check. Tag a commit that's on
  `main`, bump `package.json` to match the tag, add the missing signing
  secrets, accept Apple's agreement, fix what SonarCloud reports, or fix
  what the strict traceability check reports (a missing label, or a test
  or declared gap; the messages say which); then delete and re-push the
  tag.
- **Platform build failed:** re-run only the failed job
  (`gh run rerun <run-id> --failed`). A macOS notarization 403 mentioning
  agreements means the Apple Developer account holder must re-accept the
  agreement; nothing in the repo can fix it.
- **Bad tag, nothing published yet:** delete it
  (`git push origin :refs/tags/vX.Y.Z`), fix, and tag again.
- **Bad stable release published:** ship a fixed, higher version. Don't
  re-use the tag, because the auto-updater caches by version.
