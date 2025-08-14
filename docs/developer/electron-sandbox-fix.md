# Electron Sandbox Configuration Fix

## Problem

Ubuntu e2e tests were failing with the following error:

```
[FATAL:sandbox/linux/suid/client/setuid_sandbox_host.cc:163] The SUID sandbox helper binary was found, but is not configured correctly. Rather than run without sandboxing I'm aborting now.
```

## Root Cause

The Electron `chrome-sandbox` binary located at `./node_modules/electron/dist/chrome-sandbox` needs:
1. **Ownership**: `root:root` 
2. **Permissions**: `4755` (SUID bit set)

In CI environments, the binary is installed with regular user ownership and permissions, causing the sandbox initialization to fail.

## Solution

### CI/CD Pipeline Fix

The following steps were added to Ubuntu CI workflows:

#### For E2E Tests (`.github/workflows/e2e.yml`)
```yaml
- name: Configure Electron sandbox (Linux)
  if: matrix.os == 'ubuntu-latest'
  run: |
    SANDBOX_BINARY="./node_modules/electron/dist/chrome-sandbox"
    if [ -f "$SANDBOX_BINARY" ]; then
      sudo chown root:root "$SANDBOX_BINARY"
      sudo chmod 4755 "$SANDBOX_BINARY"
      echo "Sandbox binary configured successfully"
    fi
```

#### For Test Analysis (`.github/workflows/test.yml`)
Similar configuration added to the analysis job that runs the full test suite.

### Manual Fix (Local Development)

If you encounter this issue locally:

```bash
sudo chown root:root ./node_modules/electron/dist/chrome-sandbox
sudo chmod 4755 ./node_modules/electron/dist/chrome-sandbox
```

### Verification

Use the provided test script:

```bash
./scripts/test-electron-sandbox.sh
```

## Technical Details

### What is the SUID Sandbox?

The SUID (Set User ID) sandbox is a security mechanism that:
- Runs the sandbox helper with elevated privileges
- Provides process isolation for Electron/Chromium
- Prevents untrusted code from accessing system resources

### Why This Configuration?

- **4755 permissions**: Sets the SUID bit, allowing the binary to run with root privileges regardless of who executes it
- **root:root ownership**: Ensures the binary runs with root context when the SUID bit is honored
- **Security**: Maintains Electron's security sandbox while allowing proper functionality

### Alternative Approaches

While `--no-sandbox` flags can disable sandboxing, the proper solution is to configure the sandbox correctly rather than disable security features.

## Files Modified

1. `.github/workflows/e2e.yml` - Added sandbox configuration for Ubuntu e2e tests
2. `.github/workflows/test.yml` - Added sandbox configuration for test analysis job  
3. `scripts/test-electron-sandbox.sh` - Verification script for sandbox configuration

## Verification

The fix has been tested and verified to:
- ✅ Allow Electron to launch without sandbox errors
- ✅ Pass e2e tests in Ubuntu CI environment  
- ✅ Maintain security sandbox functionality
- ✅ Work across different test scenarios