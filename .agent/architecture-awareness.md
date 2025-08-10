# Architecture Awareness for AI Agents

**Purpose**: Provide agents with essential architectural context for development decisions
**Based on**: Comprehensive architecture audit findings
**Updated**: 2025-08-09

## Codebase Quality Context

### Exceptional Architecture Status
This codebase demonstrates **reference-quality architecture** with:
- 100% TypeScript coverage (zero `any` types)
- 745+ comprehensive test files
- Clean separation of concerns across all layers
- Minimal technical debt (<0.1% ratio)

**Implication**: Maintain these exceptional standards. Do not lower the bar.

## File Size Constraints

### Strict Limits (Enforced)
- **Maximum file size**: 400 lines
- **Current large files** (must be decomposed):
  - `electron/main/services/sampleService.ts` (961 lines)
  - `electron/main/services/syncService.ts` (899 lines)
  - `electron/preload/index.ts` (582 lines)
  - `electron/main/db/operations/crudOperations.ts` (473 lines)

**When creating/modifying files**:
1. Check line count before committing
2. Decompose if approaching 400 lines
3. Extract utilities, types, or domain logic
4. Maintain single responsibility principle

## Component Architecture Patterns

### Required React Patterns
```typescript
// ✅ CORRECT: Hook-based logic separation
function Component({ props }: ComponentProps) {
  const businessLogic = useComponentLogic(props);
  const anotherConcern = useAnotherConcern();
  
  return <div>{/* Pure rendering only */}</div>;
}
```

### Hook Organization (60+ hooks across 5 domains)
```
hooks/
├── kit-management/      # Kit operations and state
├── sample-management/   # Sample handling and validation
├── voice-panels/        # Voice UI interactions
├── shared/             # Reusable cross-domain hooks
└── wizard/             # Setup and configuration
```

**When creating hooks**:
- Single responsibility per hook
- Compose multiple focused hooks instead of one large hook
- Follow existing domain boundaries

## Database Layer Patterns

### Drizzle ORM Standards
```typescript
// ✅ REQUIRED: Schema-first with type inference
export const tableName = sqliteTable("table_name", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
});

// ✅ REQUIRED: Proper error handling
export async function operation(): Promise<Result<T>> {
  try {
    const result = await db.operation();
    return { success: true, data: result };
  } catch (error) {
    return createErrorResult(error, "Context");
  }
}
```

### Reference-Only Sample Architecture
- User samples stored via `source_path` (never copied to local store)
- Immutable baseline preserved from setup
- All changes are references until SD card sync

## IPC Communication Patterns

### Type-Safe IPC (88 endpoints)
```typescript
// Preload: Type-safe wrapper
const api = {
  operation: (param: Type) => ipcRenderer.invoke("channel", param)
};

// Main: Async handler with error handling
ipcMain.handle("channel", async (event, param) => {
  try {
    return await operation(param);
  } catch (error) {
    logError(error, "IPC:channel");
    throw error;
  }
});
```

## Testing Requirements

### Co-located Test Strategy
```
component/
├── Component.tsx
└── __tests__/
    ├── Component.test.tsx          # Unit tests
    ├── Component.integration.test.tsx # Integration
    └── Component.specific.test.tsx    # Feature-specific
```

### Absolute Requirements
- **No skipped tests** (`.skip()` is forbidden)
- **Test all error paths** alongside success paths
- **Mock external dependencies** using centralized mocks
- **Comprehensive coverage** for business logic

## Error Handling Patterns

### Centralized Error Utilities
```typescript
import { createErrorResult, getErrorMessage, logError } from '@/shared/errorUtils';

// Always use these utilities for consistent error handling
```

### Error Handling Flow
1. **Catch errors** at operation boundaries
2. **Log with context** using `logError(error, context)`
3. **Return Result type** with `createErrorResult(error, prefix)`
4. **Handle gracefully** in UI with user-friendly messages

## Performance Considerations

### Current Optimizations
- React.memo for appropriate components
- useMemo/useCallback for expensive operations
- Prepared database statements
- Batch operations

### Performance Rules
- **Profile before optimizing** complex operations
- **Memoize expensive calculations** only
- **Avoid premature optimization** unless metrics show need
- **Monitor render cycles** in complex components

## Security Requirements

### Established Security Patterns
- **Context isolation** enabled in Electron
- **Input validation** via TypeScript and runtime checks
- **Path sanitization** for all file operations
- **No unsafe APIs** (shell execution, eval, etc.)

**Never compromise** these security patterns.

## Deprecation and Technical Debt

### Current Technical Debt (Minimal)
1. **Deprecated field**: `kits.artist` in schema (needs removal)
2. **Incomplete test**: Cross-voice drag test TODO
3. **Large files**: 4 files need decomposition

### Debt Management
- **Address immediately** when encountered
- **Don't add new debt** without explicit justification
- **Create tracking issues** for planned refactoring

## Code Quality Gates

### Pre-commit Standards
- TypeScript compilation succeeds
- ESLint passes with zero warnings
- All tests pass (unit + integration)
- Build completes successfully

### Type Safety Requirements
- **Never use `any` types** (current: 0 instances)
- **Proper error handling** for all async operations
- **Validate inputs** at API boundaries
- **Type external dependencies** or create type definitions

## Component and Hook Design

### Composition Over Inheritance
```typescript
// ✅ EXCELLENT: Multiple focused hooks
function useComplexFeature() {
  const dataOps = useDataOperations();
  const ui = useUIState();
  const validation = useValidation();
  
  return { ...dataOps, ...ui, ...validation };
}
```

### Separation of Concerns
- **Components**: Pure rendering + hook calls
- **Hooks**: Business logic + state management
- **Services**: External API interaction
- **Utilities**: Pure functions + helpers

## Development Workflow

### When Adding Features
1. **Check existing patterns** before creating new ones
2. **Compose existing hooks** rather than duplicating logic
3. **Add tests first** or alongside implementation
4. **Update types** for any new data structures
5. **Document complex logic** with JSDoc comments

### When Refactoring
1. **Maintain test coverage** throughout refactoring
2. **Preserve API contracts** for existing functions
3. **Update related documentation**
4. **Consider breaking large files** during refactoring

## Architecture Decision Guidelines

### When to Create New Patterns
- Existing patterns don't fit the use case
- Pattern will be reused across multiple components
- Clear separation of concerns requires new abstraction

### When to Extend Existing Patterns
- Similar functionality already exists
- Can be composed with existing hooks
- Fits within established domain boundaries

## Quality Metrics to Maintain

### Current Exceptional Metrics
- **Type Coverage**: 100%
- **Test Files**: 745+
- **Large Files**: <2% of codebase
- **No Console Statements**: Clean production code
- **No Security Issues**: Zero vulnerabilities

**Your responsibility**: Maintain or improve these metrics.

---

_This document provides essential context for maintaining the exceptional quality of the Romper codebase. When in doubt, examine existing patterns and maintain consistency._