# Security Policy

## Supported Versions

We provide security updates for the following versions of Romper Sample Manager:

| Version | Supported          |
| ------- | ------------------ |
| 0.9.x   | :white_check_mark: |
| < 0.9   | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability in Romper Sample Manager, please report it responsibly:

### How to Report

**Do NOT create a public GitHub issue for security vulnerabilities.**

Instead, please:

1. **Email us directly** at [security contact - please update this]
2. **Use GitHub Security Advisories** (recommended): Go to the [Security tab](https://github.com/peteb4ker/romper/security/advisories) in this repository and click "Report a vulnerability"

### What to Include

Please include the following information in your report:

- **Description** of the vulnerability
- **Steps to reproduce** the issue
- **Potential impact** and severity assessment
- **Suggested fixes** (if you have any)
- **Your contact information** for follow-up questions

### Response Timeline

- **Initial Response**: Within 48 hours of receiving your report
- **Assessment**: Within 5 business days
- **Fix Timeline**: Depends on severity
  - Critical: 1-3 days
  - High: 1-2 weeks  
  - Medium/Low: Next regular release cycle

### Security Considerations

Romper Sample Manager is a desktop application that:

- **Operates locally** on user machines
- **Handles audio files** and metadata
- **Accesses filesystem** for SD card management
- **No network communication** by design (offline-first)

Common security concerns:
- File path traversal vulnerabilities
- Malicious audio file processing
- Privilege escalation through Electron
- Code injection through metadata parsing

## Acknowledgments

We appreciate security researchers who responsibly disclose vulnerabilities. Contributors will be acknowledged (with permission) in our release notes and security advisories.

## Security Best Practices

For users:
- Download releases only from official GitHub releases
- Verify release signatures when available
- Keep the application updated to the latest version
- Be cautious when opening sample libraries from untrusted sources

For developers:
- Follow secure coding practices outlined in our [Contributing Guide](CONTRIBUTING.md)
- Run security audits: `npm audit`
- Follow the principle of least privilege
- Validate all user inputs and file operations

---

**Last Updated**: August 2025