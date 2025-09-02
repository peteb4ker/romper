# Romper Architecture Reference (Agent Quick Reference)

> **Token-efficient reference for AI agents working on Romper codebase**

## Current Architectural Status (Latest Analysis)

**Overall Health Score**: 0/100 ❌  
**Status**: POOR - Immediate refactoring required  
**Last Updated**: 2025-09-02

### Critical Issues Summary
- **13 files** exceed 300 LOC limit
- **56 files** have excessive complexity
- **22 hooks** exceed complexity thresholds
- **Quality Gates**: ❌ FAILING

### Top Priority Files Needing Refactoring
1. `electron/main/services/syncService.ts` (867 LOC)
2. `electron/preload/index.ts` (544 LOC) 
3. `electron/main/services/crud/sampleCrudService.ts` (467 LOC)
4. `app/renderer/components/dialogs/SyncUpdateDialog.tsx` (406 LOC)
5. `app/renderer/components/KitGrid.tsx` (338 LOC)

## Architecture Standards (Enforce These)

### Lines of Code (LOC) Limits
- **Small Components**: 50-100 LOC (presentational, UI elements)
- **Medium Components**: 100-200 LOC (forms, containers)
- **Large Components**: 200-300 LOC (complex features, wizards)
- **RED FLAG**: 300+ LOC → **IMMEDIATE REFACTORING REQUIRED**

### Component Complexity Limits
- **Props**: ≤15 maximum (prefer ≤10)
- **Hooks per component**: ≤10 maximum (prefer ≤6)
- **Hook returns**: ≤12 fields maximum (prefer ≤8)
- **Conditionals**: ≤20 per component (prefer ≤10)

### Architecture Boundaries
```
renderer/components/ → hooks/, utils/, shared/ ✅
renderer/hooks/ → utils/, shared/ ✅
renderer/views/ → components/, hooks/, utils/, shared/ ✅
electron/main/ → shared/ ONLY ✅
shared/ → NO external imports ✅
```

## Quick Checks for Agents

### Before Creating/Editing Files
1. **Check LOC**: Will this exceed 300 LOC? → Split file
2. **Check props**: Will this exceed 15 props? → Extract interface/split component
3. **Check hooks**: Will this use >10 hooks? → Extract custom hooks
4. **Check complexity**: Too many conditionals? → Extract helper functions

### Refactoring Strategies
- **300+ LOC files**: Break into multiple files by concern
- **Complex components**: Extract custom hooks for business logic
- **Many props**: Use typed interfaces and composition
- **Deep conditionals**: Extract decision trees to utilities

## Analysis Commands (For Ongoing Monitoring)

```bash
# Run all analyses
npm run analyze:architecture

# Individual analyses
npm run analyze:loc          # LOC compliance check
npm run analyze:dependencies # Import/circular dependency check
npm run analyze:complexity   # Component complexity metrics

# View reports
cat reports/architectural-summary.json  # Agent-friendly summary
cat reports/architectural-assessment.md # Human-readable report
```

## Quality Gates (Enforce in PRs)

### Must Pass (CI/CD Integration)
- [ ] No files >300 LOC
- [ ] No components >15 props
- [ ] No hooks >12 returns
- [ ] No circular dependencies
- [ ] TypeScript compilation
- [ ] All tests passing

### Code Review Checklist
- [ ] File size appropriate for purpose
- [ ] Single responsibility per component/hook
- [ ] Proper import organization
- [ ] Business logic in hooks, not components
- [ ] No architectural boundary violations

## Current Architectural Strengths
✅ No circular dependencies  
✅ 66 well-organized custom hooks  
✅ Type safety with Drizzle ORM  
✅ Comprehensive test coverage  
✅ Clear domain separation  

## Immediate Actions Required
1. **Refactor syncService.ts** (867 LOC → multiple service modules)
2. **Split preload/index.ts** (544 LOC → separate IPC handlers) 
3. **Break down SyncUpdateDialog.tsx** (406 LOC → wizard steps)
4. **Simplify KitGrid.tsx** (338 LOC → extract virtualization logic)

## File Organization Patterns

### Components
```
app/renderer/components/
├── dialogs/           # Modal dialogs
├── hooks/             # Custom hooks by domain
│   ├── kit-management/
│   ├── sample-management/
│   └── shared/
├── shared/            # Reusable components
├── utils/             # UI utilities
└── wizard/            # Multi-step wizards
```

### Hooks Organization
```
hooks/
├── kit-management/    # Kit CRUD operations
├── sample-management/ # Sample operations  
├── voice-panels/      # Voice panel logic
└── shared/           # Cross-cutting concerns
```

---
**For detailed standards**: See `docs/developer/architectural-standards.md`  
**For latest metrics**: Run `npm run analyze:architecture`