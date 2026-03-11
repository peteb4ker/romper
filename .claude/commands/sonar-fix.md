---
description: Find the open SonarCloud GitHub issue and systematically fix the reported issues
argument-hint: "[--major-only | --mechanical-only | --all]  Optionally limit scope of fixes (default: --all)"
allowed-tools: Bash, Read, Write, Edit, Glob, Grep, Agent, mcp__sonarqube__search_sonar_issues_in_projects, mcp__sonarqube__show_rule
---

Find the open SonarCloud tracking issue on GitHub and fix the reported code quality issues.

## Step 1: Find the Tracking Issue

```bash
gh issue view $(gh issue list --label "sonarcloud" --state open --json number --jq '.[0].number') --json number,body
```

If no open issue exists, tell the user to run `/sonar-report` first and stop.

Parse the issue body to extract:
- The list of MAJOR/BLOCKER issues (files, lines, rules)
- The mechanical fix groups (files, lines, fix patterns)
- The overall quality gate status

## Step 2: Plan the Fix Scope

Based on `$ARGUMENTS`:
- `--major-only`: Fix only BLOCKER/HIGH/MAJOR severity issues
- `--mechanical-only`: Fix only the bulk mechanical patterns (S7773, S7723, S7758, S7781)
- `--all` (default): Fix everything

**CRITICAL**: Before editing any file, READ it first to understand context. Never blindly find-and-replace.

## Step 3: Fix Mechanical Issues (Batch by Pattern)

These are safe, deterministic transformations. Process one pattern at a time across all files:

### Pattern: `parseInt(x)` → `Number.parseInt(x)` (S7773)
- Also: `parseFloat(x)` → `Number.parseFloat(x)`
- Also: `isNaN(x)` → `Number.isNaN(x)`
- **Caution**: Only change bare `parseInt`/`parseFloat`/`isNaN`, not `Number.parseInt` (already correct) or `someObj.parseInt` (different thing)

### Pattern: `Array(n)` → `new Array(n)` (S7723)
- **Caution**: Only change bare `Array()` calls, not `Array.from()` or `Array.isArray()`

### Pattern: `charCodeAt` → `codePointAt`, `fromCharCode` → `fromCodePoint` (S7758)
- These are direct replacements on string methods

### Pattern: `replace(/regex/g, ...)` → `replaceAll(regex, ...)` (S7781)
- Only when the regex has the `g` flag and is a simple pattern
- **Caution**: If the regex uses special features beyond the `g` flag, leave it alone

For each file:
1. Read the file
2. Find the exact line(s) from the issue
3. Apply the transformation using Edit
4. Verify the change makes sense in context

## Step 4: Fix MAJOR Issues

These require more judgment:

### Accessibility (S6848, S1082, S6853)
- **S6848** (non-native interactive elements): Add `role="button"` and `tabIndex={0}` to clickable non-button elements, plus `onKeyDown` handler for Enter/Space
- **S1082** (click without keyboard): Add `onKeyDown` handler that triggers the same action on Enter/Space
- **S6853** (label not associated): Add `htmlFor` attribute pointing to the input's `id`, or wrap the input inside the `<label>`
- Read the component to understand the UX before changing it

### Ambiguous Spacing (S6772)
- Add `{' '}` JSX expression between adjacent inline elements, or restructure the JSX
- Read surrounding context to determine the right fix

### Other MAJOR issues
- Look up the rule with `mcp__sonarqube__show_rule` if you're unsure what it means
- Apply the fix that best fits the existing code patterns

## Step 5: Validate

After all fixes:

1. **Run TypeScript check**: `npx tsc --noEmit`
2. **Run linter**: `npx eslint . --ext .js,.jsx,.ts,.tsx`
3. **Run tests**: `npm run test:fast`

Fix any issues these surface. Do NOT skip failing tests.

## Step 6: Verify Against SonarCloud

Query SonarCloud again to confirm issues are resolved:

```
mcp__sonarqube__search_sonar_issues_in_projects with:
  projects: ["peteb4ker_romper"]
  issueStatuses: ["OPEN"]
```

Note: SonarCloud won't reflect your local changes until they're pushed and analyzed.
Report what you expect to be resolved based on the fixes applied.

## Step 7: Summary

Print a summary:
- Number of issues fixed, by category
- Any issues skipped and why
- Files modified
- Test/lint/typecheck results
- Remind the user to commit with `/commit` when satisfied

$ARGUMENTS
