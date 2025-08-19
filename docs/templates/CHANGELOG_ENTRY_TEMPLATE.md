## [{{version}}] - {{date}}

### Breaking Changes
{{#if breaking}}
{{#each breaking}}
- {{this}}
{{/each}}
{{else}}
None
{{/if}}

### New Features
{{#if features}}
{{#each features}}
- {{this}}
{{/each}}
{{else}}
None
{{/if}}

### Bug Fixes
{{#if fixes}}
{{#each fixes}}
- {{this}}
{{/each}}
{{else}}
None
{{/if}}

### Performance Improvements
{{#if performance}}
{{#each performance}}
- {{this}}
{{/each}}
{{else}}
None
{{/if}}

### Other Changes
{{#if other}}
{{#each other}}
- {{this}}
{{/each}}
{{else}}
None
{{/if}}

### Contributors
{{#if contributors}}
{{#each contributors}}
- @{{this}}
{{/each}}
{{else}}
- Romper Development Team
{{/if}}

**Full Changelog**: [{{previous_version}}...{{version}}](https://github.com/peteb4ker/romper/compare/{{previous_version}}...{{version}})

---