---
layout: default
title: Coding Standards
---

# Romper Coding Standards (Machine-Readable)

This document defines explicit coding standards and best practices for Romper development. It serves as both human-readable documentation and machine-parseable guidelines for automated tools.

## General Principles

### Architecture Philosophy
- **Hook-based architecture**: All business logic in custom hooks, UI components for rendering only
- **Reference-only storage**: Samples referenced by path, not copied locally until sync
- **Type-safe operations**: Use TypeScript strict mode, zero compilation errors
- **Graceful degradation**: App remains functional when non-critical components fail

### Code Quality Requirements
- **TypeScript validation**: `npx tsc --noEmit` must pass before task completion
- **Test coverage**: Maintain 80% minimum coverage across codebase
- **Import statements**: Use ES modules only, never `require()`
- **Zero debug code**: Remove `console.log` statements from production code

## TypeScript Standards

### Type Definitions
```typescript
// ✅ GOOD: Use type inference with Drizzle
export type Kit = InferSelectModel<typeof kitsTable>;
export type NewKit = InferInsertModel<typeof kitsTable>;

// ✅ GOOD: Define clear interfaces for domain objects
interface KitEditorProps {
  kitName: string;
  editable?: boolean;
  onSave?: (kit: Kit) => void;
}

// ❌ BAD: Using any type
const handleData = (data: any) => { ... };

// ❌ BAD: Missing return type annotation for complex functions
function processKitData(kit) { ... }
```

### Enum Patterns
```typescript
// ✅ GOOD: TypeScript enum with Drizzle integration
export enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
  MODERATOR = 'moderator',
}

export const userRoleEnum = pgEnum('user_role', enumToPgEnum(UserRole));

// ❌ BAD: String literals without type safety
const role = 'admin'; // No type checking
```

### Generic Components
```typescript
// ✅ GOOD: Generic component with proper constraints
interface SelectProps<T> {
  items: T[];
  displayKey: keyof T;
  onSelect: (item: T) => void;
}

function Select<T>({ items, displayKey, onSelect }: SelectProps<T>) {
  // Component implementation
}

// ❌ BAD: Non-generic component requiring type assertions
function Select({ items }: { items: any[] }) {
  return items.map(item => <div>{item as string}</div>);
}
```

## React Component Standards

### Component Architecture
```typescript
// ✅ GOOD: Hook-based architecture
function useKitEditor(kitName: string) {
  const [editable, setEditable] = useState(false);
  const [samples, setSamples] = useState<Sample[]>([]);

  const toggleEditMode = useCallback(() => {
    setEditable(prev => !prev);
  }, []);

  return { editable, samples, toggleEditMode };
}

function KitEditor({ kitName }: KitEditorProps) {
  const { editable, samples, toggleEditMode } = useKitEditor(kitName);

  return (
    <div>
      <button onClick={toggleEditMode}>
        {editable ? 'Save' : 'Edit'}
      </button>
    </div>
  );
}

// ❌ BAD: Business logic mixed in component
function KitEditor({ kitName }: KitEditorProps) {
  const [editable, setEditable] = useState(false);

  // Business logic should be in hook
  const handleEdit = () => {
    // Complex business logic here
    setEditable(!editable);
  };

  return <div>...</div>;
}
```

### Performance Optimization
```typescript
// ✅ GOOD: Proper memoization
const KitCard = React.memo(({ kit, onSelect }: KitCardProps) => {
  const displayName = useMemo(() =>
    kit.alias || kit.name, [kit.alias, kit.name]
  );

  const handleClick = useCallback(() => {
    onSelect(kit.name);
  }, [kit.name, onSelect]);

  return <div onClick={handleClick}>{displayName}</div>;
});

// ❌ BAD: No memoization for expensive operations
function KitCard({ kit, onSelect }: KitCardProps) {
  // Expensive computation on every render
  const displayName = processKitName(kit);

  return <div onClick={() => onSelect(kit.name)}>{displayName}</div>;
}
```

### Component Size Limits
- **Maximum 350 lines per component file**
- **Maximum 5 props per component** (use objects for more)
- **Single responsibility**: Each component should have one clear purpose

## Custom Hooks Standards

### Hook Architecture
```typescript
// ✅ GOOD: Focused hook with clear responsibility
function useKitBrowser() {
  const [kits, setKits] = useState<Kit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshKits = useCallback(async () => {
    setLoading(true);
    try {
      const result = await window.electron.db.getAllKits();
      if (result.success) {
        setKits(result.data);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshKits();
  }, [refreshKits]);

  return { kits, loading, error, refreshKits };
}

// ❌ BAD: Hook doing too many things
function useKitManager() {
  // Handles browser logic
  const [kits, setKits] = useState([]);
  // Also handles editing logic
  const [editMode, setEditMode] = useState(false);
  // Also handles audio playback
  const [playing, setPlaying] = useState(false);

  // Too many responsibilities in one hook
  return { kits, editMode, playing, /* ... */ };
}
```

### Dependency Injection for Testing
```typescript
// ✅ GOOD: Dependency injection for testability
interface KitScanDependencies {
  fileReader?: typeof window.electron.fileReader;
  toast?: typeof toast;
}

function useKitScan(deps: KitScanDependencies = {}) {
  const fileReader = deps.fileReader || window.electron.fileReader;
  const toastImpl = deps.toast || toast;

  const scanKits = useCallback(async () => {
    try {
      const result = await fileReader.scanDirectory();
      toastImpl.success('Scan completed');
      return result;
    } catch (error) {
      toastImpl.error('Scan failed');
      throw error;
    }
  }, [fileReader, toastImpl]);

  return { scanKits };
}
```

## Drizzle ORM Standards

### Schema Definition
```typescript
// ✅ GOOD: Modern schema with proper types
export const kitsTable = sqliteTable('kits', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(), // Natural key (A0, B1, etc.)
  alias: text('alias'),
  artist: text('artist'),
  editable: integer('editable', { mode: 'boolean' }).notNull().default(false),
  stepPattern: text('step_pattern'), // JSON format
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const samplesTable = sqliteTable('samples', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  kitName: text('kit_name').notNull().references(() => kitsTable.name),
  voiceNumber: integer('voice_number').notNull().$type<1 | 2 | 3 | 4>(),
  slotNumber: integer('slot_number').notNull().$type<1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12>(),
  sourcePath: text('source_path').notNull(), // Reference-only architecture
  filename: text('filename').notNull(),
  isStereo: integer('is_stereo', { mode: 'boolean' }).notNull().default(false),
});

// ❌ BAD: Missing constraints and proper types
export const badTable = sqliteTable('bad_table', {
  id: integer('id'),
  data: text('data'), // No constraints
  // Missing timestamps, references, etc.
});
```

### Query Patterns
```typescript
// ✅ GOOD: Type-safe queries with error handling
async function getKitWithSamples(kitName: string): Promise<DbResult<Kit & { samples: Sample[] }>> {
  return withDb((db) => {
    const kit = db
      .select()
      .from(kitsTable)
      .where(eq(kitsTable.name, kitName))
      .get();

    if (!kit) {
      return { success: false, error: `Kit not found: ${kitName}` };
    }

    const samples = db
      .select()
      .from(samplesTable)
      .where(eq(samplesTable.kitName, kitName))
      .orderBy(samplesTable.voiceNumber, samplesTable.slotNumber)
      .all();

    return { success: true, data: { ...kit, samples } };
  });
}

// ❌ BAD: Raw SQL without type safety
async function badGetKit(kitName: string) {
  const query = `SELECT * FROM kits WHERE name = '${kitName}'`; // SQL injection risk
  return db.exec(query); // No type safety
}
```

### Connection Management
```typescript
// ✅ GOOD: Connection wrapper with proper cleanup
function withDb<T>(operation: (db: BetterSQLite3Database) => T): T {
  const db = getDatabase();
  try {
    return operation(db);
  } catch (error) {
    logger.error('Database operation failed:', error);
    throw error;
  }
  // SQLite connections are automatically managed
}

// ❌ BAD: Direct database access without error handling
function badOperation() {
  const db = getDatabase();
  return db.select().from(kitsTable).all(); // No error handling
}
```

## Testing Standards

### Test Organization
```typescript
// ✅ GOOD: Well-organized test with setup/teardown
describe('useKitEditor', () => {
  let mockDb: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockDb = vi.fn();
    vi.mocked(window.electron.db).mockReturnValue(mockDb);
  });

  afterEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  describe('when kit is editable', () => {
    it('should allow adding samples', async () => {
      const mockKit = { name: 'A0', editable: true };
      mockDb.getKit = vi.fn().mockResolvedValue({ success: true, data: mockKit });

      const { result } = renderHook(() => useKitEditor('A0'));

      await act(async () => {
        await result.current.addSample('/path/to/sample.wav', 1, 1);
      });

      expect(mockDb.addSample).toHaveBeenCalledWith('A0', '/path/to/sample.wav', 1, 1);
    });
  });

  describe('error handling', () => {
    it('should handle database errors gracefully', async () => {
      mockDb.getKit = vi.fn().mockResolvedValue({
        success: false,
        error: 'Database error'
      });

      const { result } = renderHook(() => useKitEditor('A0'));

      expect(result.current.error).toBe('Database error');
    });
  });
});

// ❌ BAD: Poor test organization
test('kit editor works', () => {
  // Test does too many things
  // No proper setup/teardown
  // Unclear expectations
});
```

### Mock Patterns
```typescript
// ✅ GOOD: Centralized mock setup (vitest.setup.ts)
vi.mock('../electron/main/db/romperDbCore', () => ({
  getKit: vi.fn(),
  addSample: vi.fn(),
  updateKit: vi.fn(),
}));

// ✅ GOOD: Test-specific mock overrides
it('should handle missing kit', () => {
  vi.mocked(getKit).mockResolvedValue({
    success: false,
    error: 'Kit not found'
  });

  // Test implementation
});

// ❌ BAD: Inline mocks without proper typing
test('bad mock', () => {
  (global as any).electron = { db: { getKit: () => null } };
});
```

## File Organization Standards

### Directory Structure
```
app/renderer/components/
├── ComponentName.tsx              # UI component (rendering only)
├── hooks/
│   ├── useComponentName.ts        # Business logic hook
│   └── __tests__/
│       └── useComponentName.test.ts
├── utils/
│   ├── componentUtils.ts          # Pure utility functions
│   └── __tests__/
│       └── componentUtils.test.ts
└── __tests__/
    └── ComponentName.test.tsx     # Component integration tests
```

### Import Organization
```typescript
// ✅ GOOD: Consistent import order
// 1. React imports first
import React, { useCallback, useEffect, useState } from 'react';

// 2. Third-party libraries
import { toast } from 'sonner';
import { clsx } from 'clsx';

// 3. Internal utilities and hooks (relative paths)
import { useKitBrowser } from './hooks/useKitBrowser';
import { validateKitSlot } from '../utils/kitOperations';

// 4. Shared utilities (absolute paths from shared/)
import { toCapitalCase } from '../../../../shared/kitUtilsShared';
import type { Kit, Sample } from '../../../../shared/types';

// ❌ BAD: Mixed import order
import { useKitBrowser } from './hooks/useKitBrowser';
import React from 'react';
import type { Kit } from '../../../../shared/types';
import { toast } from 'sonner';
```

### Naming Conventions
- **Components**: PascalCase (`KitEditor`, `SampleBrowser`)
- **Hooks**: camelCase with `use` prefix (`useKitEditor`, `useAudioPlayer`)
- **Utilities**: camelCase (`validateKitSlot`, `formatDuration`)
- **Constants**: SCREAMING_SNAKE_CASE (`MAX_SAMPLES_PER_VOICE`)
- **Types/Interfaces**: PascalCase (`Kit`, `KitEditorProps`)

## Error Handling Standards

### Result Pattern
```typescript
// ✅ GOOD: Consistent result wrapper
type DbResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

async function getKit(kitName: string): Promise<DbResult<Kit>> {
  try {
    const kit = await db.select().from(kitsTable)
      .where(eq(kitsTable.name, kitName))
      .get();

    if (!kit) {
      return { success: false, error: `Kit not found: ${kitName}` };
    }

    return { success: true, data: kit };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// ❌ BAD: Inconsistent error handling
async function badGetKit(kitName: string) {
  const kit = await db.select().from(kitsTable).get(); // May throw
  return kit || null; // Inconsistent return type
}
```

### User-Facing Error Messages
```typescript
// ✅ GOOD: User-friendly error messages
function handleKitLoadError(error: string) {
  const userMessage = error.includes('ENOENT')
    ? 'Kit file not found. Please check if the SD card is properly connected.'
    : error.includes('EACCES')
    ? 'Permission denied. Please check file permissions and try again.'
    : 'Unable to load kit. Please try again or contact support.';

  toast.error(userMessage);
}

// ❌ BAD: Raw error messages exposed to user
function badErrorHandler(error: string) {
  toast.error(error); // May show technical details to user
}
```

## Performance Standards

### React Performance
```typescript
// ✅ GOOD: Proper memoization
const KitList = React.memo(({ kits, onSelect }: KitListProps) => {
  const sortedKits = useMemo(() =>
    kits.sort((a, b) => a.name.localeCompare(b.name)),
    [kits]
  );

  return (
    <div>
      {sortedKits.map(kit => (
        <KitCard key={kit.name} kit={kit} onSelect={onSelect} />
      ))}
    </div>
  );
});

// ❌ BAD: No memoization for expensive operations
function BadKitList({ kits, onSelect }: KitListProps) {
  // Expensive sort on every render
  const sortedKits = kits.sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div>
      {sortedKits.map(kit => (
        <div key={kit.name} onClick={() => onSelect(kit)}>
          {kit.name}
        </div>
      ))}
    </div>
  );
}
```

### Database Performance
```typescript
// ✅ GOOD: Efficient batch operations
async function addMultipleSamples(
  kitName: string,
  samples: Array<{ path: string; voice: number; slot: number }>
): Promise<DbResult<void>> {
  return withDb((db) => {
    return db.transaction(() => {
      for (const sample of samples) {
        db.insert(samplesTable).values({
          kitName,
          sourcePath: sample.path,
          filename: path.basename(sample.path),
          voiceNumber: sample.voice,
          slotNumber: sample.slot,
        }).run();
      }
    });
  });
}

// ❌ BAD: Individual operations instead of batch
async function badAddSamples(samples: Sample[]) {
  for (const sample of samples) {
    await db.insert(samplesTable).values(sample).run(); // Separate transactions
  }
}
```

## Security Standards

### Path Validation
```typescript
// ✅ GOOD: Path validation to prevent directory traversal
import path from 'path';

function validateSamplePath(sourcePath: string, allowedBasePaths: string[]): boolean {
  const resolvedPath = path.resolve(sourcePath);

  // Check if path is within allowed directories
  const isAllowed = allowedBasePaths.some(basePath =>
    resolvedPath.startsWith(path.resolve(basePath))
  );

  // Additional validation
  const isWavFile = path.extname(resolvedPath).toLowerCase() === '.wav';
  const hasValidChars = !/[<>:"|?*]/.test(resolvedPath);

  return isAllowed && isWavFile && hasValidChars;
}

// ❌ BAD: No path validation
function badValidation(sourcePath: string): boolean {
  return sourcePath.endsWith('.wav'); // Insufficient validation
}
```

### Input Sanitization
```typescript
// ✅ GOOD: Proper input sanitization
function sanitizeKitName(input: string): string {
  return input
    .trim()
    .replace(/[^A-Z0-9]/gi, '') // Remove non-alphanumeric
    .toUpperCase()
    .slice(0, 3); // Limit length for kit names like A0, B12
}

// ❌ BAD: No input sanitization
function badSanitize(input: string): string {
  return input; // Raw user input used directly
}
```

## Anti-Patterns to Avoid

### React Anti-Patterns
```typescript
// ❌ AVOID: Business logic in components
function BadKitEditor() {
  const [samples, setSamples] = useState([]);

  // Anti-pattern: Complex business logic in component
  const handleAddSample = async (file: File) => {
    const validation = validateWavFile(file);
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }

    const converted = await convertToRampleFormat(file);
    setSamples(prev => [...prev, converted]);
    await saveToDatabase(converted);
  };

  return <div>...</div>;
}

// ❌ AVOID: Too many props
interface BadProps {
  prop1: string;
  prop2: number;
  prop3: boolean;
  prop4: string[];
  prop5: (val: string) => void;
  prop6: Date;
  // Too many props - use objects instead
}

// ❌ AVOID: Direct DOM manipulation
function BadComponent() {
  useEffect(() => {
    document.getElementById('my-element').style.display = 'none'; // Direct DOM access
  }, []);
}
```

### TypeScript Anti-Patterns
```typescript
// ❌ AVOID: Any types
function badFunction(data: any): any {
  return data.someProperty; // No type checking
}

// ❌ AVOID: Non-null assertions without good reason
function badAssertion(kit: Kit | undefined) {
  return kit!.name; // May throw at runtime
}

// ❌ AVOID: Type assertions instead of proper typing
function badAssertion2(data: unknown) {
  return (data as Kit).name; // Unsafe type assertion
}
```

### Database Anti-Patterns
```typescript
// ❌ AVOID: SQL injection vulnerabilities
function badQuery(kitName: string) {
  const query = `SELECT * FROM kits WHERE name = '${kitName}'`; // SQL injection risk
  return db.exec(query);
}

// ❌ AVOID: Missing error handling
function badDbOperation() {
  return db.select().from(kitsTable).all(); // May throw without handling
}

// ❌ AVOID: N+1 queries
async function badGetKitsWithSamples() {
  const kits = await db.select().from(kitsTable).all();

  for (const kit of kits) {
    // N+1 query problem
    kit.samples = await db.select().from(samplesTable)
      .where(eq(samplesTable.kitName, kit.name)).all();
  }

  return kits;
}
```

## Tool Integration

### ESLint Configuration
```json
{
  "extends": [
    "@typescript-eslint/recommended",
    "@typescript-eslint/recommended-requiring-type-checking"
  ],
  "rules": {
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/no-unused-vars": "warn",
    "react-hooks/exhaustive-deps": "error",
    "react/jsx-key": "error",
    "no-console": "warn"
  }
}
```

### Pre-commit Hooks
```bash
#!/bin/sh
# Pre-commit hook to enforce standards

# TypeScript validation
npx tsc --noEmit
if [ $? -ne 0 ]; then
  echo "TypeScript validation failed"
  exit 1
fi

# Run tests
npm test
if [ $? -ne 0 ]; then
  echo "Tests failed"
  exit 1
fi

# Lint check
npm run lint
if [ $? -ne 0 ]; then
  echo "Linting failed"
  exit 1
fi
```

---

*These standards ensure consistent, maintainable, and high-quality code across the Romper codebase. All patterns are based on analysis of existing code, industry best practices, and specific requirements of the Romper architecture.*