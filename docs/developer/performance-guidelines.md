---
title: "Performance Guidelines"
owners: ["developer-team"]
last_reviewed: "2025-08-15"
tags: ["developer"]
---

---
title: "Performance Guidelines"
owners: ["developer-team"]
last_reviewed: "2025-08-15"
tags: ["developer"]
---

# Performance Guidelines

**Based on**: Architecture audit findings and observed optimization patterns
**Date**: 2025-08-09
**Target**: Sub-50ms UI interaction response time

## Current Performance Characteristics

### Measured Performance Strengths
- **Memoized React components** where appropriate
- **Prepared database statements** via Drizzle ORM
- **Batch database operations** for bulk changes
- **Lazy loading** of component data
- **Efficient IPC communication** with minimal serialization overhead

### Performance Targets
- **UI Response Time**: <50ms for all interactions
- **Kit Loading**: <100ms for kit metadata
- **Sample Preview**: <200ms for audio playback start
- **Database Operations**: <10ms for single queries
- **SD Card Sync**: <1 second per kit (target)

## File Size and Code Organization

### Critical File Size Limits

**Current Large Files Requiring Decomposition**:
```
electron/main/services/sampleService.ts    961 lines  ⚠️  PRIORITY
electron/main/services/syncService.ts      899 lines  ⚠️  PRIORITY  
electron/preload/index.ts                  582 lines  ⚠️  MEDIUM
electron/main/db/operations/crudOperations.ts  473 lines  ⚠️  MEDIUM
```

### Performance Impact of Large Files
- **Slower TypeScript compilation** times
- **Increased memory usage** during development
- **Harder to tree-shake** unused code
- **Poor IDE responsiveness** with large files open

### Decomposition Strategy
```typescript
// ❌ AVOID: One large service (961 lines)
class SampleService {
  validateSample() { /* 50 lines */ }
  convertFormat() { /* 80 lines */ }
  processAudio() { /* 120 lines */ }
  handleMetadata() { /* 90 lines */ }
  // ... 600+ more lines
}

// ✅ RECOMMENDED: Focused modules
// sample-validation.ts (50 lines)
export function validateSample(file: File): ValidationResult

// sample-conversion.ts (80 lines)  
export function convertToRampleFormat(sample: Sample): Promise<ConvertedSample>

// sample-processing.ts (120 lines)
export function processAudioFile(path: string): Promise<AudioData>

// sample-metadata.ts (90 lines)
export function extractMetadata(file: File): SampleMetadata
```

## React Component Performance

### Memoization Strategies

#### Component Memoization
```typescript
// ✅ RECOMMENDED: Memo for expensive render components
const KitCard = React.memo(({ kit, onSelect }: KitCardProps) => {
  // Expensive rendering logic
  return <div>...</div>;
});

// ✅ RECOMMENDED: Memo comparison for complex props
const SampleSlot = React.memo(({ sample, metadata }: SlotProps) => {
  return <div>...</div>;
}, (prevProps, nextProps) => {
  return prevProps.sample.id === nextProps.sample.id &&
         prevProps.metadata.version === nextProps.metadata.version;
});
```

#### Hook Memoization
```typescript
// ✅ RECOMMENDED: Memoize expensive calculations
function useSampleMetadata(samples: Sample[]) {
  const aggregatedData = useMemo(() => {
    return samples.reduce((acc, sample) => {
      // Expensive processing
      return processMetadata(acc, sample);
    }, initialValue);
  }, [samples]);
  
  return aggregatedData;
}

// ✅ RECOMMENDED: Memoize callback props
function useKitActions(kitName: string) {
  const addSample = useCallback((sample: Sample) => {
    // Database operation
    return addSampleToKit(kitName, sample);
  }, [kitName]);
  
  return { addSample };
}
```

### Component Optimization Patterns

#### Avoid Inline Objects
```typescript
// ❌ AVOID: Inline objects cause re-renders
function Component() {
  return <Child style={{ margin: 10 }} data={{ value: 1 }} />;
}

// ✅ RECOMMENDED: Memoize or extract objects
const CHILD_STYLE = { margin: 10 };
const CHILD_DATA = { value: 1 };

function Component() {
  return <Child style={CHILD_STYLE} data={CHILD_DATA} />;
}
```

#### Virtualization for Large Lists
```typescript
// ✅ RECOMMENDED: Use react-window for large kit lists
import { FixedSizeList as List } from 'react-window';

function KitBrowser({ kits }: { kits: Kit[] }) {
  const Row = ({ index, style }: { index: number; style: CSSProperties }) => (
    <div style={style}>
      <KitCard kit={kits[index]} />
    </div>
  );
  
  return (
    <List
      height={600}
      itemCount={kits.length}
      itemSize={120}
      itemData={kits}
    >
      {Row}
    </List>
  );
}
```

## Database Performance

### Query Optimization

#### Use Prepared Statements
```typescript
// ✅ EXCELLENT: Drizzle automatically uses prepared statements
const getKitSamplesQuery = db
  .select()
  .from(samples)
  .where(eq(samples.kitName, placeholder("kitName")))
  .prepare();

export function getKitSamples(kitName: string) {
  return getKitSamplesQuery.execute({ kitName });
}
```

#### Batch Operations
```typescript
// ✅ RECOMMENDED: Batch inserts
export async function addMultipleSamples(sampleData: NewSample[]) {
  return db.transaction(async (tx) => {
    for (const sample of sampleData) {
      await tx.insert(samples).values(sample);
    }
  });
}

// ✅ RECOMMENDED: Bulk updates
export async function updateKitMetadata(updates: KitUpdate[]) {
  return db.transaction(async (tx) => {
    await Promise.all(
      updates.map(update => 
        tx.update(kits).set(update.data).where(eq(kits.id, update.id))
      )
    );
  });
}
```

#### Query Result Caching
```typescript
// ✅ RECOMMENDED: Cache expensive queries
const kitMetadataCache = new Map<string, KitMetadata>();

export async function getCachedKitMetadata(kitName: string) {
  if (kitMetadataCache.has(kitName)) {
    return kitMetadataCache.get(kitName)!;
  }
  
  const metadata = await computeKitMetadata(kitName);
  kitMetadataCache.set(kitName, metadata);
  return metadata;
}
```

## IPC Performance

### Efficient IPC Communication

#### Minimize Data Transfer
```typescript
// ❌ AVOID: Sending large objects over IPC
ipcRenderer.invoke('process-samples', { samples, metadata, config });

// ✅ RECOMMENDED: Send only necessary data
ipcRenderer.invoke('process-samples', { 
  sampleIds: samples.map(s => s.id),
  configId: config.id 
});
```

#### Batch IPC Operations
```typescript
// ❌ AVOID: Multiple IPC calls
for (const sample of samples) {
  await ipcRenderer.invoke('add-sample', sample);
}

// ✅ RECOMMENDED: Single batch operation
await ipcRenderer.invoke('add-samples-batch', samples);
```

## Audio Performance

### Sample Processing Optimization

#### Lazy Audio Loading
```typescript
// ✅ RECOMMENDED: Load audio on demand
function useSampleAudio(samplePath: string) {
  const [audioData, setAudioData] = useState<AudioData | null>(null);
  
  const loadAudio = useCallback(async () => {
    if (!audioData && samplePath) {
      const data = await loadAudioFile(samplePath);
      setAudioData(data);
    }
  }, [samplePath, audioData]);
  
  return { audioData, loadAudio };
}
```

#### Audio Buffer Management
```typescript
// ✅ RECOMMENDED: Reuse audio contexts
class AudioManager {
  private static context: AudioContext;
  private bufferCache = new Map<string, AudioBuffer>();
  
  static getContext() {
    if (!AudioManager.context) {
      AudioManager.context = new AudioContext();
    }
    return AudioManager.context;
  }
  
  async getBuffer(samplePath: string): Promise<AudioBuffer> {
    if (this.bufferCache.has(samplePath)) {
      return this.bufferCache.get(samplePath)!;
    }
    
    const buffer = await this.loadAndDecodeAudio(samplePath);
    this.bufferCache.set(samplePath, buffer);
    return buffer;
  }
}
```

## Bundle Size Optimization

### Code Splitting Strategies

#### Dynamic Imports
```typescript
// ✅ RECOMMENDED: Lazy load heavy components
const WaveformVisualization = lazy(() => import('./WaveformVisualization'));

function SampleEditor() {
  return (
    <Suspense fallback={<div>Loading waveform...</div>}>
      <WaveformVisualization />
    </Suspense>
  );
}
```

#### Tree Shaking
```typescript
// ❌ AVOID: Default imports from large libraries
import * as icons from 'react-icons';

// ✅ RECOMMENDED: Named imports for tree shaking
import { FaPlay, FaStop } from 'react-icons/fa';
```

## Performance Monitoring

### Key Metrics to Track

#### React Performance
```typescript
// ✅ RECOMMENDED: Use React DevTools Profiler
function usePerformanceTracking(componentName: string) {
  useEffect(() => {
    const startTime = performance.now();
    return () => {
      const endTime = performance.now();
      if (endTime - startTime > 16) { // >1 frame at 60fps
        console.warn(`${componentName} render took ${endTime - startTime}ms`);
      }
    };
  });
}
```

#### Database Performance
```typescript
// ✅ RECOMMENDED: Track query performance
export async function withTiming<T>(
  operation: () => Promise<T>,
  label: string
): Promise<T> {
  const start = performance.now();
  try {
    const result = await operation();
    const duration = performance.now() - start;
    if (duration > 10) { // Log slow queries
      console.warn(`Slow query ${label}: ${duration}ms`);
    }
    return result;
  } catch (error) {
    console.error(`Query failed ${label}:`, error);
    throw error;
  }
}
```

## Performance Testing

### Automated Performance Tests

#### Component Performance Tests
```typescript
// ✅ RECOMMENDED: Performance test for critical components
describe('KitBrowser Performance', () => {
  it('renders 100 kits under performance threshold', async () => {
    const kits = generateMockKits(100);
    const startTime = performance.now();
    
    render(<KitBrowser kits={kits} />);
    
    const renderTime = performance.now() - startTime;
    expect(renderTime).toBeLessThan(100); // 100ms threshold
  });
});
```

#### Database Performance Tests
```typescript
// ✅ RECOMMENDED: Benchmark critical operations
describe('Database Performance', () => {
  it('loads kit metadata within performance target', async () => {
    const kitName = 'A0';
    const startTime = performance.now();
    
    await getKitMetadata(kitName);
    
    const queryTime = performance.now() - startTime;
    expect(queryTime).toBeLessThan(10); // 10ms target
  });
});
```

## Performance Regression Prevention

### Build-Time Checks
```json
{
  "scripts": {
    "check-bundle-size": "bundlesize",
    "check-performance": "npm run test -- --testNamePattern='Performance'",
    "performance-audit": "npm run check-bundle-size && npm run check-performance"
  }
}
```

### Continuous Monitoring
- **Bundle size tracking** in CI/CD
- **Performance test suite** in automated testing
- **Memory leak detection** in long-running operations
- **Render performance** monitoring in development

## Common Performance Anti-Patterns

### Avoid These Patterns
```typescript
// ❌ AVOID: Expensive operations in render
function Component({ samples }: { samples: Sample[] }) {
  const processed = samples.map(s => expensiveProcessing(s)); // Bad!
  return <div>{processed.map(p => <Item key={p.id} data={p} />)}</div>;
}

// ❌ AVOID: New objects in dependency arrays
useEffect(() => {
  fetchData();
}, [{ kitName, voiceNumber }]); // Creates new object every render

// ❌ AVOID: Unnecessary re-renders
function Parent() {
  const [count, setCount] = useState(0);
  return <ExpensiveChild onUpdate={() => setCount(count + 1)} />; // New function every render
}
```

---

_These guidelines are based on actual patterns observed in the high-performance Romper codebase. Follow these patterns to maintain the exceptional performance characteristics._