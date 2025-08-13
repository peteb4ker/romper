# Release Process Guidelines for Claude

This document provides guidelines for Claude when working with release-related tasks in the Romper project.

## Release Workflow Architecture

The project uses a **two-stage automated release pipeline**:

1. **Version Management** (`.github/workflows/version.yml`)
   - Triggers on pushes to `main` branch
   - Uses semantic-release to analyze conventional commits
   - Automatically bumps version in package.json
   - Generates CHANGELOG.md entries
   - Creates and pushes git tags

2. **Release Build** (`.github/workflows/release.yml`) 
   - Triggers on version tags (`v*`)
   - Builds cross-platform Electron packages
   - Creates GitHub releases with artifacts

## When to Handle Release Tasks

### Automatic Triggers
- **Version Management**: Any push to `main` with conventional commits
- **Release Build**: Any tag creation matching `v*` pattern

### Manual Intervention Required
- Release workflow failures
- Hotfix releases
- Emergency rollbacks
- First-time release setup

## Conventional Commit Standards

**CRITICAL**: Always use conventional commit format for release-triggering commits:

```bash
# Patch release (1.0.0 → 1.0.1)
fix: resolve sample loading issue
fix(ui): correct alignment in kit browser

# Minor release (1.0.0 → 1.1.0)  
feat: add dark mode support
feat(sync): implement background synchronization

# Major release (1.0.0 → 2.0.0)
feat!: redesign kit format with breaking changes
fix!: remove deprecated API endpoints

# No release triggered
docs: update release documentation
chore: upgrade dependencies
test: add unit tests for sample service
```

## Key Configuration Files

### Semantic Release (`.releaserc.json`)
- Controls version analysis and changelog generation
- Configures which files get updated in release commits
- **DO NOT modify** without understanding semantic-release implications

### Electron Forge (`forge.config.js`)
- Defines cross-platform packaging configuration
- Specifies output formats for each OS
- Icon and app metadata configuration

### Package Scripts
```json
{
  "make": "npm run build && electron-forge make",
  "package": "npm run build && electron-forge package", 
  "publish": "npm run build && electron-forge publish"
}
```

## Release Artifact Structure

The release process generates platform-specific packages:

- **Windows**: `.exe` installer, `.msi` package
- **macOS**: `.dmg` disk image, `.zip` portable
- **Linux**: `.deb`, `.rpm`, `.zip` packages

All artifacts are automatically uploaded to GitHub releases.

## Common Release Tasks

### Creating a Release
1. **Ensure tests pass**: Run full test suite
2. **Use conventional commits**: Follow commit message format
3. **Push to main**: Triggers automatic version and release workflows
4. **Monitor GitHub Actions**: Watch for workflow completion

### Troubleshooting Releases

#### Build Failures
- Check `npm run build && npm run make` locally
- Verify all platforms in matrix completed
- Check GitHub Actions logs for specific errors

#### Version Management Issues  
- Verify conventional commit format
- Check for `[skip ci]` in commit messages
- Ensure semantic-release configuration is valid

#### Artifact Problems
- Verify `forge.config.js` maker configurations
- Check `electron/out/make/` directory structure
- Ensure all expected file types are generated

### Emergency Procedures

#### Hotfix Release
1. Create hotfix branch from release tag
2. Make minimal fix with conventional commit
3. Merge to main to trigger new release

#### Rollback
1. Delete problematic git tag
2. Revert problematic commits
3. Create new release following normal process

## Development Workflow Integration

### Branch Strategy
- **Main Branch**: Production-ready code, triggers releases
- **Feature Branches**: Merge to main via PRs
- **Hotfix Branches**: Direct from release tags for emergency fixes

### Quality Gates
- All CI workflows must pass before merge to main
- SonarCloud quality gate enforcement
- Cross-platform E2E tests required

## Security Considerations

### Current Setup
- No code signing configured (manual distribution only)
- No notarization for macOS packages
- Artifacts are unsigned but checksummed

### Future Enhancements Needed
- Add code signing certificates for Windows/macOS
- Implement macOS notarization workflow  
- Add GPG signing for Linux packages
- Implement auto-update mechanisms

## Common Mistakes to Avoid

### Commit Message Format
- ❌ `Add new feature` (no conventional format)
- ✅ `feat: add sample preview functionality`

### Release Timing
- ❌ Pushing multiple features in one release commit
- ✅ Individual commits for each feature, let automation handle versioning

### Workflow Dependencies
- ❌ Modifying release workflows without testing
- ✅ Test workflow changes in feature branches first

### Version Management
- ❌ Manually editing version numbers
- ✅ Let semantic-release handle all version management

## Claude-Specific Guidelines

### When Working on Release Features
1. **Always test locally**: Run `npm run make` to verify packaging works
2. **Use conventional commits**: Follow format strictly for release automation
3. **Document changes**: Update relevant docs for release-related changes
4. **Monitor workflows**: Check GitHub Actions after pushes to main

### File Modification Rules
- **Safe to modify**: workflow files, forge.config.js, package.json scripts
- **Careful with**: .releaserc.json (semantic-release config)
- **Never modify**: git tags, version numbers in package.json (automation handles these)

### Testing Release Changes
```bash
# Test build process locally
npm run build
npm run make

# Verify artifacts are created
ls -la electron/out/make/

# Test specific platform makers
npx electron-forge make --platform=darwin
npx electron-forge make --platform=win32
npx electron-forge make --platform=linux
```

## Integration with Task Execution

### Release-Related Task Types
- **Infrastructure**: Adding/modifying workflows, configuration
- **Bug Fixes**: Must use `fix:` conventional commit format
- **Features**: Must use `feat:` conventional commit format
- **Documentation**: Use `docs:` (won't trigger release)

### Task Completion Criteria
- [ ] All tests pass (`npm test`, `npm run test:e2e`)
- [ ] Build succeeds (`npm run build`, `npm run make`) 
- [ ] Conventional commit format used
- [ ] Documentation updated if needed
- [ ] GitHub Actions workflows complete successfully

This ensures seamless integration between development workflow and release automation.