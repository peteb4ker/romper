# Security Policy

## Reporting Security Issues

If you discover a security vulnerability in Romper, please report it through [GitHub Security Advisories](https://github.com/peteb4ker/romper/security/advisories).

**Do not create public issues for security vulnerabilities.**

## Supported Versions

Only the latest release receives security updates. We recommend staying up-to-date with the latest version.

## Security Notes

Romper is a desktop application that:
- Works offline. It goes online only to download Squarp's factory samples when you ask it to (over HTTPS, checked against a known SHA-256), and, on macOS, to check for updates
- Only accesses local files and SD cards
- Treats its own UI as untrusted: the window is sandboxed with context isolation, the main process accepts IPC only from Romper's own page, and file paths from the UI must sit inside the local store, the SD card, or a folder you chose, or be a file you dropped or a sample your library already uses
- Ships with Electron fuses that disable running the app as plain Node, `NODE_OPTIONS`, and the Node inspector flags