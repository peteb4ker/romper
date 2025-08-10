# Romper Documentation Map

## Overview

This document provides a complete map of all documentation and their interconnections.

## Documentation Structure

### 📁 Root Level

- **[README.md](./README.md)** - Project overview, features, and documentation index
- **[CLAUDE.md](./CLAUDE.md)** - Claude Code instructions with context-aware loading
- **[DOCUMENTATION_MAP.md](./DOCUMENTATION_MAP.md)** - This file

### 📁 User Documentation (`docs/user/`)

- **[docs/index.md](./docs/index.md)** - Main documentation index
- **[docs/user/getting-started.md](./docs/user/getting-started.md)** - Installation and setup
- **[docs/user/kit-browser.md](./docs/user/kit-browser.md)** - Browse and organize kits
- **[docs/user/kit-details.md](./docs/user/kit-details.md)** - Edit individual kits
- **[docs/user/syncing.md](./docs/user/syncing.md)** - Sync to SD card
- **[docs/user/settings.md](./docs/user/settings.md)** - Configure preferences
- **[docs/user/keyboard-shortcuts.md](./docs/user/keyboard-shortcuts.md)** - Shortcuts reference

### 📁 Developer Documentation (`docs/developer/`)

- **[docs/developer/architecture.md](./docs/developer/architecture.md)** - Core design patterns
- **[docs/developer/contributing.md](./docs/developer/contributing.md)** - Contribution guide
- **[docs/developer/development.md](./docs/developer/development.md)** - Development setup
- **[docs/developer/development-workflow.md](./docs/developer/development-workflow.md)** - Task execution standards
- **[docs/developer/coding-guide.md](./docs/developer/coding-guide.md)** - Human-readable coding guide
- **[docs/developer/romper-db.md](./docs/developer/romper-db.md)** - Database documentation
- **[docs/developer/scanning-system.md](./docs/developer/scanning-system.md)** - Kit scanning system
- **[docs/developer/scanning-api.md](./docs/developer/scanning-api.md)** - Scanning API reference

### 📁 AI Development Tools (`.agent/`)

- **[.agent/README.md](./.agent/README.md)** - Agent instructions overview
- **[.agent/context.md](./.agent/context.md)** - Context-aware pattern matching (always loaded)
- **[.agent/AUTO_GENERATION_RULE.md](./.agent/AUTO_GENERATION_RULE.md)** - Critical sync rule

#### Standards (`.agent/standards/`)

- **[.agent/standards/general.md](./.agent/standards/general.md)** - Core principles (always loaded)
- **[.agent/standards/comprehensive.md](./.agent/standards/comprehensive.md)** - Master standards
- **[.agent/standards/react-components.md](./.agent/standards/react-components.md)** - For `*.tsx` files
- **[.agent/standards/custom-hooks.md](./.agent/standards/custom-hooks.md)** - For `hooks/use*.ts`
- **[.agent/standards/database.md](./.agent/standards/database.md)** - For `**/db/*.ts`
- **[.agent/standards/testing.md](./.agent/standards/testing.md)** - For `**/__tests__/*.test.ts`

#### Patterns (`.agent/patterns/`)

- **[.agent/patterns/anti-patterns.md](./.agent/patterns/anti-patterns.md)** - What to avoid
- **[.agent/patterns/ipc-error-handling.md](./.agent/patterns/ipc-error-handling.md)** - Electron IPC standards

### 📁 Project Management (`tasks/`)

- **[tasks/PRD.md](./tasks/PRD.md)** - Product Requirements Document
- **[tasks/tasks-PRD.md](./tasks/tasks-PRD.md)** - Current development tasks

### 📁 Development Workflows (`.github/`)

- **[.github/copilot-instructions.md](./.github/copilot-instructions.md)** - GitHub Copilot standards
- **[.github/chatmodes/Define.chatmode.md](./.github/chatmodes/Define.chatmode.md)** - PRD creation workflow
- **[.github/chatmodes/Plan.chatmode.md](./.github/chatmodes/Plan.chatmode.md)** - Task planning workflow
- **[.github/chatmodes/Build.chatmode.md](./.github/chatmodes/Build.chatmode.md)** - Task execution workflow

## Key Cross-References

### From README.md

- Links to all major documentation categories
- Points to both user and developer docs
- References AI development tools and project management

### From CLAUDE.md

- Links to project requirements and current tasks
- References context-aware standards system
- Points to specific architectural documentation

### From docs/index.md

- Central hub for all human-readable documentation
- Links to both user guides and developer resources
- Cross-references AI tools and project management

### From .agent/context.md

- Auto-loading rules for file-pattern specific standards
- References to all standards and patterns files
- Critical for context-aware instruction loading

## Documentation Flow

```
README.md (Overview)
    ├── docs/index.md (Human docs hub)
    │   ├── docs/user/* (User guides)
    │   └── docs/developer/* (Developer guides)
    ├── CLAUDE.md (AI instructions)
    │   └── .agent/context.md (Context-aware loading)
    │       ├── .agent/standards/* (File-type specific)
    │       └── .agent/patterns/* (Cross-cutting patterns)
    ├── tasks/* (Project management)
    └── .github/* (Development workflows)
```

## Maintenance Notes

### When to Update This Map

- Adding new documentation files
- Changing documentation structure
- Adding new cross-references
- Modifying the AI instruction system

### Auto-Generation Dependencies

- `.agent/standards/comprehensive.md` → All file-type specific standards
- Changes to comprehensive standards require regenerating targeted files
- See [.agent/AUTO_GENERATION_RULE.md](./.agent/AUTO_GENERATION_RULE.md) for details

---

_This map ensures all documentation is properly interconnected and discoverable. Update when adding new documentation or changing the structure._
