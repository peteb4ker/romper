<!-- 
title: Release Process
owners: developer-team
last_reviewed: 2025-08-15
tags: developer
-->

# Release Process

This document outlines the complete release process for Romper Sample Manager using manual tag-based releases.

## Overview

Romper uses a manual tag-based release system with the following components:

- **Manual Version Control**: Developers create tags when ready to release
- **Cross-Platform Builds**: Automated builds for Windows, macOS, and Linux triggered by tags
- **GitHub Releases**: Automated release creation with proper artifacts
- **Full Release Control**: Complete control over when releases are created

## Release Strategy

Romper uses **manual tag-based releases** because:
- Desktop applications need careful testing before release
- Full control over release timing
- No automation conflicts with development workflow
- Standard practice for desktop applications in 2025

## Release Workflow

### Manual Tag Creation

Releases are triggered by manually creating and pushing version tags:

```bash
# Create and push a new version tag
git tag v1.2.3
git push origin v1.2.3
```

### Automated Build Process (`.github/workflows/release.yml`)

Triggered by version tags (`v*`):

1. **Multi-Platform Build Matrix**:
   - **Ubuntu**: Builds `.deb`, `.rpm`, `.zip` packages
   - **macOS**: Builds `.dmg` and `.zip` packages
   - **Windows**: Builds `.exe`, `.msi` packages

2. **Cross-Platform Artifacts**:
   - Uploads platform-specific build artifacts
   - Collects all artifacts for release publication

3. **GitHub Release Creation**:
   - Downloads all platform artifacts
   - Creates GitHub release with auto-generated notes
   - Attaches all distribution packages

## Version Numbering

Follow semantic versioning (semver) when creating tags:

- **Patch releases** (`v1.0.1`): Bug fixes and small improvements
- **Minor releases** (`v1.1.0`): New features that don't break existing functionality
- **Major releases** (`v2.0.0`): Breaking changes or major rewrites

```bash
# Examples
git tag v1.0.1  # Bug fixes
git tag v1.1.0  # New features
git tag v2.0.0  # Breaking changes
```

## Release Process

Romper now features an **automated release system** that streamlines the entire process while maintaining manual control over versioning.

### Quick Release (Recommended)

For most releases, use the automated release command:

```bash
# Interactive release with all checks
npm run release

# Preview what would happen without making changes
npm run release:dry-run

# Quick validation of release readiness
npm run release:validate
```

### Manual Release (Legacy)

If you need manual control, follow the legacy process:

1. **Prerequisites**:
   ```bash
   npm run test
   npm run build
   npm run make
   ```

2. **Create and Push Tag**:
   ```bash
   git tag v1.2.3
   git push origin v1.2.3
   ```

### Automated Release Process

The `npm run release` command provides:

#### 1. **Pre-Release Validation**
- Checks you're on main branch with clean working directory
- Validates all required files and configurations
- Ensures tests pass and build succeeds
- Verifies remote is up to date

#### 2. **Intelligent Version Selection**
- Interactive prompts for version type (patch/minor/major)
- Shows changes since last release
- Validates version format and uniqueness
- Supports custom version numbers

#### 3. **Release Notes Generation**
- Parses commits since last tag
- Categorizes changes (features, fixes, breaking)
- Uses professional templates with consistent formatting
- Includes contributor attribution and PR references

#### 4. **Automated Updates**
- Updates `package.json` version
- Creates/updates `CHANGELOG.md` with new entry
- Creates and pushes git tag
- Triggers GitHub Actions build workflow

#### 5. **Release Monitoring**
- Provides GitHub Actions monitoring links
- Verifies release creation
- Shows progress indicators throughout

## Release Artifact Structure

Each release includes platform-specific packages:

### Windows
- `Romper-Sample-Manager-Setup-1.2.3.exe` - Installer
- `Romper-Sample-Manager-1.2.3.msi` - MSI package

### macOS  
- `Romper-Sample-Manager-1.2.3.dmg` - Disk image
- `Romper-Sample-Manager-1.2.3-mac.zip` - Portable app

### Linux
- `romper-sample-manager_1.2.3_amd64.deb` - Debian package
- `romper-sample-manager-1.2.3.x86_64.rpm` - RPM package
- `Romper-Sample-Manager-1.2.3-linux.zip` - Portable app

## Post-Release Tasks

### Verify Release

1. **Check GitHub Release**: Verify all artifacts are attached
2. **Test Downloads**: Download and test at least one package per platform
3. **Verify Changelog**: Ensure `CHANGELOG.md` was updated correctly

### Communication

1. **Update Documentation**: Update any version-specific docs
2. **Announce Release**: Post in relevant channels/forums
3. **Monitor Issues**: Watch for release-related bug reports

## Troubleshooting

### Release Workflow Failures

#### Build Failures
```bash
# Check build locally
npm run build
npm run make

# Check logs in GitHub Actions for specific platform failures
```

#### Artifact Upload Issues
- Verify `electron/out/make/` contains expected files
- Check forge.config.js maker configurations
- Ensure all platforms completed successfully

#### Tag Creation Issues
- Verify tag format matches `v*` pattern (e.g., `v1.2.3`)
- Ensure tag was pushed to remote: `git push origin v1.2.3`
- Check that main branch is up to date before tagging

### Emergency Fixes

#### Hotfix Releases
1. Create hotfix branch from release tag:
   ```bash
   git checkout v1.2.3
   git checkout -b hotfix/1.2.4
   ```

2. Make minimal fix and commit:
   ```bash
   git add .
   git commit -m "fix: critical security vulnerability"
   ```

3. Merge to main and tag:
   ```bash
   git checkout main
   git merge hotfix/1.2.4
   git tag v1.2.4
   git push origin main --tags
   ```

#### Rollback Process
1. **Remove Bad Tag**: Delete the problematic tag
2. **Revert Commits**: Use git revert for the problematic commits  
3. **Create New Release**: Follow normal release process

## Release Automation Architecture

### File Structure

The release automation system is organized in `scripts/release/`:

```
scripts/release/
├── index.js              # Main orchestrator (npm run release)
├── validate.js           # Pre-release validation
├── parse-commits.js      # Git commit parser
├── generate-notes.js     # Release notes generator
└── utils/
    └── git.js            # Git operations utilities
```

### Templates

Release notes are generated from templates in `docs/templates/`:

- **`RELEASE_NOTES_TEMPLATE.md`**: GitHub release notes format
- **`CHANGELOG_ENTRY_TEMPLATE.md`**: CHANGELOG.md entry format

Templates use Handlebars syntax with dynamic content injection.

### Available Commands

- `npm run release` - Interactive release process
- `npm run release:dry-run` - Preview without changes
- `npm run release:validate` - Check release readiness
- `npm run release:preview` - Generate and preview release notes

## Configuration Files

### Key Files for Release Process

- **`forge.config.js`**: Electron packaging configuration
- **`.github/workflows/release.yml`**: Release build workflow (triggered by tags)
- **`package.json`**: Version information and build scripts
- **`docs/templates/`**: Release notes templates (new)

### Package.json Scripts

```json
{
  "scripts": {
    "build": "npm run build:main && npm run build:preload && npm run build:renderer",
    "make": "npm run build && electron-forge make",
    "package": "npm run build && electron-forge package",
    "publish": "npm run build && electron-forge publish"
  }
}
```

## Security Considerations

- **Code Signing**: Add certificates for Windows/macOS distribution
- **Notarization**: Configure macOS notarization for Gatekeeper
- **Artifact Verification**: Implement checksums for release packages
- **Access Control**: Limit who can push to main branch

## Next Steps

1. **Add Code Signing**: Configure certificates for production distribution
2. **Beta Channel**: Create pre-release workflow for beta testing
3. **Auto-Updates**: Implement in-app update notifications
4. **Metrics**: Add download tracking and usage analytics