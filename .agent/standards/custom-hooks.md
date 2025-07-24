# Custom Hooks Standards

## Single Responsibility (CRITICAL)

Each hook handles ONE concern only:

```typescript
// ✅ CORRECT: Single responsibility
function useKitBrowser(localStorePath: string) {
  const [kits, setKits] = useState<Kit[]>([]);
  const [loading, setLoading] = useState(false);

  const refreshKits = useCallback(async () => {
    setLoading(true);
    const result = await window.electronAPI.getAllKits();
    if (result.success) setKits(result.data);
    setLoading(false);
  }, []);

  return { kits, loading, refreshKits };
}

// ❌ WRONG: Multiple responsibilities
function useKitManager() {
  const [kits, setKits] = useState([]); // Browser
  const [editMode, setEditMode] = useState(false); // Editing  
  const [playing, setPlaying] = useState(false); // Audio
  // Split into 3 separate hooks
}
```

## Dependency Injection for Testing

### Testable Hook Design
```typescript
// ✅ CORRECT: Dependency injection for testability
interface KitScanDependencies {
  fileReader?: typeof window.electron.fileReader;
  toast?: typeof toast;
}

function useKitScan(
  localStorePath: string, 
  deps: KitScanDependencies = {}
) {
  const fileReader = deps.fileReader || window.electron.fileReader;
  const toastImpl = deps.toast || toast;
  
  const scanKits = useCallback(async () => {
    try {
      const result = await fileReader.scanDirectory(localStorePath);
      toastImpl.success('Scan completed');
      return result;
    } catch (error) {
      toastImpl.error('Scan failed');
      throw error;
    }
  }, [localStorePath, fileReader, toastImpl]);

  return { scanKits };
}

// ❌ WRONG: Hard-coded dependencies
function badUseKitScan(localStorePath: string) {
  const scanKits = useCallback(async () => {
    // Hard to test - directly uses global dependencies
    const result = await window.electron.fileReader.scanDirectory(localStorePath);
    toast.success('Scan completed'); // Can't mock this
    return result;
  }, [localStorePath]);

  return { scanKits };
}
```

## Error Handling Pattern

### Consistent Result Handling
```typescript
// ✅ CORRECT: Consistent DbResult pattern handling
function useKitEditor(kitName: string) {
  const [kit, setKit] = useState<Kit | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadKit = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    const result = await window.electron.db.getKit(kitName);
    if (result.success) {
      setKit(result.data);
    } else {
      setError(result.error);
    }
    
    setLoading(false);
  }, [kitName]);

  const addSample = useCallback(async (path: string, voice: number, slot: number) => {
    const result = await window.electron.db.addSample(kitName, path, voice, slot);
    if (result.success) {
      // Update local state
      await loadKit(); // Refresh kit data
      return { success: true };
    } else {
      setError(result.error);
      return { success: false, error: result.error };
    }
  }, [kitName, loadKit]);

  return { kit, loading, error, loadKit, addSample };
}
```

## Hook Size and Complexity

### Size Limits
- **Maximum 200 lines**: Refactor when exceeded
- **Maximum 10 return values**: Use objects to group related values
- **Single purpose**: If hook name needs "and", it's doing too much

### Return Object Organization
```typescript
// ✅ CORRECT: Organized return object
function useKitEditor(kitName: string) {
  // ... implementation
  
  return {
    // State
    kit,
    loading,
    error,
    
    // Actions
    loadKit,
    addSample,
    removeSample,
    
    // Computed values
    isEditable: kit?.editable ?? false,
    sampleCount: kit?.samples?.length ?? 0,
  };
}

// ❌ WRONG: Disorganized return
function badUseKitEditor(kitName: string) {
  return {
    kit, addSample, loading, removeSample, error, isEditable, loadKit, sampleCount
    // Hard to understand what's related
  };
}
```

## Performance Considerations

### Proper Dependency Arrays
```typescript
// ✅ CORRECT: Proper dependencies
function useKitProcessor(kitName: string, processingOptions: ProcessingOptions) {
  const processKit = useCallback(async () => {
    // Processing logic
  }, [kitName, processingOptions.format, processingOptions.quality]); // Specific dependencies

  useEffect(() => {
    processKit();
  }, [processKit]);

  return { processKit };
}

// ❌ WRONG: Missing or incorrect dependencies
function badUseKitProcessor(kitName: string, processingOptions: ProcessingOptions) {
  const processKit = useCallback(async () => {
    // Uses processingOptions but doesn't include in deps
  }, [kitName]); // Missing dependencies

  return { processKit };
}
```

## Anti-Patterns to Avoid

### Overly Complex Hooks
```typescript
// ❌ AVOID: Hook doing too many things
function useEverything() {
  // Manages kits
  const [kits, setKits] = useState([]);
  // Manages audio
  const [playing, setPlaying] = useState(false);
  // Manages UI state
  const [modal, setModal] = useState(false);
  // Manages database
  const [syncing, setSyncing] = useState(false);
  
  // Split this into multiple focused hooks
}
```

### State Management Complexity
```typescript
// ❌ AVOID: Complex state logic in hook
function badUseComplexState() {
  const [state, setState] = useState({
    // Complex nested state
    ui: { modal: false, loading: false },
    data: { kits: [], samples: [] },
    audio: { playing: false, volume: 0.5 }
  });
  
  // Better to use multiple focused hooks or a reducer
}
```

## Quick Validation Checklist

- [ ] Hook has single, clear responsibility
- [ ] Dependencies injected for testability
- [ ] Proper dependency arrays in useCallback/useEffect
- [ ] Consistent error handling with DbResult pattern
- [ ] Return object is organized and clear
- [ ] Hook under 200 lines
- [ ] Maximum 10 return values
- [ ] No direct DOM manipulation
- [ ] Pure functions extracted to utils

---

*These standards apply to custom hooks in `**/hooks/use*.ts` files. For React components, see `.agent/standards/react-components.md`.*