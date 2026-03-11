---
description: Query SonarCloud for all open issues and create/update a GitHub issue with an actionable breakdown
allowed-tools: Bash, Read, Grep, mcp__sonarqube__get_project_quality_gate_status, mcp__sonarqube__search_sonar_issues_in_projects, mcp__sonarqube__search_security_hotspots, mcp__sonarqube__show_rule
---

Generate an actionable SonarCloud report as a GitHub issue. This queries the live SonarCloud API,
categorizes all open issues, and either creates a new GitHub issue or updates the existing one.

## Step 1: Gather Data

Query SonarCloud using the MCP tools. Run these in parallel:

1. **Quality gate status**: `mcp__sonarqube__get_project_quality_gate_status` with projectKey `peteb4ker_romper`
2. **All open issues**: `mcp__sonarqube__search_sonar_issues_in_projects` with:
   - projects: `["peteb4ker_romper"]`
   - issueStatuses: `["OPEN"]`
   - ps: 500
3. **Security hotspots**: `mcp__sonarqube__search_security_hotspots` with:
   - projectKey: `peteb4ker_romper`
   - status: `["TO_REVIEW"]`

## Step 2: Classify Issues

Group issues into categories for the report:

### By severity (BLOCKER > HIGH > MEDIUM > LOW > INFO)

### By fix type — group mechanical fixes together:
- `parseInt` → `Number.parseInt` (rule S7773)
- `Array()` → `new Array()` (rule S7723)
- `charCodeAt` → `codePointAt` (rule S7758)
- `replace` → `replaceAll` (rule S7781)
- Accessibility issues (rules S6848, S1082, S6853)
- Ambiguous spacing (rule S6772)
- Any other patterns you discover

For each group, list **every** affected file and line number. An agent fixing these needs exact locations.

## Step 3: Format the Issue Body

Use this structure:

```markdown
## SonarCloud Quality Report

**Quality Gate:** [STATUS]
**Failing Conditions:** [list each with actual vs required values]
**Total Open Issues:** N (X BLOCKER, Y HIGH, Z MEDIUM, W LOW)
**Security Hotspots to Review:** N

### BLOCKER/HIGH Issues (fix first)
[Table: File | Line | Rule | Issue description]

### Mechanical Fixes (bulk changes)
Group by fix type with a heading per group. For each group:
- Explain the fix pattern (e.g. "`parseInt(x)` → `Number.parseInt(x)`")
- List every occurrence: `file.ts` (line N)

### Accessibility Issues
[Table if any]

### Security Hotspots
[Table if any]

### Links
- [SonarCloud Dashboard](https://sonarcloud.io/summary/overall?id=peteb4ker_romper)
- [Issues](https://sonarcloud.io/project/issues?id=peteb4ker_romper)
- [Security Hotspots](https://sonarcloud.io/project/security_hotspots?id=peteb4ker_romper)
```

## Step 4: Create or Update GitHub Issue

Check for an existing open issue with the `sonarcloud` label:

```bash
gh issue list --label "sonarcloud" --state open --json number --limit 1
```

- **If exists**: Update its body with `gh issue edit <number> --body "..."`
- **If none**: Create new with `gh issue create --title "SonarCloud: quality gate report" --label "bug,priority:high,sonarcloud" --body "..."`

Use a HEREDOC to pass the body to avoid shell escaping issues:
```bash
gh issue edit <N> --body "$(cat <<'ISSUE_EOF'
<body content here>
ISSUE_EOF
)"
```

## Step 5: Summary

Print a concise summary to the user:
- Quality gate status
- Issue counts by severity
- Whether the GitHub issue was created or updated
- The issue URL

$ARGUMENTS
