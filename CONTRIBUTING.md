# Contributing to Romper

## Commit Message Standards

All contributors (human and AI agents) should follow these commit message conventions:

### Commit Types

- **feat:** new features or capabilities
- **fix:** bug fixes
- **refactor:** code restructuring without changing functionality  
- **docs:** documentation changes
- **test:** adding or updating tests
- **chore:** maintenance tasks, dependencies, build changes

### Commit Message Format

```
type: brief description in imperative mood

- Bullet point details of changes
- Use present tense, imperative mood ("add", not "added" or "adds")
- Reference task numbers when applicable (e.g., "Task 5.0")
- Mention test status if relevant
```

### Examples

```
feat: implement kit editing with undo/redo system

- Add editable mode toggle for user kits
- Implement action history tracking in database
- Create undo/redo UI controls with keyboard shortcuts
- All tests passing

fix: resolve sample path validation in voice assignment

- Handle missing source_path files gracefully
- Add fallback for broken sample references
- Update validation error messages

refactor: extract database operations into separate modules

- Move kit operations to kitOperations.ts
- Split sample queries into sampleOperations.ts
- Improve code organization and maintainability
```

### Important Rules

- ✅ Use imperative mood ("add", not "added")
- ✅ Brief, descriptive subject line (50 chars or less)
- ✅ Bullet points for details when needed
- ✅ Reference task numbers when applicable
- ❌ **No authorship, co-author tags, or AI attribution**
- ❌ No generic messages like "Update files" or "Fix issues"

## Code Standards

- Follow existing code conventions in the codebase
- Run `npx tsc --noEmit` before committing
- Maintain test coverage
- Use ESLint and Prettier configurations
- Follow architectural patterns established in the project

## Development Workflow

1. Read current task from `tasks/tasks-PRD.md`
2. Implement one sub-task at a time
3. Run TypeScript validation and tests
4. Update task file and mark sub-task complete
5. Commit with proper message format
6. Ask for permission before proceeding to next sub-task

For detailed development context, see `CLAUDE.md` for AI-specific instructions.