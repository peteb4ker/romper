# MCP Analysis Command

## Overview

The `npm run mcp:analyze` command provides comprehensive state analysis of the running Romper application through MCP integration. It automatically handles server startup, connects via MCP, analyzes the app state, and provides actionable recommendations.

## Usage

```bash
npm run mcp:analyze
```

## What It Does

### 1. Prerequisites Check

- Verifies dev server status (port 5173)
- Checks Electron debug server (port 5858)
- Confirms MCP server availability (port 3000)
- Validates Playwright MCP installation

### 2. Server Management

- Starts Romper dev server if not running
- Handles MCP server startup (if needed)
- Manages process lifecycle and cleanup

### 3. HTTP Analysis

- Fetches and analyzes the HTML structure
- Checks for React Hot Reload configuration
- Validates Vite client integration
- Verifies Content Security Policy setup

### 4. MCP Script Generation

- Creates a comprehensive analysis script for MCP clients
- Includes UI component discovery
- Generates performance testing code
- Provides error state detection logic

### 5. Recommendations

- Analyzes current state and identifies improvements
- Prioritizes issues by severity
- Provides actionable solutions
- Generates comprehensive reports

## Output Files

All files are saved to `mcp-output/analysis/`:

| File                     | Description                                  |
| ------------------------ | -------------------------------------------- |
| `mcp-analysis-script.js` | Ready-to-run script for MCP clients          |
| `analysis-report.json`   | Machine-readable analysis results            |
| `ANALYSIS-REPORT.md`     | Human-readable analysis report               |
| `*.png`                  | Screenshots (generated when MCP script runs) |

## Generated MCP Analysis Script

The generated script includes:

- **Page Navigation**: Connects to http://localhost:5173
- **Screenshot Capture**: Takes screenshots at key analysis points
- **Component Discovery**: Finds Romper-specific UI components
- **Error Detection**: Identifies error states and issues
- **Theme Testing**: Tests dark/light mode switching
- **Performance Metrics**: Captures load times and resource usage
- **Accessibility Analysis**: Checks for proper ARIA attributes

## Using the Generated Script

### Option 1: With Claude Code MCP Client

```bash
# 1. Start MCP server (if not already running)
npm run mcp:server

# 2. Connect Claude Code MCP client to localhost:3000
# 3. Copy and run the generated script content
```

### Option 2: With Standalone MCP Client

```javascript
// Load and execute the generated script in your MCP client
// Script path: mcp-output/analysis/mcp-analysis-script.js
```

## Example Analysis Results

### App State Analysis

```json
{
  "title": "Romper",
  "hasReactRefresh": true,
  "hasViteClient": true,
  "hasCSP": true,
  "mainElement": "app"
}
```

### UI Component Analysis (via MCP)

```json
{
  "testIds": ["kit-browser", "sample-slot", "theme-toggle"],
  "kitComponents": 5,
  "sampleComponents": 12,
  "hasLocalStoreWizard": true,
  "hasKitBrowser": true
}
```

### Performance Metrics (via MCP)

```json
{
  "loadTime": 245,
  "domContentLoaded": 180,
  "resourceCount": 23
}
```

## Common Use Cases

### Development Debugging

```bash
# Quick health check during development
npm run mcp:analyze

# Review the markdown report for issues
open mcp-output/analysis/ANALYSIS-REPORT.md
```

### Pre-Commit Validation

```bash
# Ensure app is in good state before committing
npm run mcp:analyze
# Check for any new high-priority recommendations
```

### Performance Monitoring

```bash
# Generate analysis with MCP client for performance data
npm run mcp:analyze
npm run mcp:server
# Run the MCP analysis script to capture metrics
```

### UI Component Inventory

```bash
# Generate component analysis for documentation
npm run mcp:analyze
# Use MCP client to run the generated script for component discovery
```

## Integration with Other Commands

### Full MCP Setup Flow

```bash
# Complete MCP setup and analysis
npm run mcp:setup    # Setup all MCP tooling
npm run mcp:analyze  # Analyze current state
npm run mcp:server   # Start server for detailed analysis
```

### Development Workflow

```bash
# Daily development routine
npm run dev          # Start Romper
npm run mcp:analyze  # Check app state
# Review recommendations and implement fixes
```

## Troubleshooting

### Server Connection Issues

- Ensure Romper is running: `npm run dev`
- Check port availability: `lsof -i :5173,5858,3000`
- Restart servers if needed

### MCP Script Execution

- Verify MCP client is connected to localhost:3000
- Check browser permissions for automation
- Ensure viewport size is adequate (1280x800)

### Analysis Failures

- Review generated logs in analysis directory
- Check network connectivity to localhost:5173
- Verify Electron process is responsive

## Advanced Usage

### Custom Analysis Parameters

The script can be extended with additional analysis:

```javascript
// Add to generated MCP script
const customAnalysis = await page.evaluate(() => {
  // Your custom analysis logic here
  return analyzeSpecificFeature();
});
```

### Continuous Integration

```bash
# CI pipeline usage
npm run build
npm run mcp:analyze
# Parse analysis-report.json for automated validation
```

---

This command provides a comprehensive foundation for understanding and improving the Romper application through automated analysis and MCP integration.
