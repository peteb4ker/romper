# React Component Standards

## Hook-Based Architecture (CRITICAL)

Business logic MUST live in custom hooks, components ONLY render:

```typescript
// ✅ CORRECT: Hook handles logic
function useKitEditor(kitName: string) {
  const [editable, setEditable] = useState(false);
  const toggleEditMode = useCallback(() => setEditable(prev => !prev), []);
  return { editable, toggleEditMode };
}

function KitEditor({ kitName }: Props) {
  const { editable, toggleEditMode } = useKitEditor(kitName);
  return <button onClick={toggleEditMode}>{editable ? 'Save' : 'Edit'}</button>;
}

// ❌ WRONG: Business logic in component
function KitEditor({ kitName }: Props) {
  const [editable, setEditable] = useState(false);
  const handleToggle = async () => {
    // Complex logic here - should be in hook
  };
  return <button onClick={handleToggle}>Edit</button>;
}
```

## Performance Optimization

### Memoization Requirements
```typescript
// ✅ REQUIRED: Memoize components and expensive operations
const KitCard = React.memo(({ kit, onSelect }: KitCardProps) => {
  const displayName = useMemo(() => 
    kit.alias || kit.name, 
    [kit.alias, kit.name]
  );
  
  const handleClick = useCallback(() => {
    onSelect(kit.name);
  }, [kit.name, onSelect]);
  
  return <div onClick={handleClick}>{displayName}</div>;
});

// ❌ WRONG: No memoization for expensive operations
function KitCard({ kit, onSelect }: KitCardProps) {
  // Expensive computation on every render
  const displayName = processKitName(kit);
  
  return <div onClick={() => onSelect(kit.name)}>{displayName}</div>;
}
```

## Component Structure Requirements

### Props and Interfaces
```typescript
// ✅ CORRECT: Clear TypeScript interface, max 5 props
interface KitEditorProps {
  kitName: string;
  editable?: boolean;
  onSave?: (kit: Kit) => void;
}

// ❌ WRONG: Too many props, no interface
function BadComponent(kitName, editable, onSave, onCancel, onDelete, onDuplicate, theme, user) {
  // Too many props - use objects instead
}
```

### Component Size Limits
- **Maximum 350 lines**: Refactor into smaller components when exceeded
- **Single responsibility**: Each component should have one clear purpose
- **Composition over inheritance**: Build complex UIs by combining smaller components

## Anti-Patterns to Avoid

### Business Logic in Components
```typescript
// ❌ AVOID: Complex state management in component
function BadKitEditor() {
  const [samples, setSamples] = useState([]);
  
  // This belongs in a custom hook
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
```

### Direct DOM Manipulation
```typescript
// ❌ AVOID: Direct DOM access
function BadComponent() {
  useEffect(() => {
    document.getElementById('my-element').style.display = 'none';
  }, []);
  
  return <div>...</div>;
}
```

### Missing Keys in Lists
```typescript
// ❌ AVOID: Missing or unstable keys
function BadList({ items }) {
  return (
    <div>
      {items.map((item, index) => (
        <div key={index}>{item.name}</div> // Unstable key
      ))}
    </div>
  );
}

// ✅ CORRECT: Stable, unique keys
function GoodList({ items }) {
  return (
    <div>
      {items.map(item => (
        <div key={item.id}>{item.name}</div>
      ))}
    </div>
  );
}
```

## Quick Validation Checklist

- [ ] Business logic extracted to custom hook
- [ ] Component has TypeScript interface for props
- [ ] Performance optimization with React.memo/useMemo where needed
- [ ] Component under 350 lines
- [ ] Maximum 5 props (use objects for more)
- [ ] Stable keys for list items
- [ ] No direct DOM manipulation
- [ ] No console.log statements
- [ ] Single responsibility principle followed

---

*These standards apply specifically to React .tsx component files. For custom hooks, see `.agent/standards/custom-hooks.md`.*