# React Component Standards

## Component Architecture

**Hook-based separation**: Business logic in custom hooks, UI components for rendering only.

```typescript
// ✅ GOOD: Separated concerns
function useKitEditor(kitName: string) {
  const [editable, setEditable] = useState(false);
  const toggleEditMode = useCallback(() => setEditable(prev => !prev), []);
  return { editable, toggleEditMode };
}

function KitEditor({ kitName }: Props) {
  const { editable, toggleEditMode } = useKitEditor(kitName);
  return <button onClick={toggleEditMode}>{editable ? 'Save' : 'Edit'}</button>;
}

// ❌ BAD: Business logic mixed in component
function KitEditor({ kitName }: Props) {
  const [editable, setEditable] = useState(false);
  const handleEdit = () => { /* complex logic here */ };
  return <div>...</div>;
}
```

## Performance Optimization

Use `React.memo`, `useMemo`, and `useCallback` for expensive operations.

```typescript
// ✅ GOOD: Proper memoization
const KitCard = React.memo(({ kit, onSelect }: Props) => {
  const displayName = useMemo(() =>
    kit.alias || kit.name, [kit.alias, kit.name]
  );

  const handleClick = useCallback(() => {
    onSelect(kit.name);
  }, [kit.name, onSelect]);

  return <div onClick={handleClick}>{displayName}</div>;
});

// ❌ BAD: No memoization for expensive operations
function KitCard({ kit, onSelect }: Props) {
  const displayName = processKitName(kit); // Expensive on every render
  return <div onClick={() => onSelect(kit.name)}>{displayName}</div>;
}
```

## Component Size Limits

- **Maximum 400 lines per component file**
- **Maximum 5 props per component** (use objects for more)
- **Single responsibility**: Each component should have one clear purpose

## Key Anti-Patterns to Avoid

```typescript
// ❌ AVOID: Too many props
interface BadProps {
  prop1: string;
  prop2: number;
  prop3: boolean;
  prop4: string[];
  prop5: (val: string) => void;
  prop6: Date;
  // Use objects instead: config: { prop1: string; prop2: number; ... }
}

// ❌ AVOID: Direct DOM manipulation
function BadComponent() {
  useEffect(() => {
    document.getElementById("my-element").style.display = "none";
  }, []);
}

// ❌ AVOID: Business logic in components
function BadComponent() {
  const handleSubmit = async () => {
    const validation = validateData(data);
    const result = await saveToDatabase(data);
    // Move to custom hook
  };
}
```

## Quick Validation Checklist

- [ ] Business logic extracted to custom hooks
- [ ] Component under 400 lines
- [ ] Maximum 5 props (use objects if more needed)
- [ ] Expensive operations memoized with `useMemo`/`useCallback`
- [ ] Component wrapped with `React.memo` if props change frequently
- [ ] No direct DOM manipulation
- [ ] Single responsibility maintained
- [ ] TypeScript strict mode passes (`npx tsc --noEmit`)
