# GitHub Copilot Coding Standards for Romper

> **Quick Reference**: For comprehensive project context, see [CLAUDE.md](../CLAUDE.md), [docs/developer/architecture.md](../docs/developer/architecture.md), and [.agent/context.md](../.agent/context.md) for context-aware standards.

## General
- All business logic for UI components must live in a hook file named `hooks/use<ComponentName>`, and UI components must only contain rendering logic and hook calls.
- Empty or unused hook files should be deleted.
- UI logic lives in hook files. Hook files are only needed if the UI component has business logic. Remove empty hook files.
- Always use `import` statements for importing modules and never use `require`. Refactor any usage of `require` to use ES module `import` syntax, even in test files.
- When requirements are not being met, first try to isolate why by adding or updating tests.
- Do not assert that a piece of functionality is working at the end of your messages.
- if a tsx file grows to more than 350 lines, it should be refactored into multiple logical components.

## Build Validation
- After making any code changes, always run `npx tsc --noEmit` to check for TypeScript compilation errors before marking a task complete.
- Use `npx tsc --noEmit` rather than a full build as it's faster and sufficient for type checking.
- Fix all TypeScript errors before proceeding to the next task.
- Use the `get_errors` tool to check for errors in specific files during development.

## Testing
- `vitest` is used for testing. Not `jest`.
- centralized mocks, setup, teardown and dependencies in `vitest.setup.ts` should always be referenced when testing.
- Each code file has exactly 1 corresponding unit test file in a relative `__tests__` subdirectory.
- Don't create a second test file for a class. Use the existing one.
- Require that all test files are isolated and do not leak state between tests.
- All new and existing code should be unit tested according to the coverage include/exclude patterns in `vite.config.ts`.
- Unit tests only test the responsibility of the file under test. Dependent components and modules should be mocked, not tested.
- End to end tests are run with `npm run test:e2e`
- Clear the dom between tests

## Mocking
- Mocks from vitest.setup.ts are used or extended as needed for unit tests.
- Mocks and setup is always DRY. Wheverer possible use a common mock.
- Mock imported modules or functions in unit tests to avoid testing their internal implementation. Only test the integration and behavior of the code under test, not the logic of its dependencies.
- Test files have the `.test.ts` suffix.
- All test and mock files should be kept up to date with code changes.

## Performance

To maintain responsive UX and good interaction latency:

- Optimize the number of DOM nodes to keep the application performant.
- Virtualize large lists using react-window to reduce DOM rendering overhead.
- Memoize list items with React.memo to avoid unnecessary re-renders.
- Use useMemo to cache expensive computations (e.g. filtering or sorting).
- Debounce user input where appropriate (e.g. search/filter boxes).
- Ensure that keyboard or mouse interactions do not trigger full re-renders of the list or parent components.

## Tasks

- When prompted, 'next task', always refer to tasks/tasks.prd-md for the next task.
- Implement the next task using instructions/process-task-list.md.

## Commit Message Format

When asked to provide a summary of completed work, always format it as a conventional commit message:

```
<type>: <description>

- Bullet point summary of key changes
- Include specific technical details
- Reference files modified
- Note any breaking changes or important considerations
- Include test status and counts

Closes #<task-number> - <task-description>
Tests: <passing>/<total> passing
```

**Guidelines:**
- Use conventional commit types: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`
- Keep the first line under 50 characters when possible
- Use bullet points for detailed changes
- Always include test status
- Reference completed task numbers
- Mention any backward compatibility considerations

**Example:**
```
feat: transition from SD card to local store as primary data source

- Replace sdCardPath with localStorePath throughout main app logic
- Remove Select SD Card button from KitBrowserHeader
- Update StatusBar to show local store path with database icon
- Refactor SettingsContext to use localStorePath consistently
- Update all component props, types, and hooks to use localStorePath
- Refactor 400+ unit tests to reflect local store usage

Closes #2.9 - SD card to local store transition
Tests: 400/400 passing
```

