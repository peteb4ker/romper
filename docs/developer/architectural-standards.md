<!-- 
layout: default
title: Romper Architectural Standards
-->

# Romper Architectural Standards

This document defines the architectural standards and coding guidelines for the Romper Sample Manager project, based on quantitative analysis of the current codebase and industry best practices.

## Table of Contents

1. [Component Complexity Standards](#component-complexity-standards)
2. [Lines of Code (LOC) Guidelines](#lines-of-code-loc-guidelines)
3. [Dependency Management](#dependency-management)
4. [Hook Architecture](#hook-architecture)
5. [Component Architecture](#component-architecture)
6. [Performance Standards](#performance-standards)
7. [Quality Gates](#quality-gates)

## Component Complexity Standards

### Lines of Code (LOC) Guidelines

Based on component responsibility and complexity analysis:

#### Small Components (50-100 LOC)
**Purpose**: Simple presentational components, basic form inputs, UI elements
- **Examples**: Buttons, cards, badges, icons, simple form fields
- **Characteristics**: Single responsibility, minimal logic, focused on presentation
- **Props**: ≤5 props maximum
- **Hooks**: ≤2 hooks maximum

#### Medium Components (100-200 LOC)
**Purpose**: Feature-rich forms, data display components, container components
- **Examples**: Complex forms, data tables, modal dialogs, navigation components
- **Characteristics**: Moderate business logic, orchestrates multiple child components
- **Props**: ≤10 props maximum
- **Hooks**: ≤6 hooks maximum

#### Large Components (200-300 LOC)
**Purpose**: Complex forms with validation, data tables with interactions, multi-step wizards
- **Examples**: Complete feature widgets, complex data visualization, workflow components
- **Characteristics**: Feature-complete, significant business logic, complex state management
- **Props**: ≤15 props maximum (consider refactoring if exceeded)
- **Hooks**: ≤10 hooks maximum
- **Special consideration**: Should be candidates for breaking into smaller components

#### Red Flags (300+ LOC)
**Status**: **AVOID** - Indicates architectural debt
- **Problems**: Multiple responsibilities, missing abstractions, difficult testing/maintenance
- **Action Required**: Immediate refactoring needed
- **Refactoring strategies**:
  - Extract smaller components
  - Create custom hooks for business logic
  - Move utility functions to separate files
  - Separate concerns into multiple files

### Current Codebase Status (Analysis Results)

Based on recent analysis:
- **Total Components**: 53
- **Average Component LOC**: 140
- **Files exceeding 300 LOC**: 13 files (6.8% of codebase)
- **Health Score**: 0/100 (requires immediate attention)

**Critical Issues Identified**:
1. `electron/main/services/syncService.ts` - 867 LOC
2. `electron/preload/index.ts` - 544 LOC
3. `app/renderer/components/dialogs/SyncUpdateDialog.tsx` - 406 LOC
4. `app/renderer/components/KitGrid.tsx` - 338 LOC

## Dependency Management

### Import Organization

1. **Group imports by source**:
   ```typescript
   // External libraries
   import React from 'react';
   import { toast } from 'sonner';
   
   // Internal shared types/utilities
   import type { KitWithRelations } from '@romper/shared/db/schema';
   
   // Relative imports (hooks, utilities)
   import { useKitDataManager } from '../hooks/kit-management/useKitDataManager';
   import { formatDate } from '../utils/dateUtils';
   ```

2. **Architectural Boundaries**:
   - `renderer/components` can import from `hooks`, `utils`, `shared`
   - `renderer/hooks` can import from `utils`, `shared`
   - `renderer/views` can import from `components`, `hooks`, `utils`, `shared`
   - `electron/main` can import from `shared` only
   - `shared` should not import from other domains

3. **Circular Dependencies**: 
   - **FORBIDDEN** - Use architectural analysis tools to detect and eliminate
   - Current status: ✅ No circular dependencies detected

## Hook Architecture

### Custom Hook Standards

#### Simple Hooks (≤50 LOC)
- **Returns**: ≤5 fields
- **Internal hooks**: ≤3 hooks
- **Purpose**: Single concern (data fetching, state management, event handling)

#### Moderate Hooks (50-150 LOC)
- **Returns**: ≤8 fields  
- **Internal hooks**: ≤6 hooks
- **Purpose**: Feature-specific logic, coordinated state management

#### Complex Hooks (150-300 LOC)
- **Returns**: ≤12 fields
- **Internal hooks**: ≤10 hooks
- **Purpose**: Complete feature management, complex business logic
- **Consider**: Breaking into multiple hooks

#### Excessive Hooks (300+ LOC)
- **Status**: **REFACTOR REQUIRED**
- **Action**: Split into multiple hooks or extract utilities

### Hook Naming Conventions

```typescript
// Data management
useKitData()
useKitDataManager()

// UI state
useDialogState()
useModalState()

// Business logic
useKitValidation()
useSampleProcessing()

// Event handling
useKeyboardShortcuts()
useDragAndDrop()
```

### Return Pattern Standards

**Object Returns** (Preferred for hooks with multiple related values):
```typescript
return {
  // State
  data,
  loading,
  error,
  
  // Actions
  refresh,
  update,
  delete
};
```

**Array Returns** (For simple state/setter pairs):
```typescript
return [value, setValue] as const;
```

## Component Architecture

### Component Hierarchy Standards

#### Presentation vs Container Pattern

**Presentation Components**:
- Focus on UI rendering
- Receive data via props
- Minimal state management
- No business logic
- Easy to test

**Container Components**:
- Manage state and business logic
- Use custom hooks
- Pass data to presentation components
- Handle user interactions

#### Props Interface Design

```typescript
// Good: Specific, typed interface
interface KitGridProps {
  kits: KitWithRelations[];
  onSelectKit: (kitName: string) => void;
  onToggleFavorite?: (kitName: string) => void;
  selectedKit?: string;
}

// Avoid: Generic or overly broad interfaces
interface KitGridProps {
  data: any;
  callbacks: Record<string, Function>;
  config: object;
}
```

### State Management Patterns

1. **Local State**: Component-specific UI state
2. **Hook State**: Feature-specific business logic
3. **Context**: Shared application state
4. **Database State**: Persistent application data

## Performance Standards

### Response Time Targets

- **User Interactions**: <50ms response time
- **Data Loading**: <200ms for cached data
- **Database Operations**: <100ms for simple queries
- **File Operations**: <500ms for file system access

### Bundle Size Targets

- **Initial Load**: <2MB total bundle
- **Code Splitting**: Lazy load non-critical features
- **Tree Shaking**: Eliminate unused exports

### Memory Management

- **Component Cleanup**: Proper useEffect cleanup
- **Event Listeners**: Remove on unmount
- **Timers/Intervals**: Clear on cleanup
- **Large Data Sets**: Use virtualization

## Quality Gates

### Pre-commit Checks

1. **TypeScript compilation**: Must pass without errors
2. **ESLint**: Must pass with zero violations
3. **Tests**: Unit tests must pass with >80% coverage
4. **Build**: Production build must succeed

### Architectural Quality Gates

#### Lines of Code Checks
- **Error**: Any file >300 LOC
- **Warning**: Any component >200 LOC
- **Info**: Hook returns >8 fields

#### Complexity Checks
- **Error**: Component with >15 props
- **Error**: Hook using >10 internal hooks
- **Warning**: Conditional rendering >10 conditions

#### Dependency Checks
- **Error**: Circular dependencies detected
- **Error**: Cross-domain boundary violations
- **Warning**: Deep dependency chains (>8 levels)

### CI/CD Integration

```bash
# Add to pre-commit hooks
npm run lint:check
npm run typecheck  
npm run test:unit
npm run build
node scripts/architecture/analyze-loc.js --threshold=300 --fail-on-red-flags
```

## Tooling and Automation

### Analysis Scripts

Located in `scripts/architecture/`:

1. **`analyze-loc.js`**: Lines of code analysis with architectural standards
2. **`analyze-dependencies.js`**: Import patterns and circular dependency detection  
3. **`analyze-complexity.js`**: Component and hook complexity metrics

### Usage

```bash
# Run all architectural analyses
npm run analyze:architecture

# Individual analyses
node scripts/architecture/analyze-loc.js
node scripts/architecture/analyze-dependencies.js
node scripts/architecture/analyze-complexity.js

# View detailed reports
ls reports/
```

### Continuous Monitoring

Set up architectural health monitoring:

1. **Weekly Reports**: Automated architectural health assessment
2. **PR Analysis**: Check architectural impact of changes
3. **Trend Tracking**: Monitor architectural metrics over time
4. **Quality Dashboard**: Visual representation of architectural health

## Migration Strategy

### Addressing Current Architectural Debt

Based on analysis results, prioritize refactoring:

#### Phase 1: Critical Files (Immediate)
1. `syncService.ts` (867 LOC) → Break into service modules
2. `preload/index.ts` (544 LOC) → Split IPC handlers
3. `SyncUpdateDialog.tsx` (406 LOC) → Extract wizard steps

#### Phase 2: Large Components (Near-term)
1. `KitGrid.tsx` (338 LOC) → Extract grid items and virtualization
2. `KitsView.tsx` (329 LOC) → Extract view logic to hooks
3. `PreferencesDialog.tsx` (371 LOC) → Split into preference sections

#### Phase 3: Hook Optimization (Medium-term)
1. Hooks returning >15 fields → Split into focused hooks
2. Hooks with >10 internal hooks → Extract utilities
3. Complex conditional logic → Extract decision trees

## Enforcement

### Code Review Checklist

- [ ] No files exceed 300 LOC
- [ ] Components have ≤15 props
- [ ] Hooks return ≤15 fields
- [ ] No circular dependencies
- [ ] Proper import organization
- [ ] TypeScript strict mode compliance
- [ ] Unit tests for business logic
- [ ] Performance considerations documented

### Automated Enforcement

Configure ESLint rules and custom scripts to enforce these standards automatically.

---

**Note**: These standards are living guidelines that should evolve with the project. Regular reviews and updates ensure they continue to serve the project's architectural goals.