# IPC Error Handling Standards

## Core Principle

IPC methods from preload script are guaranteed available. Don't check if they exist.

## Standard Pattern

```typescript
// ✅ CORRECT: Direct call, validate result
async function loadKit(kitName: string): Promise<DbResult<Kit>> {
  try {
    const result = await window.electronAPI.getKit(kitName);
    return result.success
      ? { success: true, data: result.data }
      : { success: false, error: result.error };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "IPC failed",
    };
  }
}

// ❌ WRONG: Unnecessary availability check
async function badLoadKit(kitName: string) {
  if (!window.electronAPI?.getKit) return; // This will never happen
  const result = await window.electronAPI.getKit?.(kitName); // Optional chaining masks errors
}
```

### Result Validation Pattern

```typescript
// ✅ CORRECT: Always validate IPC result objects
async function updateKit(kitName: string, metadata: Kit) {
  const result = await window.electronAPI.updateKit(kitName, metadata);

  if (!result.success) {
    throw new Error(`Failed to update kit: ${result.error}`);
  }

  return result.data;
}

// ❌ WRONG: Assuming success without validation
async function badUpdateKit(kitName: string, metadata: Kit) {
  const result = await window.electronAPI.updateKit(kitName, metadata);
  return result.data; // May be undefined if result.success is false
}
```

### Hook Integration Pattern

```typescript
// ✅ CORRECT: Clean hook with direct IPC calls
function useKitEditor(kitName: string) {
  const [kit, setKit] = useState<Kit | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadKit = useCallback(async () => {
    try {
      const result = await window.electronAPI.getKit(kitName);

      if (result.success) {
        setKit(result.data);
        setError(null);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load kit");
    }
  }, [kitName]);

  return { kit, error, loadKit };
}

// ❌ WRONG: Over-defensive availability checks
function badUseKitEditor(kitName: string) {
  const loadKit = useCallback(async () => {
    if (!window.electronAPI?.getKit || !kitName) return; // Unnecessary checks

    const result = await window.electronAPI.getKit?.(kitName); // Optional chaining hides errors
    // ... rest of logic
  }, [kitName]);
}
```

## Anti-Patterns to Eliminate

### Optional Chaining on Guaranteed Methods

```typescript
// ❌ ELIMINATE: Optional chaining on guaranteed methods
const files = await window.electronAPI?.listFilesInRoot?.(path);
window.electronAPI?.closeApp?.();
const result = await window.electronAPI?.updateKit?.(kitName, data);

// ✅ CORRECT: Direct calls
const files = await window.electronAPI.listFilesInRoot(path);
window.electronAPI.closeApp();
const result = await window.electronAPI.updateKit(kitName, data);
```

### Redundant Availability Checks

```typescript
// ❌ ELIMINATE: Checking availability of guaranteed methods
if (!window.electronAPI?.getKit) return;
if (!window.electronAPI?.updateKit) return;
if (!window.electronAPI?.updateVoiceAlias) return;

// ✅ CORRECT: Direct usage with error handling
try {
  const metadata = await window.electronAPI.getKit(kitName);
  await window.electronAPI.updateKit(kitName, updates);
  await window.electronAPI.updateVoiceAlias(kitName, voiceNumber, alias);
} catch (error) {
  // Handle actual errors
}
```

### TypeScript Ignores for Typed APIs

```typescript
// ❌ ELIMINATE: @ts-ignore for properly typed APIs
// @ts-ignore
window.electronAPI.onSamplePlaybackEnded?.(handler);

// ✅ CORRECT: Use proper TypeScript definitions
window.electronAPI.onSamplePlaybackEnded(handler);
```

## When Availability Checks ARE Appropriate

### Feature Detection for Optional APIs

```typescript
// ✅ CORRECT: Check for truly optional features
if ("webkitAudioContext" in window) {
  // Use webkit audio context as fallback
}

// ✅ CORRECT: Check for optional electron features
if (window.electronAPI.experimental?.featureX) {
  // Use experimental feature if available
}
```

### Development vs Production Environments

```typescript
// ✅ CORRECT: Environment-specific availability
if (window.electronAPI && process.env.NODE_ENV === "development") {
  window.electronAPI.enableDevTools();
}
```

## Error Message Standards

### Meaningful Error Messages

```typescript
// ✅ CORRECT: Specific, actionable error messages
if (!result.success) {
  switch (result.error) {
    case "KIT_NOT_FOUND":
      throw new Error(`Kit "${kitName}" not found in database`);
    case "INVALID_PATH":
      throw new Error(`Invalid file path: ${filePath}`);
    default:
      throw new Error(`Operation failed: ${result.error}`);
  }
}

// ❌ WRONG: Generic, unhelpful errors
if (!result.success) {
  throw new Error("Something went wrong"); // Not helpful
}
```

## Quick Refactoring Checklist

For existing code with over-defensive IPC handling:

- [ ] Remove availability checks for guaranteed IPC methods
- [ ] Replace optional chaining (`?.`) with direct calls on guaranteed methods
- [ ] Add proper try/catch blocks around IPC calls
- [ ] Always validate `result.success` and handle `result.error`
- [ ] Remove `@ts-ignore` comments where proper types exist
- [ ] Provide specific, actionable error messages
- [ ] Test that refactored code handles actual errors appropriately

## Files Requiring Immediate Attention

**High Priority (Over-defensive patterns):**

- `app/renderer/components/hooks/useKit.ts`
- `app/renderer/components/utils/bankOperations.ts`
- `app/renderer/components/hooks/useKitDetailsLogic.ts`

**Good Examples to Follow:**

- `app/renderer/utils/SettingsContext.tsx`
- `app/renderer/components/hooks/useValidationResults.ts`

---

_These standards eliminate unnecessary defensive programming while maintaining proper error handling for actual failure conditions. IPC methods are guaranteed through the preload script - treat them as such._
