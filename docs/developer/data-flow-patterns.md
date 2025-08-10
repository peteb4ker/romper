---
layout: default
title: Data Flow Patterns
---

# Data Flow Patterns

This document establishes architectural patterns for data flow between database, IPC layer, and UI components.

## Core Principle: Push Raw Data Deep

**Rule**: Preserve raw database structures as far into the component tree as possible. Transform data at the point of consumption, not at boundaries.

### ✅ Preferred Pattern

```typescript
// Database/IPC Layer - Return raw structure
function getKit(kitName: string) {
  return {
    name: "A1",
    voices: [
      { voice_number: 1, voice_alias: "Kick" },
      { voice_number: 2, voice_alias: "Snare" }
    ]
  };
}

// Component - Transform at point of use
function VoicePanel({ kit }) {
  const voiceName = kit.voices?.find(v => v.voice_number === voiceNumber)?.voice_alias;
  return <span>{voiceName || "No name"}</span>;
}
```

### ❌ Anti-Pattern

```typescript
// Database/IPC Layer - DON'T transform for legacy components
function getKit(kitName: string) {
  const rawKit = database.getKit(kitName);

  // ❌ Avoid this transformation at boundary
  return {
    ...rawKit,
    voices: rawKit.voices.reduce((acc, v) => {
      acc[v.voice_number] = v.voice_alias;
      return acc;
    }, {}),
  };
}
```

## Benefits

### 🎯 **Accuracy**

- Raw data preserves full database relationships
- No information loss through premature transformation
- Database structure changes propagate naturally

### 🔧 **Maintainability**

- Single source of truth at database level
- Component logic is explicit and traceable
- Easier to reason about data transformations

### 🚀 **Flexibility**

- Components can access full relational data
- Different components can transform data differently
- New database fields automatically available

### 📊 **Type Safety**

- TypeScript types match actual database schema
- Compilation catches schema mismatches early
- IntelliSense shows real database structure

## Implementation Guidelines

### 1. Database Layer

- Use Drizzle relational queries with `with: { relations: true }`
- Return raw database objects with full relations
- Preserve all fields and nested structures

### 2. IPC/API Layer

- Pass through database results without transformation
- Only add error handling and validation
- Keep data format identical to database output

### 3. Hook Layer

- Accept raw database structures
- Provide helper methods for common transformations
- Cache transformed data with useMemo when expensive

### 4. Component Layer

- Transform data at render time or in event handlers
- Use clear, readable transformation logic
- Document any complex transformations

## Migration Strategy

When refactoring legacy components:

1. **Identify transformation points** - Find where data is reshaped
2. **Move transformations down** - Push to consuming components
3. **Update types** - Match TypeScript types to raw database schema
4. **Test thoroughly** - Ensure UI behavior is preserved
5. **Remove boundary transforms** - Clean up IPC/API transformations

## Examples

### Voice Aliases

```typescript
// ✅ Component handles raw voice array
function VoiceDisplay({ kit, voiceNumber }) {
  const voice = kit.voices?.find(v => v.voice_number === voiceNumber);
  return <span>{voice?.voice_alias || "No name"}</span>;
}

// ✅ Helper hook for common transformations
function useVoiceMap(kit) {
  return useMemo(() => {
    const map = {};
    kit.voices?.forEach(v => {
      if (v.voice_alias) map[v.voice_number] = v.voice_alias;
    });
    return map;
  }, [kit.voices]);
}
```

### Sample References

```typescript
// ✅ Component works with full sample objects
function SampleList({ kit }) {
  return kit.samples?.map(sample => (
    <SampleItem
      key={sample.id}
      filename={sample.filename}
      voiceNumber={sample.voice_number}
      slotNumber={sample.slot_number}
      sourcePath={sample.source_path}
    />
  ));
}
```

## Legacy Component Migration

Mark legacy patterns for eventual migration:

```typescript
// TODO: Migrate to raw database structure
const legacyVoiceNames = useMemo(() => {
  // Transform raw voices to legacy format temporarily
  const map = {};
  kit.voices?.forEach((v) => {
    if (v.voice_alias) map[v.voice_number] = v.voice_alias;
  });
  return map;
}, [kit.voices]);
```

This ensures gradual migration without breaking existing functionality.
