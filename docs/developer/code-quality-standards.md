# Code Quality Standards

**Based on**: Architecture audit findings from exceptional codebase patterns
**Date**: 2025-08-09
**Status**: Living Document

## Overview

This document codifies the exceptional code quality patterns observed in the Romper codebase to ensure these standards are maintained and communicated to all developers.

## Type Safety Standards

### TypeScript Requirements

#### ✅ Required Patterns
```typescript
// Proper type definitions for all functions
function addSample(kitName: string, voiceNumber: number): Promise<Result<Sample>>

// Interface definitions for complex objects
interface KitMetadata {
  name: string;
  voiceCount: number;
  samples: Sample[];
}

// Generic types for reusable patterns
type Result<T> = { success: true; data: T } | { success: false; error: string };
```

#### ❌ Prohibited Patterns
```typescript
// Never use 'any' types
function badFunction(data: any): any // FORBIDDEN

// Avoid non-null assertions without justification
const value = maybeUndefined!.property // AVOID

// No untyped external libraries
import someLibrary from 'untyped-lib' // Must add types
```

### Type Coverage
- **Target**: 100% type coverage
- **No `any` types** except for well-documented edge cases
- **Strict TypeScript configuration** must be maintained

## Component Architecture Standards

### React Component Patterns

#### Hook-Based Logic Separation
```typescript
// ✅ CORRECT: Business logic in hooks
function KitEditor({ kitName }: KitEditorProps) {
  const { samples, addSample, removeSample } = useSampleManagement(kitName);
  const { isPlaying, play, stop } = useAudioPlayback();
  
  return (
    <div>
      {/* Pure rendering logic only */}
    </div>
  );
}
```

#### Component Responsibility Boundaries
- **Presentation components**: Only rendering logic and hook calls
- **Custom hooks**: All business logic and state management
- **No direct database calls** in components
- **No complex state derivation** in render functions

### Hook Design Standards

#### Single Responsibility Hooks
```typescript
// ✅ GOOD: Focused responsibility
function useSampleManagement(kitName: string) {
  // Only sample-related operations
}

// ✅ GOOD: Clear domain boundary
function useAudioPlayback() {
  // Only playback controls
}
```

#### Hook Composition
```typescript
// ✅ EXCELLENT: Compose multiple focused hooks
function useKitEditor(kitName: string) {
  const sampleOps = useSampleManagement(kitName);
  const audio = useAudioPlayback();
  const undo = useUndoRedo();
  
  return {
    ...sampleOps,
    ...audio,
    ...undo
  };
}
```

## Database Layer Standards

### Drizzle ORM Patterns

#### Schema Definition
```typescript
// ✅ REQUIRED: Schema-first approach
export const kits = sqliteTable("kits", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  editable: integer("editable", { mode: "boolean" }).notNull().default(false),
});
```

#### Query Patterns
```typescript
// ✅ REQUIRED: Type-safe queries
export async function getKitSamples(kitName: string): Promise<Sample[]> {
  return db.select().from(samples).where(eq(samples.kitName, kitName));
}

// ✅ REQUIRED: Proper error handling
export async function addSample(data: NewSample): Promise<Result<Sample>> {
  try {
    const result = await db.insert(samples).values(data).returning();
    return { success: true, data: result[0] };
  } catch (error) {
    return createErrorResult(error, "Failed to add sample");
  }
}
```

## Testing Standards

### Test Organization

#### Co-located Tests
```
component/
├── KitEditor.tsx
└── __tests__/
    ├── KitEditor.test.tsx           # Unit tests
    ├── KitEditor.integration.test.tsx # Integration tests
    └── KitEditor.dragdrop.test.tsx   # Specific feature tests
```

#### Test Patterns
```typescript
// ✅ REQUIRED: Comprehensive test setup
describe("useSampleManagement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  
  it("handles sample addition with proper error handling", async () => {
    // Test both success and failure cases
  });
  
  it("maintains data consistency on operations", async () => {
    // Test side effects and state consistency
  });
});
```

### Testing Requirements
- **No skipped tests**: All tests must pass
- **Co-located organization**: Tests next to source files
- **Comprehensive mocking**: Centralized mocks for external dependencies
- **Error case coverage**: Test both success and failure paths

## Error Handling Standards

### Centralized Error Utilities

```typescript
// ✅ USE: Standardized error handling
import { createErrorResult, getErrorMessage, logError } from '@/shared/errorUtils';

export async function performOperation(): Promise<Result<Data>> {
  try {
    const data = await operation();
    return { success: true, data };
  } catch (error) {
    logError(error, "performOperation");
    return createErrorResult(error, "Operation failed");
  }
}
```

### Error Handling Requirements
- **Consistent error structure** across all APIs
- **Proper error logging** with context
- **User-friendly error messages** in UI
- **No unhandled promise rejections**

## IPC Communication Standards

### Type-Safe IPC Patterns

#### Preload Bridge
```typescript
// ✅ REQUIRED: Type-safe IPC wrapper
const electronAPI = {
  addSampleToSlot: (kitName: string, voice: number, slot: number, path: string) =>
    ipcRenderer.invoke("add-sample-to-slot", kitName, voice, slot, path),
} as const;

contextBridge.exposeInMainWorld("electronAPI", electronAPI);
```

#### Main Process Handlers
```typescript
// ✅ REQUIRED: Proper async handler
ipcMain.handle("add-sample-to-slot", async (event, kitName, voice, slot, path) => {
  try {
    return await addSampleToSlot(kitName, voice, slot, path);
  } catch (error) {
    logError(error, "IPC:add-sample-to-slot");
    throw error; // Re-throw for renderer error handling
  }
});
```

## Performance Standards

### Component Optimization

#### Memoization Guidelines
```typescript
// ✅ REQUIRED: Memo for expensive calculations
const expensiveValue = useMemo(() => {
  return processLargeSampleData(samples);
}, [samples]);

// ✅ REQUIRED: Callback memoization for child components
const handleSampleAdd = useCallback((sample: Sample) => {
  addSample(sample);
}, [addSample]);
```

### File Size Guidelines
- **Maximum file size**: 400 lines (strictly enforced)
- **Component complexity**: Single responsibility per file
- **Service decomposition**: Break large services into focused modules

## Security Standards

### Input Validation
```typescript
// ✅ REQUIRED: Validate all inputs
function validateWavFile(file: File): ValidationResult {
  if (!file.name.endsWith('.wav')) {
    return { valid: false, error: "Only WAV files are supported" };
  }
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: "File too large" };
  }
  return { valid: true };
}
```

### Path Sanitization
```typescript
// ✅ REQUIRED: Sanitize file paths
import path from 'path';

function sanitizePath(filePath: string): string {
  return path.normalize(path.resolve(filePath));
}
```

## Code Style Guidelines

### Naming Conventions
- **Functions**: Descriptive verbs (`addSample`, `validateInput`)
- **Variables**: Noun phrases (`sampleList`, `isPlaying`)
- **Types**: Pascal case (`SampleData`, `KitMetadata`)
- **Files**: Kebab case (`sample-service.ts`, `kit-editor.tsx`)

### Import Organization
```typescript
// ✅ REQUIRED: Import order
import React from 'react';                    // External libraries
import { Button } from '@/components/ui';     // Internal components
import { useSamples } from './hooks';         // Relative imports
import type { Sample } from '@/types';        // Type imports
```

## Documentation Requirements

### Code Documentation
- **JSDoc comments** for all public APIs
- **Inline comments** for complex business logic
- **README files** for major modules
- **Architecture decision records** for significant changes

### Comment Standards
```typescript
/**
 * Adds a sample to a specific voice slot in a kit
 * 
 * @param kitName - The kit identifier (e.g., "A0", "B5")
 * @param voiceNumber - Voice number (1-4)
 * @param slotIndex - Slot index within voice (0-11)
 * @param filePath - Absolute path to sample file
 * @returns Promise resolving to operation result
 */
export async function addSampleToSlot(
  kitName: string,
  voiceNumber: number,
  slotIndex: number,
  filePath: string
): Promise<Result<Sample>>
```

## Quality Gates

### Pre-commit Requirements
- TypeScript compilation must pass
- ESLint checks must pass
- All tests must pass
- Build must succeed

### Code Review Checklist
- [ ] Type safety maintained (no `any` types)
- [ ] Tests cover new functionality
- [ ] Error handling implemented
- [ ] Documentation updated
- [ ] Performance impact considered
- [ ] Security implications reviewed

## Continuous Improvement

### Regular Audits
- **Monthly**: Code quality metrics review
- **Quarterly**: Architecture audit
- **Annually**: Dependencies and security audit

### Metrics Tracking
- Type coverage percentage
- Test coverage percentage
- Build performance
- Bundle size
- Security vulnerabilities

---

_These standards are derived from patterns observed in the exceptional Romper codebase. Adherence to these patterns ensures maintainability, reliability, and performance._