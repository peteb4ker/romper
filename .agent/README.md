# Romper Agent Instructions

This folder contains machine-readable coding standards and patterns for AI development tools working on Romper.

## How It Works

### Context-Aware Loading
- **[context.md](./context.md)** - Always loaded, contains file pattern matching rules
- Based on current working file, additional specific instructions are automatically loaded
- Efficient context usage - only relevant standards loaded (~300 words vs 2,400+ comprehensive)

### File Pattern Matching
- `*.tsx` → React component standards (hook-based architecture)  
- `hooks/use*.ts` → Custom hook standards (single responsibility, dependency injection)
- `db/*.ts` → Database standards (Drizzle ORM, DbResult pattern)
- `__tests__/*.test.ts` → Testing standards (Vitest, mocking patterns)
- Files with `window.electronAPI` → IPC error handling patterns

### Standards Hierarchy
1. **General** (always loaded) - Core principles, TypeScript, ESM requirements
2. **File-type specific** - Targeted patterns for current file type
3. **Pattern-specific** - Additional patterns like performance, security, anti-patterns

## File Structure

```
.agent/
├── context.md                    # Always loaded, pattern matching rules
├── AUTO_GENERATION_RULE.md      # Critical synchronization rule
├── standards/
│   ├── general.md               # Core principles (always applies)
│   ├── comprehensive.md         # Master standards source
│   ├── react-components.md      # For *.tsx files
│   ├── custom-hooks.md          # For hooks/use*.ts files
│   ├── database.md              # For **/db/*.ts files
│   └── testing.md               # For **/__tests__/*.test.ts files
└── patterns/
    ├── anti-patterns.md         # What to avoid across all code
    └── ipc-error-handling.md    # Electron IPC best practices
```

## Auto-Generation Rule

**CRITICAL**: When `standards/comprehensive.md` is updated, ALL file-type specific standards must be regenerated to maintain consistency. This applies to all AI development tools and human developers.

## Usage by Different Tools

### Claude Code
- Automatically loads relevant instructions based on working file
- Efficient context window usage
- Consistent guidance across development sessions

### GitHub Copilot  
- Reference these patterns for code completion suggestions
- Use anti-patterns to avoid common mistakes
- Follow established architectural decisions

### Human Developers
- Quick reference for code review standards
- Onboarding guide for project patterns
- See [docs/developer/coding-guide.md](../docs/developer/coding-guide.md) for human-readable version

## Key Standards

### ESM Modules (Critical)
- Use ES modules everywhere except `electron/preload/index.ts`
- Never use `require()` or `module.exports` outside preload script

### IPC Error Handling
- IPC methods from preload script are guaranteed available
- Remove unnecessary availability checks (`window.electronAPI?.method`)
- Use direct calls with proper try/catch error handling

### Architecture Patterns
- React: Hook-based architecture, business logic in hooks
- Database: Drizzle ORM with DbResult pattern, synchronous operations
- Testing: Vitest with 80% coverage, mock dependencies properly

---

*This system ensures consistent, contextually-relevant coding guidance while maintaining efficient context window usage for AI development tools.*