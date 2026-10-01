<!--
title: Code Signing
-->

# Code Signing

Unsigned builds trip Gatekeeper on macOS and SmartScreen on Windows, so
release builds are signed. Signing runs only in the tag-triggered release
workflow (`.github/workflows/release.yml`). Each platform's signing steps
are inert until its secrets exist, so forks, local builds and manual
(`workflow_dispatch`) runs can produce unsigned artifacts.

A tag build doesn't start without signing (RE-18). The release's preflight
job fails unless the macOS secrets are set, and checks the App Store
Connect key against Apple (`scripts/check-notary-credentials.mjs`), so a
revoked key or an expired agreement fails in the first minute instead of
at notarize time. Windows needs its secrets too, unless the repository
variable `ALLOW_UNSIGNED_WINDOWS` is `true`: then the Windows build ships
unsigned, the run warns, and the release notes tell Windows users how to
get past SmartScreen. Remove the variable once Azure Trusted Signing is
set up.

Secrets are exposed as narrowly as the workflow allows (RE-19):
- They appear only in the steps that use them, never in a job's
  environment, so `npm ci` and the build run without them. The signing
  steps gate on the preflight job's `mac-signing` and `windows-signed`
  outputs instead.
- The `.p12` and the App Store Connect key are on disk only while the app,
  and later the DMG, are signed and notarized. They are deleted before the
  packaged app's smoke test and Forge's makers run.
- Each job asks only for the permissions it needs, and checkouts don't keep
  the GitHub token.
- Third-party actions that receive secrets or a write token are pinned by
  commit SHA. Update the SHA, not just the comment, when upgrading one.

## macOS: rcodesign

Romper signs with [rcodesign](https://github.com/indygreg/apple-platform-rs)
rather than `@electron/osx-sign`. In CI, osx-sign silently fell back to
ad-hoc signing because it couldn't match the identity in a temporary
keychain. rcodesign reads the `.p12` directly and needs no keychain.

The pipeline, in `release.yml` order:

1. `electron-forge package -p darwin -a arm64` produces an **unsigned**
   `out/Romper-darwin-arm64/Romper.app`. Forge does no signing.
2. `indygreg/apple-code-sign-action@v1` signs the `.app` with
   `--for-notarization` (hardened runtime, timestamp, Developer ID checks)
   and `--config-file electron/resources/rcodesign.toml`.
3. rcodesign (a pinned, SHA-checked download) runs
   `notary-submit --staple --max-wait-seconds 1800` on the `.app`, so the
   notarization ticket is embedded before it's wrapped. The action's own
   notarize step is not used because it hard-codes a 10-minute wait, and
   Apple's notary service sometimes takes longer.
4. `electron-forge make --skip-package` builds the DMG and zip around the
   signed `.app`.
5. The DMG is signed, notarized, and stapled on its own, so offline
   Gatekeeper checks pass when mounting it.

### Per-helper entitlements (`rcodesign.toml`)

Hardened runtime applies to every binary in the bundle, but rcodesign
applies entitlements only where the config declares them. Each of these
needs its own `[default.sign.path."…"]` scope pointing at
`electron/resources/entitlements.plist` (allow-jit,
allow-unsigned-executable-memory, disable-library-validation):

- `Contents/MacOS/romper`, the main executable (`executableName` in
  `forge.config.cjs`)
- `Contents/Frameworks/Romper Helper.app`, and the `(GPU)`, `(Plugin)`, and
  `(Renderer)` helpers

Leave out a helper and V8 can't JIT, so the renderer white-screens on
launch ([#260](https://github.com/peteb4ker/romper/issues/260)).
`entitlements_xml_file` is only valid inside a path scope; placed directly
under `[default.sign]` it fails with `UnknownField`. PR CI never runs this
step, so validate any change here with a real (or RC) tag build.

### Secrets

| Secret | Value |
| --- | --- |
| `APPLE_CERTIFICATE` | base64 of the Developer ID Application `.p12` (cert + private key) |
| `APPLE_CERTIFICATE_PASSWORD` | the `.p12` password |
| `ASC_API_KEY_JSON` | App Store Connect API key, encoded with `rcodesign encode-app-store-connect-api-key <issuer-id> <key-id> <AuthKey.p8>` |

The team ID comes from the certificate. `APPLE_ID`, `APPLE_ID_PASSWORD`, and
`APPLE_TEAM_ID` belonged to the old notarization flow and are unused.

If the preflight's App Store Connect check, or notarization, fails with HTTP
403 (`REQUIRED_AGREEMENTS_MISSING_OR_EXPIRED`), the Apple Developer account
holder must accept the updated agreement at developer.apple.com. Then re-run
the failed job.

## Windows: Azure Trusted Signing

**Cost**: $9.99/month (pay only during release months — see [Cost optimization](#cost-optimization))

Azure Trusted Signing (formerly Azure Artifact Signing) is Microsoft's cloud-based code signing service. It's the recommended option for Windows because:
- No physical hardware (cloud HSM) — works in CI/CD
- First-party [GitHub Action](https://github.com/azure/trusted-signing-action) for pipeline integration
- Managed by Microsoft — direct path to Windows trust
- Available to individual developers in the US and Canada

**Important context on SmartScreen (as of March 2024)**:
- EV and OV certificates are now treated equally — neither gets instant SmartScreen bypass
- All certificates require building reputation through downloads
- Azure Trusted Signing is the only non-EV option that provides immediate SmartScreen trust

Docs: [Azure Trusted Signing](https://azure.microsoft.com/en-us/products/artifact-signing)

### Windows setup

- [ ] Create an Azure account and enable Trusted Signing (~$9.99/month — can be disabled
      between releases; see [Cost optimization](#cost-optimization)).
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

All secrets live under **Settings → Secrets and variables → Actions**.
Once they're set, delete the `ALLOW_UNSIGNED_WINDOWS` variable (same page,
**Variables** tab) so an unsigned Windows build can't ship again.

## Verifying a signed release

- macOS: `xcrun stapler validate Romper.app`,
  `codesign --verify --deep --strict --verbose=2 Romper.app`, and
  `spctl -a -vvv -t exec Romper.app` (expect "source=Notarized Developer ID").
- Windows: the installer's Properties → Digital Signatures tab, or
  `signtool verify /pa /v Romper-X.Y.Z.Setup.exe`.

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

## Alternatives Considered

| Option | Cost | Why Not |
|--------|------|---------|
| SignPath.io (commercial) | Free for OSS | Requires established project reputation to qualify |
| SignPath Foundation | Free for OSS | Requires OSI-approved license, no proprietary code |
| OSSign | Free for OSS | Less documentation, uncertain qualification process |
| Certum Open Source | ~$30/year | Requires physical smartcard for hardware option; cloud option less CI/CD friendly than Azure |
| Traditional EV Certificate | ~$280+/year | More expensive, no SmartScreen advantage since March 2024 |
| SSL.com eSigner | ~$240/year | More expensive than Azure for same cloud-based approach |
