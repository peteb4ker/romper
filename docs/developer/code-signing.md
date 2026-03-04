<!--
title: Code Signing Strategy
owners: maintainer
last_reviewed: 2026-03-03
tags: developer, release, security
-->

# Code Signing Strategy

This document outlines the code signing approach for distributing Romper Sample Manager on macOS and Windows.

## Why Code Signing Matters

Without code signing:
- **macOS**: Gatekeeper blocks the app entirely — users must manually override via System Settings
- **Windows**: SmartScreen shows a scary "Windows protected your PC" warning — users must click "More info" > "Run anyway"

Signed apps show the publisher name and install without friction.

## Platform Strategies

### macOS: Apple Developer Program

**Cost**: $99/year (individual enrollment)

Apple requires all distributed macOS apps to be **signed and notarized**. There is no alternative — notarization requires Apple Developer Program membership.

**What you get**:
- Developer ID Application certificate (for apps outside Mac App Store)
- Access to `notarytool` for notarization
- Gatekeeper trusts the app immediately upon notarization

**Setup**:
1. Enroll at [developer.apple.com/programs](https://developer.apple.com/programs/)
2. Create a "Developer ID Application" certificate in Xcode or the developer portal
3. Configure Electron Forge with the certificate identity (see [CI/CD Integration](#cicd-integration))

**Reference**: [Electron Forge macOS Signing Guide](https://www.electronforge.io/guides/code-signing/code-signing-macos)

### Windows: Azure Trusted Signing

**Cost**: $9.99/month (pay only during release months — see [Cost Optimization](#cost-optimization))

Azure Trusted Signing (formerly Azure Artifact Signing) is Microsoft's cloud-based code signing service. It's the recommended option for Windows because:
- No physical hardware (cloud HSM) — works in CI/CD
- First-party [GitHub Action](https://github.com/azure/trusted-signing-action) for pipeline integration
- Managed by Microsoft — direct path to Windows trust
- Available to individual developers in the US and Canada

**Important context on SmartScreen (as of March 2024)**:
- EV and OV certificates are now treated equally — neither gets instant SmartScreen bypass
- All certificates require building reputation through downloads
- Azure Trusted Signing is the only non-EV option that provides immediate SmartScreen trust

**Setup**:
1. Create an Azure account at [azure.microsoft.com](https://azure.microsoft.com)
2. Set up a Trusted Signing account in the Azure portal
3. Create a certificate profile (individual developer identity validation required)
4. Configure the GitHub Action in the release workflow (see [CI/CD Integration](#cicd-integration))

**Reference**: [Azure Trusted Signing Documentation](https://azure.microsoft.com/en-us/products/artifact-signing)

## Cost Optimization

### Pay-per-release signing (Windows)

Once a binary is signed and **timestamped**, the signature remains valid indefinitely — even after the certificate or subscription expires. Timestamping is applied by default in all standard signing tools.

This means you can:
1. Enable Azure Trusted Signing subscription for the release month
2. Build and sign all Windows artifacts
3. Disable the subscription until the next release

**Estimated annual cost** (assuming ~4 releases/year): ~$40

### Total Annual Cost

| Platform | Service | Cost |
|----------|---------|------|
| macOS | Apple Developer Program | $99/year |
| Windows | Azure Trusted Signing | ~$40/year (pay-per-release) |
| **Total** | | **~$139/year** |

## CI/CD Integration

Code signing integrates into the existing GitHub Actions release workflow (`.github/workflows/release.yml`). Both platforms use cloud-based signing — no physical hardware or local certificates required.

### Required GitHub Secrets

#### macOS
| Secret | Description |
|--------|-------------|
| `APPLE_CERTIFICATE` | Base64-encoded .p12 Developer ID Application certificate |
| `APPLE_CERTIFICATE_PASSWORD` | Password for the .p12 certificate |
| `APPLE_ID` | Apple ID email for notarization |
| `APPLE_ID_PASSWORD` | App-specific password for notarization |
| `APPLE_TEAM_ID` | Apple Developer Team ID |

#### Windows
| Secret | Description |
|--------|-------------|
| `AZURE_CLIENT_ID` | Azure service principal client ID |
| `AZURE_CLIENT_SECRET` | Azure service principal client secret |
| `AZURE_TENANT_ID` | Azure AD tenant ID |
| `AZURE_SIGNING_ACCOUNT` | Trusted Signing account name |
| `AZURE_CERTIFICATE_PROFILE` | Certificate profile name |

### Workflow Integration

The release workflow should add signing steps after building but before uploading artifacts. See the [Electron Forge code signing guide](https://www.electronforge.io/guides/code-signing) and [Azure Trusted Signing GitHub Action](https://github.com/azure/trusted-signing-action) for implementation details.

## Alternatives Considered

| Option | Cost | Why Not |
|--------|------|---------|
| SignPath.io (commercial) | Free for OSS | Requires established project reputation to qualify |
| SignPath Foundation | Free for OSS | Requires OSI-approved license, no proprietary code |
| OSSign | Free for OSS | Less documentation, uncertain qualification process |
| Certum Open Source | ~$30/year | Requires physical smartcard for hardware option; cloud option less CI/CD friendly than Azure |
| Traditional EV Certificate | ~$280+/year | More expensive, no SmartScreen advantage since March 2024 |
| SSL.com eSigner | ~$240/year | More expensive than Azure for same cloud-based approach |

## Key Facts

- **Signatures are permanent**: Once signed and timestamped, binaries stay valid forever
- **Timestamping is critical**: Always use a timestamp server (default in all tools) — without it, signatures expire with the certificate
- **Certificate validity**: As of March 2026, code signing certificates are limited to 460 days (15 months) max
- **SmartScreen parity**: Since March 2024, EV and OV certificates are treated equally for SmartScreen reputation
- **No Windows alternatives to annual renewal**: All code signing certificates require periodic renewal — there is no perpetual option
