# Release {{version}}

**Release Date**: {{date}}

## 🎉 Highlights

{{#if highlights}}
{{highlights}}
{{else}}
This release includes bug fixes, performance improvements, and new features for the Romper Sample Manager.
{{/if}}

## 🚨 Breaking Changes

{{#if breaking}}
{{#each breaking}}
- {{this}}
{{/each}}
{{else}}
No breaking changes in this release.
{{/if}}

## ✨ New Features

{{#if features}}
{{#each features}}
- {{this}}
{{/each}}
{{else}}
No new features in this release.
{{/if}}

## 🐛 Bug Fixes

{{#if fixes}}
{{#each fixes}}
- {{this}}
{{/each}}
{{else}}
No bug fixes in this release.
{{/if}}

## ⚡ Performance Improvements

{{#if performance}}
{{#each performance}}
- {{this}}
{{/each}}
{{else}}
No performance improvements in this release.
{{/if}}

## 🔧 Other Changes

{{#if other}}
{{#each other}}
- {{this}}
{{/each}}
{{else}}
No other changes in this release.
{{/if}}

## 📥 Downloads

### Windows
- **Installer**: `Romper-Sample-Manager-Setup-{{version}}.exe` - Recommended for most users
- **MSI Package**: `Romper-Sample-Manager-{{version}}.msi` - For enterprise deployment
- **Portable**: `Romper-Sample-Manager-win32-x64-{{version}}.zip` - No installation required

### macOS
- **DMG**: `Romper-Sample-Manager-{{version}}.dmg` - Recommended for most users
- **ZIP**: `Romper-Sample-Manager-darwin-{{platform}}-{{version}}.zip` - Portable version

### Linux
- **DEB**: `romper-sample-manager_{{version}}_amd64.deb` - For Debian/Ubuntu
- **RPM**: `romper-sample-manager-{{version}}.x86_64.rpm` - For Fedora/RHEL
- **Portable**: `Romper-Sample-Manager-linux-x64-{{version}}.zip` - Universal package

## 💾 Installation

### Windows
1. Download the `.exe` installer
2. Run the installer and follow the prompts
3. Launch Romper from the Start Menu or Desktop

### macOS
1. Download the `.dmg` file
2. Open the DMG and drag Romper to Applications
3. Launch from Applications or Spotlight

### Linux
**Debian/Ubuntu**:
```bash
sudo dpkg -i romper-sample-manager_{{version}}_amd64.deb
```

**Fedora/RHEL**:
```bash
sudo rpm -i romper-sample-manager-{{version}}.x86_64.rpm
```

## 📋 System Requirements

- **Operating System**: Windows 10+, macOS 11+, or Linux (Ubuntu 20.04+)
- **Memory**: 4GB RAM minimum (8GB recommended)
- **Storage**: 500MB available space
- **Display**: 1280x720 minimum resolution

## 🔧 Known Issues

{{#if known_issues}}
{{#each known_issues}}
- {{this}}
{{/each}}
{{else}}
No known issues in this release.
{{/if}}

## 📚 Documentation

- [Getting Started Guide](https://github.com/peteb4ker/romper/blob/main/docs/user/getting-started.md)
- [User Manual](https://github.com/peteb4ker/romper/blob/main/docs/user/user-manual.md)
- [Release Process](https://github.com/peteb4ker/romper/blob/main/docs/developer/release-process.md)

## 🤝 Support

- **Issues**: [GitHub Issues](https://github.com/peteb4ker/romper/issues)
- **Discussions**: [GitHub Discussions](https://github.com/peteb4ker/romper/discussions)
- **Wiki**: [Project Wiki](https://github.com/peteb4ker/romper/wiki)

## 🙏 Acknowledgments

Thank you to all contributors who helped make this release possible!

{{#if contributors}}
### Contributors to this release:
{{#each contributors}}
- @{{this}}
{{/each}}
{{/if}}

---

**Full Changelog**: [{{previous_version}}...{{version}}](https://github.com/peteb4ker/romper/compare/{{previous_version}}...{{version}})