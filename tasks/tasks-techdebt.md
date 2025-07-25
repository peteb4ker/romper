# Technical Debt Todo List

_Last updated: 2025-07-25_

## Code Quality

- [ ] **Remove trailing whitespace from codebase**
  - Priority: High | Effort: Small | Risk: None
  - Run whitespace cleanup on all files
  - Add ESLint rule to catch trailing whitespace in future
  - Update editor settings documentation

- [ ] **Refactor duplicated error handling patterns**
  - Priority: Medium | Effort: Medium | Risk: Low
  - Standardize error handling across renderer hooks
  - Create shared error utility functions
  - Review file path validation duplication

## Database Layer

- [ ] **Add structured error types to ORM layer**
  - Priority: Low | Effort: Medium | Risk: Low
  - Current: Simple string errors work fine
  - Enhancement: Error codes, structured details, better debugging
  - Only tackle if debugging becomes difficult

- [ ] **Add server-side input validation**
  - Priority: Low | Effort: Small | Risk: Low
  - Current: UI-level validation works well
  - Enhancement: Validate kit names, voice numbers in ORM
  - Only needed if data integrity issues arise

## Scanning System

- [ ] **Move WAV analysis to main process** 
  - Priority: Medium | Effort: Medium | Risk: Low
  - Current: Disabled due to Buffer issues in renderer process
  - Enhancement: Implement WAV analysis in main process using node-wav
  - Returns default values for now, needs proper file analysis
  - Important for accurate audio metadata

## Testing

- [ ] **Increase error path test coverage**
  - Priority: Medium | Effort: Medium | Risk: Medium
  - Focus areas: Database corruption, IPC failures, invalid inputs
  - Current: Happy paths well covered
  - Important for production stability

- [ ] **Add integration tests for sequencer functionality**
  - Priority: Medium | Effort: Small | Risk: Low
  - Test step pattern persistence across app restarts
  - Test kit auto-creation during sequencer use
  - Validate voice number mapping (1-4)

- [ ] **Review and improve scanning function tests**
  - Priority: Medium | Effort: Medium | Risk: Medium  
  - Current: Tests may not cover the right scenarios
  - Focus on RTF filename parsing, voice inference, file path resolution
  - Ensure scanning works with different local store configurations

## Documentation

- [ ] **Document error handling patterns**
  - Priority: Low | Effort: Small | Risk: Low
  - When to use DbResult vs exceptions
  - Error message guidelines
  - Debugging flows

- [ ] **Create ORM usage guide**
  - Priority: Low | Effort: Small | Risk: Low
  - Best practices for database operations
  - Common patterns and anti-patterns
  - Migration workflow

## Performance

- [ ] **Profile database operations with large datasets**
  - Priority: Low | Effort: Medium | Risk: Low
  - Test with 2600+ kits
  - Identify slow queries
  - Only needed if performance issues reported

---

## Guidelines

- **Mark items complete** with `[x]` when finished
- **Add new items** when encountering tech debt during feature work
- **Update priorities** based on user feedback and stability issues
- **Don't tackle** unless specifically prioritized or blocking current work
- **Group related items** and address together for efficiency