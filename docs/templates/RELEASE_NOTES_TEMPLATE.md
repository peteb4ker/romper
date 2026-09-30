# Romper Sample Manager {{version}}

**Release Date**: {{date}}

{{#if highlights}}
## 🎉 Highlights

{{highlights}}
{{/if}}

{{#if breaking}}
## 🚨 Breaking Changes

{{#each breaking}}
- {{this}}
{{/each}}
{{/if}}

{{#if features}}
## ✨ New Features

{{#each features}}
- {{this}}
{{/each}}
{{/if}}

{{#if fixes}}
## 🐛 Bug Fixes

{{#each fixes}}
- {{this}}
{{/each}}
{{/if}}

{{#if performance}}
## ⚡ Performance Improvements

{{#each performance}}
- {{this}}
{{/each}}
{{/if}}

{{#if other}}
## 🔧 Other Changes

{{#each other}}
- {{this}}
{{/each}}
{{/if}}

{{#if commitCount}}
## 📊 Release Summary

- **Commits**: {{commitCount}} changes since {{previous_version}}
{{#if contributors}}
- **Contributors**: {{contributors.length}} developers
{{/if}}
{{else}}
## 📊 Release Summary

This is a maintenance release with minor updates.
{{/if}}

## 📥 Downloads

### Windows
- **Installer**: `Romper-{{version}}.Setup.exe` - Recommended for most users

### macOS
- **DMG**: `Romper.dmg` - Recommended for most users
- **ZIP**: `Romper-darwin-arm64-{{version}}.zip` - Alternative download

### Linux
- **DEB**: `romper_{{version}}_amd64.deb` - For Debian/Ubuntu
- **RPM**: `romper-{{version}}-1.x86_64.rpm` - For Fedora/RHEL
- **ZIP**: `Romper-linux-x64-{{version}}.zip` - Universal package

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
sudo dpkg -i romper_{{version}}_amd64.deb
```

**Fedora/RHEL**:
```bash
sudo rpm -i romper-{{version}}-1.x86_64.rpm
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

- [Getting Started](https://peteb4ker.github.io/romper/manual/getting-started/)
- [User Manual](https://peteb4ker.github.io/romper/manual/)
- [Troubleshooting](https://github.com/peteb4ker/romper/blob/main/docs/troubleshooting.md)

## 🤝 Support

- **Issues**: [GitHub Issues](https://github.com/peteb4ker/romper/issues)

## 🙏 Acknowledgments

Thank you to all contributors who helped make this release possible!

{{#if contributors}}
### Contributors to this release:
{{#each contributors}}
- @{{this}}
{{/each}}
{{/if}}

---

**Full Changelog**: [{{previous_version}}...v{{version}}](https://github.com/peteb4ker/romper/compare/{{previous_version}}...v{{version}})