# Release Process

This document outlines the complete release process for Romper Sample Manager, including automated workflows, manual procedures, and post-release tasks.

## Overview

Romper uses an automated release pipeline with the following components:

- **Semantic Versioning**: Automated version bumping based on conventional commits
- **Cross-Platform Builds**: Automated builds for Windows, macOS, and Linux
- **GitHub Releases**: Automated release creation with proper artifacts
- **Changelog Generation**: Automatic changelog updates

## Release Types

### Automatic Releases (Recommended)

The automated release process triggers on every push to `main` with conventional commits:

- **Patch Release** (`v1.0.1`): Bug fixes with `fix:` commits
- **Minor Release** (`v1.1.0`): New features with `feat:` commits  
- **Major Release** (`v2.0.0`): Breaking changes with `feat!:` or `fix!:` commits

### Manual Releases

For emergency releases or special cases, you can trigger releases manually.

## Automated Release Workflow

### 1. Version Management (`.github/workflows/version.yml`)

Triggered on every push to `main`:

1. **Analyzes Commits**: Uses conventional commit format to determine version bump
2. **Updates Version**: Increments version in `package.json`
3. **Generates Changelog**: Updates `CHANGELOG.md` with new changes
4. **Creates Git Tag**: Creates and pushes version tag (e.g., `v1.2.3`)
5. **Triggers Release**: Automatically starts the release build process

### 2. Release Build (`.github/workflows/release.yml`)

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

## Conventional Commit Format

Use these commit message formats to trigger automatic releases:

```bash
# Patch release (bug fixes)
fix: resolve kit loading issue on Windows
fix(ui): correct sample slot display alignment

# Minor release (new features)
feat: add dark mode support
feat(editor): implement drag-and-drop sample ordering

# Major release (breaking changes)
feat!: redesign kit format structure
fix!: remove deprecated sync API

# No release (docs, chores, etc.)
docs: update installation guide
chore: update dependencies
test: add integration tests for kit service
```

## Manual Release Process

### Prerequisites

1. Ensure all tests pass:
   ```bash
   npm run test
   npm run test:e2e
   ```

2. Verify build works locally:
   ```bash
   npm run build
   npm run make
   ```

### Option 1: Conventional Commit Release

1. **Create Conventional Commit**:
   ```bash
   git add .
   git commit -m "feat: add new sample management features"
   git push origin main
   ```

2. **Wait for Automation**: The version and release workflows will run automatically.

### Option 2: Manual Version Creation

1. **Create Version Tag**:
   ```bash
   # Determine next version manually
   git tag v1.2.3
   git push origin v1.2.3
   ```

2. **Monitor Release**: Watch the release workflow in GitHub Actions.

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

#### Version Management Issues
- Verify conventional commit format
- Check if commit was marked `[skip ci]`
- Ensure main branch protection allows the release bot

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

## Configuration Files

### Key Files for Release Process

- **`.releaserc.json`**: Semantic release configuration
- **`forge.config.js`**: Electron packaging configuration
- **`.github/workflows/version.yml`**: Version management workflow
- **`.github/workflows/release.yml`**: Release build workflow

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