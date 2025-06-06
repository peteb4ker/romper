# GitHub Copilot Coding Standards for Romper

## General
- All business logic for UI components must live in a hook file named `hooks/use<ComponentName>`, and UI components must only contain rendering logic and hook calls.
- Empty or unused hook files should be deleted.
- UI logic lives in hook files. Hook files are only needed if the UI component has business logic. Remove empty hook files.
- Always use `import` statements for importing modules and never use `require`. Refactor any usage of `require` to use ES module `import` syntax, even in test files.
- When requirements are not being met, first try to isolate why by adding or updating tests.
- Do not assert that a piece of functionality is working at the end of your messages.

## Testing
- `vitest` is used for testing. Not `jest`.
- centralized mocks, setup, teardown and dependencies in `vitest.setup.ts` should always be referenced when testing.
- Each code file has exactly 1 corresponding unit test file in a relative `__tests__` subdirectory.
- Don't create a second test file for a class. Use the existing one.
- If there are multiple test files for a code file, merge the tests and delete the erroneous empty test file(s).
- Require that all test files are isolated and do not leak state between tests.
- All new and existing code should be unit tested according to the coverage include/exclude patterns in `vite.config.ts`.
- Unit tests only test the responsibility of the file under test. Dependent components and modules should be mocked, not tested.

## Mocking
- Mocks from vitest.setup.ts are used or extended as needed for unit tests.
- Mocks and setup is always DRY.
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


