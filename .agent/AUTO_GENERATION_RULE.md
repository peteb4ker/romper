# Auto-Generation Rule (CRITICAL)

## Rule Statement

**Whenever `.agent/standards/comprehensive.md` is updated, ALL file-type specific instruction files MUST be regenerated automatically to maintain consistency.**

## Affected Files

The following files must be updated when `comprehensive.md` changes:

- `.agent/standards/react-components.md`
- `.agent/standards/custom-hooks.md`
- `.agent/standards/database.md`
- `.agent/standards/testing.md`
- `.agent/standards/typescript-types.md`
- `.agent/standards/utilities.md`
- `.agent/standards/shared-code.md`
- `.agent/patterns/anti-patterns.md`
- `.agent/patterns/performance.md`
- `.agent/patterns/security.md`

## Generation Process

1. Extract relevant sections from `comprehensive.md`
2. Synthesize into focused, file-type specific content (~250-300 words each)
3. Include essential patterns with good/bad examples
4. Add quick validation checklists
5. Maintain consistent formatting and structure

## Responsibility

This rule applies to ALL development agents and tools working on Romper:

- Claude Code
- GitHub Copilot
- Any other AI development tools
- Human developers making changes to standards

## Enforcement

- Any agent updating `comprehensive.md` must immediately regenerate affected files
- No exceptions - consistency across the instruction system is critical
- Failure to follow this rule will result in inconsistent development guidance

---

_This rule ensures the context-aware instruction system remains synchronized and provides consistent, up-to-date guidance regardless of which specific file-type standards are loaded._
