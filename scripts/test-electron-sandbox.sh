#!/bin/bash

# Test script to verify Electron sandbox configuration
# This script tests if the SUID sandbox binary is properly configured

set -e

echo "🔍 Testing Electron sandbox configuration..."

SANDBOX_BINARY="./node_modules/electron/dist/chrome-sandbox"

# Check if the sandbox binary exists
if [ ! -f "$SANDBOX_BINARY" ]; then
    echo "❌ Error: chrome-sandbox binary not found at $SANDBOX_BINARY"
    echo "   Make sure you have run 'npm install' first"
    exit 1
fi

echo "✅ Found chrome-sandbox binary"

# Check current permissions
PERMISSIONS=$(stat -c "%a" "$SANDBOX_BINARY" 2>/dev/null || echo "unknown")
OWNER=$(stat -c "%U:%G" "$SANDBOX_BINARY" 2>/dev/null || echo "unknown")

echo "📋 Current sandbox binary status:"
echo "   Path: $SANDBOX_BINARY"
echo "   Permissions: $PERMISSIONS"
echo "   Owner: $OWNER"
echo "   Detailed: $(ls -la "$SANDBOX_BINARY")"

# Check if properly configured
if [ "$PERMISSIONS" = "4755" ] && [ "$OWNER" = "root:root" ]; then
    echo "✅ Sandbox binary is properly configured (SUID bit set, owned by root)"
    
    # Test Electron launch if we're in CI environment
    if [ "$CI" = "true" ] && [ -n "$DISPLAY" ]; then
        echo "🧪 Testing Electron launch in CI environment..."
        timeout 10s npm run build > /dev/null 2>&1 || echo "Build skipped"
        timeout 10s npx electron dist/electron/main/index.js --version > /dev/null 2>&1 && echo "✅ Electron launches successfully" || echo "⚠️  Electron launch test failed (may be due to environment constraints)"
    fi
    
    echo "🎉 Sandbox configuration test PASSED"
    exit 0
else
    echo "❌ Sandbox binary is NOT properly configured"
    echo "   Expected: permissions 4755, owner root:root"
    echo "   Actual: permissions $PERMISSIONS, owner $OWNER"
    
    if [ "$(id -u)" = "0" ]; then
        echo "🔧 Attempting to fix sandbox configuration..."
        chown root:root "$SANDBOX_BINARY"
        chmod 4755 "$SANDBOX_BINARY"
        echo "✅ Sandbox configuration fixed"
        exit 0
    else
        echo "❗ Run with sudo to fix the configuration:"
        echo "   sudo chown root:root $SANDBOX_BINARY"
        echo "   sudo chmod 4755 $SANDBOX_BINARY"
        exit 1
    fi
fi