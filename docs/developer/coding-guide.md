---
layout: default
title: Coding Guide
---

# Romper Coding Guide (Human-Readable)

This guide provides friendly, practical advice for writing quality code in the Romper project. For detailed, machine-readable standards, see [coding-standards.md](./coding-standards.md).

## 🎯 Core Philosophy

### The Romper Way
Romper follows a **hook-based architecture** where React components focus purely on rendering while custom hooks handle all business logic. This keeps our code organized, testable, and maintainable.

Think of it like this:
- **Components** = The user interface (what users see and interact with)
- **Hooks** = The business logic (how things work behind the scenes)
- **Utils** = Pure functions that transform data

### Reference-Only Architecture
One unique aspect of Romper is our **reference-only sample management**. Instead of copying files around, we store absolute paths to samples and only copy them when syncing to the SD card. This keeps the local store clean and prevents storage bloat.

## 🛠️ Getting Started

### Before You Code
Always run these commands before starting work:
```bash
# Check that TypeScript is happy
npx tsc --noEmit

# Run tests to make sure nothing is broken
npm test

# Start development server
npm run dev
```

### The Golden Rule
**Never commit code that doesn't pass `npx tsc --noEmit`**. TypeScript errors must be fixed before any task is considered complete.

## 📝 Writing Components

### Keep It Simple
Components should be focused on rendering. If you find yourself writing complex logic inside a component, it probably belongs in a custom hook.

```typescript
// ✅ Good: Clean component with hook
function KitEditor({ kitName }: Props) {
  const { editable, samples, toggleEditMode, addSample } = useKitEditor(kitName);
  
  return (
    <div className="kit-editor">
      <button onClick={toggleEditMode}>
        {editable ? 'Save Changes' : 'Edit Kit'}
      </button>
      {samples.map(sample => (
        <SampleSlot key={sample.id} sample={sample} />
      ))}
    </div>
  );
}

// ❌ Not so good: Business logic mixed in
function KitEditor({ kitName }: Props) {
  const [editable, setEditable] = useState(false);
  
  const handleToggle = async () => {
    // Lots of complex logic here
    const result = await window.electron.db.updateKit(kitName, { editable: !editable });
    if (result.success) {
      setEditable(!editable);
      toast.success('Kit updated');
    } else {
      toast.error(result.error);
    }
  };
  
  return <div>...</div>;
}
```

### Performance Matters
Use `React.memo`, `useMemo`, and `useCallback` to keep the UI snappy. Romper aims for sub-50ms response times for all user interactions.

```typescript
// ✅ Good: Memoized component
const KitCard = React.memo(({ kit, onSelect }: Props) => {
  const displayName = useMemo(() => 
    kit.alias || kit.name, 
    [kit.alias, kit.name]
  );
  
  const handleClick = useCallback(() => {
    onSelect(kit.name);
  }, [kit.name, onSelect]);
  
  return <div onClick={handleClick}>{displayName}</div>;
});
```

## 🎣 Writing Hooks

### Single Responsibility
Each hook should have one clear job. If your hook is doing too many things, split it up.

```typescript
// ✅ Good: Focused on kit browsing only
function useKitBrowser() {
  const [kits, setKits] = useState<Kit[]>([]);
  const [loading, setLoading] = useState(false);
  
  const refreshKits = useCallback(async () => {
    setLoading(true);
    const result = await window.electron.db.getAllKits();
    // Handle result...
    setLoading(false);
  }, []);
  
  return { kits, loading, refreshKits };
}

// ❌ Not so good: Hook doing too many things
function useKitManager() {
  // Handles browsing
  const [kits, setKits] = useState([]);
  // Also handles editing
  const [editMode, setEditMode] = useState(false);
  // Also handles audio playback
  const [playing, setPlaying] = useState(false);
  
  // This hook has too many responsibilities
}
```

### Make Hooks Testable
Use dependency injection to make your hooks easy to test:

```typescript
interface Dependencies {
  fileReader?: typeof window.electron.fileReader;
  toast?: typeof toast;
}

function useKitScan(deps: Dependencies = {}) {
  const fileReader = deps.fileReader || window.electron.fileReader;
  const toastImpl = deps.toast || toast;
  
  // Backend handles localStorePath from settings automatically
  // Now this hook can be easily tested with mocked dependencies
}
```

## 🗄️ Working with the Database

### The Result Pattern
All database operations return a consistent `DbResult<T>` type that makes error handling predictable:

```typescript
type DbResult<T> = 
  | { success: true; data: T }
  | { success: false; error: string };

// Using the pattern
const result = await window.electron.db.getKit('A0');
if (result.success) {
  console.log('Kit loaded:', result.data);
} else {
  toast.error(result.error);
}
```

### Drizzle ORM Guidelines
We use Drizzle ORM with the synchronous better-sqlite3 driver. Key points:

- **Always call terminal methods**: `.all()`, `.get()`, `.run()`, `.values()`
- **Don't use `await`**: The driver is synchronous
- **Use type inference**: Let Drizzle generate types from your schema

```typescript
// ✅ Good: Proper Drizzle usage
const kits = db.select()
  .from(kitsTable)
  .where(eq(kitsTable.editable, true))
  .all(); // Terminal method required

// ❌ Bad: Missing terminal method
const kits = db.select()
  .from(kitsTable)
  .where(eq(kitsTable.editable, true)); // This won't work
```

## 🧪 Writing Tests

### Test Organization
Each code file should have exactly one corresponding test file in a `__tests__` directory:

```
app/renderer/components/
├── KitEditor.tsx
├── hooks/
│   ├── useKitEditor.ts
│   └── __tests__/
│       └── useKitEditor.test.ts
└── __tests__/
    └── KitEditor.test.tsx
```

### Make Tests Clear
Write tests that read like documentation:

```typescript
describe('useKitEditor', () => {
  describe('when kit is editable', () => {
    it('should allow adding samples to voice slots', async () => {
      // Arrange
      const mockKit = { name: 'A0', editable: true };
      mockGetKit.mockResolvedValue({ success: true, data: mockKit });
      
      // Act
      const { result } = renderHook(() => useKitEditor('A0'));
      await act(async () => {
        await result.current.addSample('/path/to/kick.wav', 1, 1);
      });
      
      // Assert
      expect(mockAddSample).toHaveBeenCalledWith('A0', '/path/to/kick.wav', 1, 1);
    });
  });
});
```

### Mock Smart, Not Hard
Use the centralized mocks in `vitest.setup.ts` and extend them as needed:

```typescript
// In your test file
beforeEach(() => {
  // Extend the global mock for this test
  vi.mocked(window.electron.db.getKit).mockResolvedValue({
    success: true,
    data: { name: 'A0', editable: true }
  });
});
```

## 🎨 Code Style

### TypeScript Tips
- **Use type inference**: Let TypeScript figure out types when it can
- **Define clear interfaces**: Especially for component props and API responses
- **Avoid `any`**: There's almost always a better type to use

```typescript
// ✅ Good: Clear interface
interface KitEditorProps {
  kitName: string;
  editable?: boolean;
  onSave?: (kit: Kit) => void;
}

// ✅ Good: Type inference
const [kits, setKits] = useState<Kit[]>([]); // Type is inferred from array

// ❌ Avoid: Using any
const handleData = (data: any) => { ... };
```

### Import Organization
Keep imports organized for readability:

```typescript
// 1. React first
import React, { useCallback, useState } from 'react';

// 2. Third-party libraries
import { toast } from 'sonner';

// 3. Local imports (relative paths)
import { useKitBrowser } from './hooks/useKitBrowser';

// 4. Shared utilities (absolute paths from shared/)
import { toCapitalCase } from '../../../../shared/kitUtilsShared';
```

## 🚫 Common Pitfalls to Avoid

### React Pitfalls
- **Don't put business logic in components** - Use custom hooks instead
- **Don't forget to memoize expensive operations** - Use `useMemo` for computations
- **Don't create new objects in render** - Use `useCallback` and `useMemo`

### TypeScript Pitfalls
- **Don't use `any`** - There's usually a better type
- **Don't ignore TypeScript errors** - Fix them before committing
- **Don't use type assertions unless necessary** - Prefer proper typing

### Database Pitfalls
- **Don't forget terminal methods** - `.all()`, `.get()`, `.run()`, `.values()`
- **Don't use `await` with synchronous driver** - Drizzle with better-sqlite3 is sync
- **Don't create N+1 queries** - Use joins or batch operations

### Testing Pitfalls  
- **Don't test implementation details** - Test behavior, not internals
- **Don't forget to clean up mocks** - Use `beforeEach`/`afterEach`
- **Don't make tests too complex** - One behavior per test

## 🔒 Security & Safety

### File Path Validation
Always validate file paths to prevent directory traversal attacks:

```typescript
function validateSamplePath(sourcePath: string): boolean {
  const resolvedPath = path.resolve(sourcePath);
  
  // Check if it's a WAV file
  const isWav = path.extname(resolvedPath).toLowerCase() === '.wav';
  
  // Check for suspicious characters
  const isSafe = !/[<>:"|?*]/.test(resolvedPath);
  
  return isWav && isSafe;
}
```

### Error Messages
Show user-friendly error messages, not technical details:

```typescript
// ✅ Good: User-friendly message
if (error.includes('ENOENT')) {
  toast.error('Sample file not found. Please check if the file still exists.');
} else {
  toast.error('Unable to load sample. Please try again.');
}

// ❌ Not so good: Technical error exposed
toast.error(error.message); // May show technical details
```

## 📚 Learning Resources

### Understanding the Codebase
- **Start with the hooks** - Look at `useKitBrowser` and `useKitEditor`
- **Check the database layer** - See how `romperDbCore` works
- **Read the tests** - They show how things are supposed to work

### Getting Help
- **Check existing patterns** - Look for similar code in the codebase
- **Read the PRD** - Understanding the requirements helps with implementation
- **Ask questions** - Use GitHub Discussions for clarification

## 🎯 Quality Checklist

Before submitting code, make sure:

- [ ] `npx tsc --noEmit` passes without errors
- [ ] Tests pass with `npm test`
- [ ] Components use hooks for business logic
- [ ] Database operations use the `DbResult<T>` pattern
- [ ] Error handling is user-friendly
- [ ] Performance optimizations are in place (memoization)
- [ ] File paths are validated for security
- [ ] Tests cover both happy path and error cases
- [ ] Imports are organized consistently
- [ ] No `console.log` statements in production code

Remember: Quality code is code that's easy to understand, maintain, and extend. When in doubt, favor simplicity and clarity over cleverness!

---

*This guide reflects the patterns and practices that make Romper maintainable and enjoyable to work on. When you see code that doesn't follow these patterns, consider it an opportunity for improvement!*