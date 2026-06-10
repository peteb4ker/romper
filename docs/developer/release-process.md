<!-- 
title: Release Process
owners: developer-team
last_reviewed: 2026-06-10
tags: developer
-->

# Release Process

This document outlines the simple, standardized release process for Romper Sample Manager using git tag-based automation.

## Overview

Romper uses a **git tag-based release system** with the following components:

- **Manual Version Control**: Developers create tags when ready to release
- **Automated Builds**: Cross-platform builds triggered by tags via GitHub Actions
- **Dynamic Release Notes**: Automatically generated from commits since last release
- **Full Release Control**: Complete control over when releases are created

## Release Strategy

Romper uses **manual tag-based releases** because:
- Desktop applications need careful testing before release
- Full control over release timing
- Simple, reliable workflow
- Standard practice for desktop applications

## The Release Process

### Step 1: Prepare for Release

1. **Ensure you're on main branch with latest changes**:
   ```bash
   git checkout main
   git pull origin main
   ```

2. **Run pre-release validation** (optional but recommended):
   ```bash
   npm run pre-release
   ```

3. **Test the application locally**:
   ```bash
   npm run test
   npm run build
   ```

### Step 2: Update Version and Create Release

1. **Update package.json version**:
   ```bash
   # Edit package.json and bump the version number
   # Example: "version": "1.0.1"
   ```

2. **Land the version bump via a PR** (never push commits to `main`
   directly — see the hard rules in `CLAUDE.md`):
   ```bash
   npm version 1.0.1 --no-git-tag-version   # updates package.json + lockfile
   git commit -am "release: bump version to 1.0.1"
   # push the branch, open a PR, merge it
   ```

3. **Create and push the git tag** once the bump is on `main`:
   ```bash
   git fetch origin main
   git tag v1.0.1 origin/main
   git push origin v1.0.1     # this triggers the release workflow
   ```

### Step 3: Monitor Automated Process

The GitHub Actions workflow will automatically:

1. **Check the SonarCloud quality gate** — any open CRITICAL/BLOCKER issue
   or unreviewed security hotspot blocks the release and auto-files a
   GitHub issue; fix the issues and re-tag
2. **Build for all platforms** (Windows, macOS, Linux)
3. **Generate release notes** from commits since the last tag
4. **Create GitHub release** with all artifacts and proper release notes
5. **Attach distribution packages** for all platforms

You can monitor progress at: https://github.com/peteb4ker/romper/actions

## Version Numbering

Follow semantic versioning (semver):

- **Patch releases** (`v1.0.1`): Bug fixes and small improvements
- **Minor releases** (`v1.1.0`): New features that don't break existing functionality
- **Major releases** (`v2.0.0`): Breaking changes or major rewrites

```bash
# Examples
git tag v1.0.1  # Bug fixes
git tag v1.1.0  # New features  
git tag v2.0.0  # Breaking changes
```

### Release candidates (prereleases)

Tags containing a hyphen (e.g. `v1.4.0-rc.1`) are published as GitHub
**prereleases** and are never marked *Latest* — the release workflow derives
both flags from the tag name. This matters because the macOS auto-updater
(update.electronjs.org) serves whatever release GitHub marks Latest: an RC
tagged in stable format would be pushed to every existing user.

- Cut an RC exactly like a release, with the prerelease version
  (`npm version 1.4.0-rc.1 --no-git-tag-version`, PR, then tag
  `v1.4.0-rc.1`).
- Promote by repeating the process with the final version. Semver orders
  `1.4.0-rc.1 < 1.4.0`, so RC users auto-update forward to the final.

## Release Artifacts

Each release automatically includes platform-specific packages:

### Windows
- `Romper.Sample.Manager-X.X.X.Setup.exe` - Installer (recommended)

### macOS  
- `Romper.Sample.Manager.dmg` - Disk image (recommended)
- `Romper.Sample.Manager-darwin-arm64-X.X.X.zip` - Alternative download

### Linux
- `romper_X.X.X_amd64.deb` - Debian package
- `romper-X.X.X-1.x86_64.rpm` - RPM package
- `Romper.Sample.Manager-linux-x64-X.X.X.zip` - Universal package

## Automated Release Notes

Release notes are automatically generated from commits since the last tag and include:

- **New Features** (commits starting with `feat:`)
- **Bug Fixes** (commits starting with `fix:`)
- **Performance Improvements** (commits starting with `perf:`)
- **Other Changes** (all other commits)
- **Contributor List** and commit counts
- **Download Links** with correct artifact names

## Post-Release Tasks

### Verify Release

1. **Check GitHub Release**: Verify all artifacts are attached at https://github.com/peteb4ker/romper/releases
2. **Test Downloads**: Download and test at least one package per platform
3. **Verify Release Notes**: Ensure the generated notes are accurate

### Communication

1. **Update Documentation**: Update any version-specific docs if needed
2. **Announce Release**: Post in relevant channels/forums
3. **Monitor Issues**: Watch for release-related bug reports

## Troubleshooting

### Release Workflow Failures

#### Build Failures
```bash
# Check build locally first
npm run build

# Check logs in GitHub Actions for specific platform failures
# Visit: https://github.com/peteb4ker/romper/actions
```

#### Artifact Upload Issues
- Verify workflow completed all platform builds
- Check GitHub Actions logs for specific errors
- Ensure all platforms show green checkmarks

#### Tag Issues
- Verify tag format matches `v*` pattern (e.g., `v1.2.3`)
- Ensure tag was pushed to remote: `git push origin --tags`
- Check that main branch was up to date before tagging

### Emergency Fixes

#### Hotfix Releases
1. **Create hotfix branch from release tag**:
   ```bash
   git checkout v1.2.3
   git checkout -b hotfix/1.2.4
   ```

2. **Make minimal fix and commit**:
   ```bash
   # Make your fixes
   git add .
   git commit -m "fix: critical security vulnerability"
   ```

3. **Land the hotfix and bump via PRs, then tag**:
   ```bash
   # open a PR for the hotfix branch (including the version bump to 1.2.4)
   # and merge it — direct pushes to main are not allowed

   git fetch origin main
   git tag v1.2.4 origin/main
   git push origin v1.2.4
   ```

#### Rollback Process
1. **Remove Bad Tag**: Delete the problematic tag locally and remotely
   ```bash
   git tag -d v1.2.3
   git push origin :refs/tags/v1.2.3
   ```
2. **Revert Commits**: Use git revert for the problematic commits  
3. **Create New Release**: Follow normal release process

## Configuration Files

### Key Files for Release Process

- **`.github/workflows/release.yml`**: Release build workflow (triggered by tags)
- **`scripts/generate-github-release-notes.js`**: Release notes generator for CI/CD
- **`docs/templates/RELEASE_NOTES_TEMPLATE.md`**: Release notes template
- **`forge.config.js`**: Electron packaging configuration
- **`package.json`**: Version information and build scripts

### Pre-Release Validation

The `npm run pre-release` command validates:
- Forge configuration exists
- Required icon files exist  
- Electron in devDependencies
- Build artifacts are clean
- All required makers installed
- Required package.json metadata
- Tests passing

## Security Considerations

- **Access Control**: Only maintainers can push to main branch and create tags
- **Branch Protection**: Main branch requires PR reviews and passing CI
- **Artifact Verification**: All artifacts are built in isolated GitHub runners
- **Code Signing**: See [Code Signing Strategy](./code-signing.md) for Windows and macOS signing setup

## Summary

The Romper release process is designed to be:
- **Simple**: Just update version, commit, tag, and push
- **Reliable**: Automated builds ensure consistency
- **Informative**: Dynamic release notes show exactly what changed
- **Complete**: All platforms built and released simultaneously

For most releases, the process is just:
1. Land the version-bump PR
2. `git tag v1.0.1 origin/main && git push origin v1.0.1`
3. Monitor GitHub Actions for completion