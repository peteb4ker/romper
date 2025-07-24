# Anti-Patterns to Avoid

## React Anti-Patterns

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
// ❌ AVOID: Direct DOM access in React
function BadComponent() {
  useEffect(() => {
    document.getElementById('my-element').style.display = 'none';
  }, []);
}
```

## TypeScript Anti-Patterns

### Any Types
```typescript
// ❌ AVOID: Using any types
function badFunction(data: any): any {
  return data.someProperty; // No type checking
}

// ✅ CORRECT: Proper typing
function goodFunction(data: Kit): string {
  return data.name; // Type-safe
}
```

### Non-null Assertions Without Good Reason
```typescript
// ❌ AVOID: Unsafe non-null assertions
function badAssertion(kit: Kit | undefined) {
  return kit!.name; // May throw at runtime
}

// ✅ CORRECT: Proper null checking
function goodAssertion(kit: Kit | undefined) {
  return kit?.name ?? 'Unknown';
}
```

## Database Anti-Patterns

### SQL Injection Vulnerabilities
```typescript
// ❌ AVOID: String concatenation
function badQuery(kitName: string) {
  const query = `SELECT * FROM kits WHERE name = '${kitName}'`; // DANGEROUS
  return db.exec(query);
}
```

### N+1 Query Problems
```typescript
// ❌ AVOID: Separate query for each item
const kits = await getAllKits();
for (const kit of kits) {
  kit.samples = await getSamplesForKit(kit.name); // N+1 problem
}
```

## Hook Anti-Patterns

### Multiple Responsibilities
```typescript
// ❌ AVOID: Hook doing too many things
function useEverything() {
  const [kits, setKits] = useState([]);      // Kit management
  const [playing, setPlaying] = useState(false); // Audio control
  const [modal, setModal] = useState(false); // UI state
  // Split into focused hooks
}
```

## Testing Anti-Patterns

### Testing Implementation Details
```typescript
// ❌ AVOID: Testing internal implementation
it('should call useState with correct value', () => {
  const spy = vi.spyOn(React, 'useState');
  render(<Component />);
  expect(spy).toHaveBeenCalledWith(false);
});
```

### Shared Test State
```typescript
// ❌ AVOID: Tests that depend on each other
describe('Bad tests', () => {
  let sharedState = {};
  
  it('first test', () => {
    sharedState.value = 'test1';
  });
  
  it('second test', () => {
    expect(sharedState.value).toBe('test1'); // Depends on first test
  });
});
```

---

*These anti-patterns should be avoided across all Romper development. When you see these patterns, refactor them using the correct approaches from the respective standards files.*