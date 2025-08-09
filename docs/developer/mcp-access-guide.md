---
layout: default
title: MCP Access Guide for Romper Debugging
---

# MCP Access Guide for Romper Debugging

This guide describes multiple out-of-the-box methods for accessing and debugging the running Romper Electron application using existing tools and infrastructure.

## Method 1: Chrome DevTools Main Process Debugging (Immediate Access)

### Overview
The Romper development server already runs with the `--inspect=5858` flag, enabling immediate Chrome DevTools access to the main process without any additional setup.

### Connection Steps
1. **Start Romper in development mode:**
   ```bash
   npm run dev
   ```

2. **Open Chrome DevTools:**
   - Open Google Chrome
   - Navigate to `chrome://inspect`
   - Click "Open dedicated DevTools for Node"

3. **Connect to Electron main process:**
   - In the Connection tab, add: `localhost:5858`
   - Switch to Console tab for REPL access

### Available Debugging Features

#### Main Process Console REPL
Once connected, you have full access to the Electron main process environment:

```javascript
// Access Electron APIs
const { app, BrowserWindow } = require('electron');
const windows = BrowserWindow.getAllWindows();
console.log('Active windows:', windows.length);

// Access Node.js filesystem
const fs = require('fs');
const path = require('path');

// Access database directly (since it's synchronous)
// Import your database functions
const { getKits, getAllSamples } = require('./db/romperDbCoreORM.js');

// Example: Query database state
const settings = /* get settings from memory */;
const localStorePath = settings.localStorePath;
if (localStorePath) {
  const kits = getKits(localStorePath);
  console.log('Current kits:', kits);
}
```

#### Debugging Capabilities
- **Breakpoints**: Set breakpoints in main process code
- **Variable inspection**: Inspect objects, functions, and state
- **Performance profiling**: Monitor CPU and memory usage
- **Network monitoring**: Track IPC communications
- **File system access**: Directly interact with local files and database

### Accessing Application State

#### Settings and Configuration
```javascript
// Access in-memory settings (assuming you have reference to the settings object)
// This would require slight modification to expose settings globally for debugging
console.log('Current settings:', global.debugSettings || 'Settings not exposed');
```

#### Database Operations
```javascript
// Direct database queries (requires proper path)
const dbPath = path.join(localStorePath, '.romperdb');
const kits = getKits(dbPath);
const samples = getAllSamples(dbPath);
console.log('Database state:', { kits: kits.length, samples: samples.length });
```

## Method 2: Renderer Process DevTools

### Built-in Access
The renderer process (React UI) can be debugged using standard Electron DevTools:

1. **Via keyboard shortcut**: `Cmd+Option+I` (macOS) or `Ctrl+Shift+I` (Windows/Linux)
2. **Via application menu**: View → Toggle Developer Tools
3. **Programmatically**: Add `win.webContents.openDevTools()` to main process

### React DevTools
Since Romper uses React, you can install React Developer Tools browser extension for enhanced component debugging.

## Method 3: Playwright MCP Server Integration

### Installation
```bash
npm install @playwright/mcp  # Already included in package.json
```

### Quick Start (npm scripts)
Romper includes convenient npm scripts for MCP integration:

```bash
# Test MCP connection (both Chrome DevTools and Playwright MCP)
npm run mcp:test

# Start optimized MCP server for Romper debugging  
npm run mcp:server

# Start MCP server in headless mode
npm run mcp:server:headless

# Run full MCP integration test with running Romper
npm run mcp:integration

# Generate MCP usage examples
npm run mcp:examples

# Set up Claude Code MCP integration
npm run mcp:claude

# Complete MCP setup (runs test, integration, and claude setup)
npm run mcp:setup
```

### Manual Usage
The Playwright MCP server provides programmatic access to the running Electron application:

```bash
# Start Playwright MCP server manually
npx @playwright/mcp

# Or use the optimized startup script
node scripts/start-mcp-server.js
```

### Features Available
- **UI automation**: Click buttons, fill forms, navigate UI
- **Screenshots**: Capture current application state
- **DOM inspection**: Query and inspect React components
- **JavaScript execution**: Run code in renderer context
- **Accessibility tree**: Inspect for testing and debugging
- **Network monitoring**: Track renderer-side requests

## Method 4: Electron MCP Server (Alternative)

### Installation
```bash
npm install electron-mcp-server
```

### Features
- **Visual debugging**: Screenshots and application state capture
- **Deep inspection**: DOM elements, application data, performance metrics  
- **DevTools protocol integration**: Universal compatibility
- **Development observability**: Monitor logs, system info, and app behavior

## Testing Integration

### Extend Existing E2E Tests
Romper already has Playwright E2E tests in `app/renderer/components/hooks/__e2e__/localStoreWizard.e2e.test.ts`. These can be extended for debugging:

```typescript
// Add debugging capabilities to existing tests
test("debug application state", async () => {
  const electronApp = await electron.launch({
    args: ["dist/electron/main/index.js"],
    env: process.env,
  });
  
  const window = await electronApp.firstWindow();
  
  // Take screenshot for visual debugging
  await window.screenshot({ path: 'debug-state.png' });
  
  // Inspect DOM structure
  const kitsCount = await window.locator('[data-testid*="kit"]').count();
  console.log('Kits visible in UI:', kitsCount);
  
  // Execute JavaScript in renderer
  const reactState = await window.evaluate(() => {
    // Access React DevTools or component state
    return window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
  });
  
  await electronApp.close();
});
```

## Best Practices

### Security Considerations
- **Development only**: Inspector access should only be enabled in development mode
- **Port access**: Ensure `localhost:5858` is not exposed in production builds
- **Database access**: Be cautious when modifying database state during debugging

### Performance Impact
- **Inspector overhead**: Chrome DevTools connection adds minimal performance overhead
- **Memory usage**: DevTools can increase memory usage during debugging sessions
- **Breakpoint impact**: Setting breakpoints will pause application execution

### Debugging Tips
1. **Start simple**: Use console.log and Chrome DevTools console first
2. **Database snapshots**: Take database backups before making changes during debugging
3. **State isolation**: Test changes in isolated environments to avoid corrupting development data
4. **Network tab**: Monitor IPC communications between main and renderer processes

## Quick Reference

### Start Debugging Session
```bash
# Terminal 1: Start Romper
npm run dev

# Terminal 2: Test MCP connection
npm run mcp:test

# Terminal 3: Start MCP server (if test passes)
npm run mcp:server
```

### Available npm Scripts
| Command | Description |
|---------|-------------|
| `npm run mcp:test` | Test both Chrome DevTools and Playwright MCP availability |
| `npm run mcp:server` | Start optimized MCP server (headed mode) |
| `npm run mcp:server:headless` | Start MCP server in headless mode |
| `npm run mcp:integration` | Test MCP integration with running Romper |
| `npm run mcp:examples` | Generate usage examples and demo scripts |
| `npm run mcp:claude` | Set up Claude Code MCP integration |
| `npm run mcp:analyze` | **Comprehensive app analysis via MCP** |
| `npm run mcp:setup` | Complete MCP setup (all tests and configuration) |

### Output Locations
- **Screenshots**: `mcp-output/*.png`
- **Traces**: `mcp-output/*.zip`
- **Session Data**: `mcp-output/session-*`
- **Usage Examples**: `mcp-output/examples/`
- **Claude Code Config**: `mcp-output/claude-code-mcp-config.json`
- **Integration Guide**: `mcp-output/CLAUDE-CODE-INTEGRATION.md`

### Connection URLs
- **Romper UI**: http://localhost:5173
- **Chrome DevTools**: ws://localhost:5858
- **MCP Server**: http://localhost:3000

---

*This guide provides immediate access to Romper debugging capabilities using existing infrastructure and professional tooling without requiring custom development work.*