---
layout: default
---

# Developer Setup

These instructions are for developers who want to work on Romper itself.

## Dual node_modules Setup for Electron ABI Compatibility

Romper uses native modules (like `better-sqlite3`) that must match the ABI of the runtime. To avoid rebuild headaches, we use:
- `node_modules/` for Node.js (dev/test)
- `electron_node_modules/` for Electron (runtime)

### Install dependencies

- **For development and testing (Node.js):**
  ```bash
  npm install
  ```
- **For Electron runtime:**
  ```bash
  npm run install:electron
  ```
  This runs `npm install` inside `electron_node_modules/`.

### How to run Electron

- **Development:**
  ```bash
  npm run electron:dev
  ```
- **Production:**
  ```bash
  npm run electron:prod
  ```

All Electron scripts set `NODE_PATH=./electron_node_modules/node_modules` so Electron loads the correct ABI for native modules. All dev/test scripts use the root `node_modules`.

### Adding/Updating Dependencies

- **For dev/test only:**
  `npm install <package>` in the root.
- **For Electron runtime:**
  `cd electron_node_modules && npm install <package>`

### Troubleshooting

If you see native module ABI errors in Electron, ensure you have run `npm run install:electron` after any dependency changes.

## Rebuilding Native Modules for Electron

If you install or update any native dependencies (such as `better-sqlite3`) for Electron, you must rebuild them for Electron's Node.js ABI. This ensures compatibility and prevents errors like `127/135` when running Electron.

### How to Rebuild

Run the following command from the project root:

```
npm run rebuild:electron
```

This will rebuild `better-sqlite3` in the `electron_node_modules` directory for the Electron runtime. Always run this after adding, updating, or removing native modules for Electron.

- The script uses [`electron-rebuild`](https://www.npmjs.com/package/electron-rebuild) and targets only the Electron runtime dependencies.
- If you encounter module loading errors in Electron, try running this command again.

## Clone and Install

```bash
git clone https://github.com/snarktank/romper.git
cd romper
npm install
```

## Run in Development Mode

Open two terminals:

```bash
npm run dev
```

and in the second terminal:

```bash
npm run start
```

Electron will launch and connect to the Vite dev server for hot reloading.

## Running Tests

- **All tests:**
  ```sh
  npm test
  ```
- **Unit tests only:**
  ```sh
  npm run test:unit
  ```
- **Integration tests only:**
  ```sh
  npm run test:integration
  ```

### Test Structure

- Unit tests live in `__tests__` folders next to the code they test.
- Integration tests live in `__tests__/integration/` subfolders.
- This separation makes it easy to run fast, isolated unit tests or slower, more comprehensive integration tests as needed.

