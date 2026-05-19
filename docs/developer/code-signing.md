<!--
title: Code Signing Strategy
owners: maintainer
last_reviewed: 2026-05-19
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

Signing is **already wired up** in `.github/workflows/release.yml` and `forge.config.cjs`.
Both paths are inert until their secrets exist:

- The macOS certificate-import and notarization steps run only when `APPLE_CERTIFICATE` is set.
- The Windows `azure/trusted-signing-action` step runs only when `AZURE_CLIENT_ID` is set.

No code changes are needed to enable signing — only the account setup and repository
secrets described below. Unsigned builds continue to work for local development.

## Release Signing Setup Checklist

This is the **only remaining work to ship signed installers**. Everything in code is done;
these are one-time account and secret-configuration tasks for the maintainer.

### macOS — Apple Developer ID + notarization

- [ ] Enroll in the Apple Developer Program ($99/year) — <https://developer.apple.com/programs/>
- [ ] Create a **Developer ID Application** certificate: Xcode → Settings → Accounts →
      Manage Certificates → "+" → Developer ID Application (or via the developer portal).
- [ ] Export it as a `.p12`: Keychain Access → expand the certificate to include its private
      key → right-click → Export → `.p12`, and set an export password.
- [ ] Base64-encode the `.p12` for the GitHub secret: `base64 -i certificate.p12 | pbcopy`
- [ ] Create an app-specific password for notarization at <https://appleid.apple.com> →
      Sign-In and Security → App-Specific Passwords.
- [ ] Find your Team ID at <https://developer.apple.com/account> → Membership Details.
- [ ] Add the macOS repository secrets (see table below).

`APPLE_IDENTITY` is **not** a secret — the release workflow derives it automatically from the
imported certificate.

| GitHub secret | Value |
|---------------|-------|
| `APPLE_CERTIFICATE` | base64 string of the `.p12` |
| `APPLE_CERTIFICATE_PASSWORD` | the `.p12` export password |
| `APPLE_ID` | your Apple ID email |
| `APPLE_ID_PASSWORD` | the app-specific password |
| `APPLE_TEAM_ID` | your 10-character Team ID |

### Windows — Azure Trusted Signing

- [ ] Create an Azure account and enable Trusted Signing (~$9.99/month — can be disabled
      between releases; see [Cost Optimization](#cost-optimization)).
- [ ] Create a Trusted Signing **account** and a **certificate profile** in the Azure portal.
      The profile requires individual-developer identity validation (allow a few days).
- [ ] Confirm the signing region. The workflow endpoint is hard-coded to East US
      (`https://eus.codesigning.azure.net/` in `release.yml`). If your account is in another
      region, update that endpoint to match.
- [ ] Create an Azure AD app registration (service principal) and generate a client secret.
      Record the client ID, tenant ID, and client secret.
- [ ] Grant that service principal the **Trusted Signing Certificate Profile Signer** role on
      the Trusted Signing account (Access control / IAM).
- [ ] Add the Windows repository secrets (see table below).

| GitHub secret | Value |
|---------------|-------|
| `AZURE_CLIENT_ID` | service principal application (client) ID |
| `AZURE_CLIENT_SECRET` | service principal client secret |
| `AZURE_TENANT_ID` | Azure AD tenant ID |
| `AZURE_SIGNING_ACCOUNT` | Trusted Signing account name |
| `AZURE_CERTIFICATE_PROFILE` | certificate profile name |

All secrets are added under **repository Settings → Secrets and variables → Actions**.

### Verify after the first signed release

- [ ] macOS: `codesign --verify --deep --strict --verbose=2 Romper.app`, then
      `spctl -a -vvv -t install Romper.app` — Gatekeeper should report the app as accepted.
- [ ] Windows: the installer's Properties → Digital Signatures tab shows a valid signature
      (or run `signtool verify /pa /v RomperSetup.exe`).
- [ ] `node scripts/release/validate.js` reports the signing environment as configured
      (it currently treats unsigned builds as a non-blocking warning).

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
