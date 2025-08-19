<!-- 
title: Technical Debt - Active Items
priority: medium
status: active
updated: 2025-08-19
context_size: medium
target_release: ongoing
-->

# Technical Debt - Active Items

Technical debt items that should be addressed to improve code quality and maintainability.

---

## DEBT.1: Decompose KitBrowser Component
**Priority:** Medium | **Effort:** Large | **Risk:** Medium

### Description
The KitBrowser component has grown too complex (513-line test indicates over-complexity).

### Current Issues
- Component handles rendering, navigation, dialog management, keyboard interactions
- Large test file indicates component has too many responsibilities
- Difficult to maintain and test individual features

### Proposed Solution
Split into focused components:
- **KitList component** - Pure rendering logic
- **BankNavigation component** - A-Z navigation handling
- **DialogManager hook** - Dialog state management
- **Custom hooks** - Extract complex interaction logic

### Success Criteria
- Each component has a single, clear responsibility
- Test files are smaller and more focused
- Component is easier to maintain and extend
- No regression in functionality

---

## DEBT.2: Move WAV Analysis to Main Process
**Priority:** Medium | **Effort:** Medium | **Risk:** Low

### Description
WAV analysis is currently disabled due to Buffer issues in renderer process.

### Current State
- Returns default values for audio metadata
- Limits accurate sample information display
- Affects user experience with sample management

### Proposed Solution
- Implement WAV analysis in main process using node-wav
- Create IPC endpoints for audio metadata retrieval
- Return accurate sample rate, bit depth, channel information

### Benefits
- Accurate audio metadata for better user decisions
- Proper format validation
- Enhanced sample management capabilities

---

## DEBT.3: Add Server-Side Input Validation
**Priority:** Low | **Effort:** Small | **Risk:** Low

### Description
Currently only UI-level validation exists for database operations.

### Enhancement Areas
- Validate kit names in database layer
- Validate voice numbers (1-4) in ORM
- Add sample path validation
- Ensure data integrity constraints

### Notes
- Only needed if data integrity issues arise
- Current UI-level validation works well
- Low priority unless problems are reported

---

## DEBT.4: Profile Database Operations
**Priority:** Low | **Effort:** Medium | **Risk:** Low

### Description
Test database performance with large datasets to identify potential bottlenecks.

### Testing Scenarios
- Test with 2600+ kits (maximum Rample capacity)
- Identify slow queries during scanning operations
- Profile kit browser performance with large collections
- Test search/filter operations

### Notes
- Only needed if performance issues are reported
- Current performance is acceptable for typical use cases
- Monitor user feedback for performance complaints

---

## DEBT.5: Test Infrastructure Phase 3
**Priority:** Medium | **Effort:** Medium | **Risk:** Low

### Description
Complete the test infrastructure improvements started in previous phases.

### Remaining Work
- **Unit/Integration/E2E Separation**: Implement proper test categorization
- **Separate Vitest Configs**: Create configs for different test types
- **Expand Integration Coverage**: Add more renderer↔main IPC tests
- **E2E Test Suite**: Add tests for critical user journeys

### Benefits
- Better test organization and performance
- Clearer test execution strategies
- Improved CI/CD pipeline efficiency

---

## DEBT.6: Increase Error Path Coverage
**Priority:** Medium | **Effort:** Medium | **Risk:** Medium

### Description
Expand test coverage for error conditions and edge cases.

### Focus Areas
- **Database Corruption**: Test recovery scenarios
- **IPC Failures**: Test communication breakdowns
- **Invalid Inputs**: Test malformed data handling
- **File System Errors**: Test permission and corruption issues

### Benefits
- Improved production stability
- Better error handling and user messaging
- Reduced support issues

---

## DEBT.7: Documentation Improvements
**Priority:** Low | **Effort:** Small | **Risk:** Low

### Description
Create missing documentation for development patterns.

### Documentation Needs
- **Error Handling Patterns**: When to use DbResult vs exceptions
- **ORM Usage Guide**: Best practices for database operations
- **Testing Guidelines**: Patterns for different test types
- **Component Standards**: React component development guidelines

---

## Implementation Priority

### High Impact / Medium Effort
1. **DEBT.1**: KitBrowser decomposition (improves maintainability)
2. **DEBT.5**: Complete test infrastructure (improves development workflow)

### Medium Impact / Low Effort  
3. **DEBT.2**: WAV analysis to main process (improves user experience)
4. **DEBT.6**: Error path coverage (improves stability)

### Low Priority (As Needed)
5. **DEBT.3**: Server-side validation (only if issues arise)
6. **DEBT.4**: Database profiling (only if performance issues reported)
7. **DEBT.7**: Documentation (ongoing as needed)

---

## Guidelines for Technical Debt

### When to Address
- **Don't tackle** unless specifically prioritized or blocking current work
- **Mark items complete** with `[x]` when finished
- **Add new items** when encountering tech debt during feature work
- **Update priorities** based on user feedback and stability issues

### Grouping Strategy
- **Group related items** and address together for efficiency
- **Consider user impact** when prioritizing
- **Balance** technical improvement with feature development

### Success Metrics
- **Code Maintainability**: Easier to modify and extend
- **Test Quality**: Better coverage and organization
- **Performance**: No degradation, potential improvements
- **Developer Experience**: Reduced friction in development workflow

---
*Last updated: 2025-08-19*