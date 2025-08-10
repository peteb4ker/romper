# General Standards (Always Apply)

## Core Patterns

### DbResult Pattern (CRITICAL)

```typescript
// ✅ ALWAYS use for database operations
type DbResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

async function getKit(name: string): Promise<DbResult<Kit>> {
  try {
    const kit = db
      .select()
      .from(kitsTable)
      .where(eq(kitsTable.name, name))
      .get();
    return kit
      ? { success: true, data: kit }
      : { success: false, error: "Kit not found" };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
```

### Try catch

Use catch `(_)` when you're explicitly ignoring errors and want to prevent ESLint or TypeScript from flagging the unused variable. This is preferred over naming the parameter err or e and leaving it unused.

```typescript

```

try {
maybeFails();
} catch (\_) {
// no-op: this error is intentionally ignored
}```

## Quality Requirements

### TypeScript Validation (CRITICAL)

- **Automated validation**: Pre-commit hooks handle TypeScript checking
- **Zero compilation errors**: All TypeScript errors must be fixed
- **Strict typing**: TypeScript strict mode required
- **No `any` types**: Use proper typing or `unknown` with type guards

### ESM Module System (CRITICAL)

```typescript
// ✅ CORRECT: Always use ES modules (except preload script)
import React, { useCallback, useState } from "react"; // ES module imports
import { toast } from "sonner";
import { useKitBrowser } from "./hooks/useKitBrowser";
import { toCapitalCase } from "../../../../shared/utils";

// Export using ES modules
export { KitEditor };
export default KitEditor;

// ❌ WRONG: CommonJS (only allowed in preload script)
const React = require("react"); // Don't use require()
module.exports = { KitEditor }; // Don't use module.exports

// ⚠️ EXCEPTION: Preload script only - electron/preload/index.ts can use CommonJS
```

### Import Organization

```typescript
// ✅ CORRECT order with ES modules:
import React, { useCallback, useState } from "react"; // 1. React
import { toast } from "sonner"; // 2. Third-party
import { useKitBrowser } from "./hooks/useKitBrowser"; // 3. Local relative
import { toCapitalCase } from "../../../../shared/utils"; // 4. Shared absolute
```

### File Size Limits

- **Javascript / Typescript**: Maximum 400 lines
- **Refactor when exceeded**: Split into focused modules

## Performance Standards

### React Optimization

```typescript
// ✅ REQUIRED: Memoize expensive operations
const KitCard = React.memo(({ kit, onSelect }: Props) => {
  const displayName = useMemo(() => kit.alias || kit.name, [kit.alias, kit.name]);
  const handleClick = useCallback(() => onSelect(kit.name), [kit.name, onSelect]);
  return <div onClick={handleClick}>{displayName}</div>;
});
```

### Database Efficiency

```typescript
// ✅ CORRECT: Batch operations
db.transaction(() => {
  samples.forEach((sample) => db.insert(samplesTable).values(sample).run());
});

// ❌ WRONG: Individual operations
samples.forEach((sample) => db.insert(samplesTable).values(sample).run());
```

## Security Validation

### Path Validation (CRITICAL)

```typescript
// ✅ ALWAYS validate file paths
function validateSamplePath(sourcePath: string): boolean {
  const resolved = path.resolve(sourcePath);
  return (
    resolved.endsWith(".wav") &&
    !resolved.includes("..") &&
    fs.existsSync(resolved)
  );
}
```

## Error Handling

### User-Friendly Messages

```typescript
// ✅ CORRECT: User-friendly error messages
if (error.includes("ENOENT")) {
  toast.error("Sample file not found. Please check if the file still exists.");
} else {
  toast.error("Unable to load sample. Please try again.");
}

// ❌ WRONG: Technical errors exposed to user
toast.error(error.message); // May show technical details
```

## Testing Requirements

### Coverage and Quality

- **80% test coverage**: Maintain high coverage across codebase
- **Test isolation**: Each test independent with proper cleanup
- **Mock external dependencies**: Test only the code under test
- **Descriptive test names**: Explain behavior being tested
- **Vitest (not Jest)**: Use Vitest for all test operations
- **NO trailing whitespace**: Never add whitespace at the end of lines
- **Keep code DRY**: Avoid unnecessary complexity, duplication, or code bloat

### Test Organization

```typescript
// ✅ CORRECT: Clear test structure
describe("useKitEditor", () => {
  beforeEach(() => {
    /* setup */
  });
  afterEach(() => {
    /* cleanup */
  });

  describe("when kit is editable", () => {
    it("should allow adding samples to voice slots", () => {
      // Test implementation
    });
  });
});
```

---

_These general standards apply to ALL Romper development regardless of file type. Additional file-specific standards are loaded based on the current working file pattern._
