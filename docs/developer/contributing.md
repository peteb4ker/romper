---
layout: default
title: Contributing to Romper
---

# Contributing to Romper

Welcome to the Romper community! This guide helps you get started contributing to Romper, a cross-platform sample manager for the Squarp Rample Eurorack sampler.

## Quick Start for Contributors

### 1. Understanding the Project

- **Read the [Product Requirements Document](../tasks/PRD.md)** - Complete project vision and goals
- **Review the [Architecture Overview](./architecture.md)** - Core design patterns and decisions
- **Check the [Current Task List](../tasks/tasks-PRD.md)** - See what's being worked on

### 2. Development Setup

Follow the [Development Setup Guide](./development.md) to get your environment ready:

```bash
git clone https://github.com/peteb4ker/romper.git
cd romper
npm install
npm run dev  # Start development server
```

### 3. Pick a Task

- Browse [open issues](https://github.com/peteb4ker/romper/issues) labeled `good-first-issue`
- Check the [task list](../tasks/tasks-PRD.md) for specific implementation tasks
- Ask questions in [GitHub Discussions](https://github.com/peteb4ker/romper/discussions)

## Project Overview

### What is Romper?

Romper streamlines sample management for Rample owners by providing:

- **Kit Browser** - Organize and navigate sample kits efficiently
- **Sample Preview** - Audition samples before committing to SD card
- **XOX Sequencer** - Preview kits in musical context
- **Safe Operations** - Non-destructive editing with validation
- **Cross-Platform** - Works on macOS, Windows, and Linux

### Target Users

- **Rample Owners** - Electronic music producers using the Squarp Rample
- **Sample Enthusiasts** - Musicians who work with large sample libraries
- **Creative Experimenters** - Artists who want fast iteration and experimentation

## Core Concepts for Contributors

### Reference-Only Sample Management

Romper uses a unique architecture where user samples are **referenced by path** rather than copied locally:

- Samples stay in their original filesystem locations
- Database stores absolute paths (`source_path`) to samples
- Only copied to SD card during sync operations
- Prevents local storage bloat and maintains clean organization

### Editable Kit System

- **Factory kits**: Read-only by default (editable = false)
- **User kits**: Editable by default (editable = true)
- **Modification tracking**: Changes tracked until SD card sync
- **Undo/redo**: Complete action history with database persistence

### Database Architecture

- **Drizzle ORM**: Type-safe database operations with better-sqlite3
- **Natural keys**: Uses kit names (A0, B1, etc.) instead of auto-increment IDs
- **Voice organization**: 4 voices per kit, 12 slots per voice
- **Schema-first**: Database schema drives TypeScript types

## Development Guidelines

### Code Standards

- **Hook-based architecture**: Business logic in custom hooks, UI components for rendering only
- **TypeScript strict mode**: Zero compilation errors, no `any` types
- **80% test coverage**: Comprehensive unit tests with Vitest
- **Import statements only**: ES modules, never `require()`

### Component Patterns

```typescript
// ✅ Good: Hook handles business logic
function useKitEditor(kitName: string) {
  // Business logic here
  return { editableMode, toggleEditMode, addSample };
}

function KitEditor({ kitName }: Props) {
  const { editableMode, toggleEditMode, addSample } = useKitEditor(kitName);
  // Only rendering logic here
  return <div>...</div>;
}

// ❌ Bad: Business logic in component
function KitEditor({ kitName }: Props) {
  const [editableMode, setEditableMode] = useState(false);
  // Business logic mixed with rendering
}
```

### Database Patterns

```typescript
// ✅ Good: Use Drizzle ORM with terminal methods
const kits = db.select().from(kitsTable).all();
const kit = db.select().from(kitsTable).where(eq(kitsTable.name, "A0")).get();

// ❌ Bad: Missing terminal method
const kits = db.select().from(kitsTable); // No .all() call
```

### Testing Patterns

```typescript
// ✅ Good: Mock dependencies, test behavior
vi.mock("../db/romperDbCore", () => ({
  getKit: vi.fn().mockResolvedValue(mockKit),
}));

test("should load kit when provided valid name", () => {
  const { result } = renderHook(() => useKitEditor("A0"));
  expect(result.current.kit).toEqual(mockKit);
});
```

## Contribution Types Welcome

### 🐛 Bug Fixes

- Fix issues affecting user workflows
- Resolve performance problems
- Address edge cases and error handling
- Improve reliability and stability

### ✨ Feature Enhancements

- Implement features from the [task list](../tasks/tasks-PRD.md)
- Improve existing functionality based on user feedback
- Add accessibility improvements
- Enhance keyboard navigation and shortcuts

### 🧪 Testing

- Add test coverage for untested code
- Create integration tests for user workflows
- Add edge case validation
- Performance testing for large kit collections

### 📚 Documentation

- Improve user guides and API documentation
- Add code examples and tutorials
- Update documentation for new features
- Create troubleshooting guides

### 🎨 UI/UX Improvements

- Enhance visual design and user experience
- Improve accessibility (WCAG 2.1 AA)
- Optimize for different screen sizes
- Add keyboard navigation improvements

## Contribution Process

### 1. Before Starting Work

- **Check existing issues** - Avoid duplicate work
- **Discuss significant changes** - Open an issue for major features
- **Review coding standards** - Follow project patterns and conventions
- **Set up development environment** - Ensure tests pass locally

### 2. Development Process

**Git Worktree Setup (Required):**

All development work must use git worktrees for proper isolation and parallel development:

```bash
# Create a worktree for your contribution
git worktree add worktrees/$(date +%Y%m%d)-your-feature -b feature/your-feature-name
cd worktrees/$(date +%Y%m%d)-your-feature

# Install dependencies in the worktree
npm install
```

**Development Workflow:**
- **Use git worktrees** - Required for all contributions, enables parallel development
- **One feature per worktree** - Maintain clear isolation between different features
- **Follow task workflow** - Implement one sub-task at a time within your worktree
- **Write tests first** - TDD approach when possible
- **Validate frequently** - Run `npx tsc --noEmit` and tests often in worktree context

**Worktree Benefits for Contributors:**
- **Parallel work**: Contribute to multiple features simultaneously
- **Clean environment**: Each contribution gets a fresh, isolated workspace
- **No context switching**: Work on different issues without stashing changes
- **Quality isolation**: Pre-commit hooks run independently per worktree

### 3. Submission Process

**From Your Worktree:**

```bash
# Validate all changes in worktree
npm run pre-commit

# Commit with conventional format
git add .
git commit -m "feat: add your feature description"

# Push your branch
git push origin feature/your-feature-name

# Clean up worktree after PR is merged
cd ../../main
git worktree remove worktrees/$(date +%Y%m%d)-your-feature
```

**Submission Checklist:**
- **Test thoroughly** - Ensure all tests pass in worktree isolation
- **Update documentation** - Include relevant docs changes  
- **Follow commit conventions** - Use conventional commit messages
- **Submit pull request** - Provide clear description and context
- **Clean up worktree** - Remove worktree after successful merge

### 4. Code Review

- **Address feedback promptly** - Respond to review comments
- **Iterate based on suggestions** - Collaborate to improve code quality
- **Update tests** - Ensure coverage remains high
- **Squash commits** - Clean up commit history before merge

## Quality Standards

### Code Quality

- **TypeScript validation**: `npx tsc --noEmit` must pass
- **Test coverage**: 80% minimum coverage maintained
- **Linting**: `npm run lint` must pass without errors
- **Performance**: UI interactions under 50ms

### User Experience

- **Accessibility**: Support keyboard navigation and screen readers
- **Error handling**: Graceful degradation with helpful error messages
- **Data safety**: Never corrupt user data or SD card contents
- **Cross-platform**: Test on macOS, Windows, and Linux when possible

## Getting Help

### Resources

- **[GitHub Issues](https://github.com/peteb4ker/romper/issues)** - Bug reports and feature requests
- **[GitHub Discussions](https://github.com/peteb4ker/romper/discussions)** - Questions and community interaction
- **[Documentation](./index.md)** - User guides and technical documentation
- **Code Review** - Learn from existing code and pull request reviews

### Community Guidelines

- **Be respectful** - Maintain welcoming environment for all skill levels
- **Stay focused** - Prioritize changes that improve Rample owner experience
- **Quality first** - Maintain code quality, test coverage, and documentation
- **Hardware context** - Remember features should align with Rample capabilities

### Support Channels

- **Documentation Questions** - Check existing docs first, then ask in discussions
- **Bug Reports** - Use GitHub Issues with detailed reproduction steps
- **Feature Ideas** - Discuss in GitHub Discussions before implementing
- **Code Questions** - Review existing patterns and ask specific questions

## Recognition

### Contributors

All contributors are recognized in the project:

- **GitHub Contributors Graph** - Automatic recognition for merged PRs
- **Release Notes** - Major contributors mentioned in release announcements
- **Community Highlights** - Outstanding contributions featured in discussions

### Types of Recognition

- **Code Contributors** - Direct code improvements and bug fixes
- **Documentation Contributors** - Improved guides and API documentation
- **Community Contributors** - Helpful discussions and issue triage
- **Testing Contributors** - Improved test coverage and quality assurance

---

Thank you for your interest in contributing to Romper! Your contributions help make sample management better for the entire Rample community. 🎵
