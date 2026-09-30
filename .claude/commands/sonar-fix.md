---
description: Fix open SonarCloud issues for peteb4ker_romper, optionally filtered by rule, severity, or path
argument-hint: "[rule key | severity | path]  e.g. typescript:S6557, MAJOR, app/renderer/components"
allowed-tools: Bash, Read, Edit, Write, Glob, Grep, mcp__sonarqube__search_sonar_issues_in_projects, mcp__sonarqube__show_rule
---

Fix open SonarCloud issues on project `peteb4ker_romper`. Scope: $ARGUMENTS (all open issues if empty).

## Getting the issues

Use the SonarQube MCP tools if they're connected. Otherwise the project is public, so the web API works without a token:

```sh
curl -s "https://sonarcloud.io/api/issues/search?componentKeys=peteb4ker_romper&issueStatuses=OPEN,CONFIRMED&ps=500" \
  | jq -r '.issues[] | "\(.severity)\t\(.rule)\t\(.component | sub("peteb4ker_romper:"; "")):\(.line)\t\(.message)"'
```

Add `&rules=<key>`, `&severities=<SEV>`, or filter by path with `jq` to narrow. Rule details: `https://sonarcloud.io/api/rules/show?key=<rule>&organization=peteb4ker`.

SonarCloud only re-analyzes on PRs and pushes to `main`, so it won't reflect local edits.

## Fixing

Sonar's suggested rewrite is not always behavior-preserving, so check each one in context. Known traps:

- `isNaN(x)` → `Number.isNaN(x)` differs for non-numbers (`isNaN("abc")` is true, `Number.isNaN("abc")` is false). Convert explicitly first when `x` may not be a number.
- `.replace(/re/g, …)` → `.replaceAll(/re/g, …)` must keep the `g` flag; `replaceAll` throws on a non-global regex.
- Accessibility rules (S6848, S1082) on clickable non-buttons: prefer switching to a real `<button>` over bolting on `role`/`tabIndex`/`onKeyDown`.

Leave **S7785** (prefer top-level await) in `electron/main/index.ts` alone and mark it won't-fix in the SonarCloud UI: top-level `await app.whenReady()` deadlocks the ESM main bootstrap, and only e2e catches it.

## Validate

`npm run typecheck && npm run lint:check && npm run test:fast`, plus `npm run test:e2e` if you touched `electron/main`. Summarize what was fixed by rule, what was skipped and why.
