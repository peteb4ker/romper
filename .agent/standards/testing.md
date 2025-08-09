# Testing Standards (Vitest)

## Core Principle: Test the Right Thing at the Right Level

**CRITICAL**: Unit tests should test pure business logic, not integrations. Functions that are just wrappers around external systems (database, filesystem, network) need integration tests, not unit tests.

## Test Categories and Scope

### 1. Unit Tests (`*.test.ts`)
**Purpose**: Test pure business logic and functions in isolation

**What to test:**
- Pure functions (no side effects)
- Business logic calculations
- Data transformations
- Utility functions
- Error handling logic
- Algorithm correctness

**What NOT to test:**
- Database operations (use integration tests)
- File system operations (use integration tests)
- Network calls (use integration tests)
- External service integrations
- React component rendering (use component tests)
- Functions that are just `withDb()` wrappers

**Example - CORRECT Unit Test:**
```typescript
// ✅ GOOD: Testing pure function logic
describe("buildDeleteConditions", () => {
  it("should build conditions with kit name only", () => {
    const mockCondition = { kit_name: "Test Kit" };
    vi.mocked(eq).mockReturnValue(mockCondition);
    
    const result = buildDeleteConditions("Test Kit");
    
    expect(eq).toHaveBeenCalledWith(samples.kit_name, "Test Kit");
    expect(result).toBe(mockCondition);
  });
});

// ❌ BAD: Testing database integration in unit test
describe("addKit", () => {
  it("should insert kit into database", () => {
    // This is testing withDb integration, not business logic
    const result = addKit("/db/path", kitData);
    expect(result.success).toBe(true); // This will fail - needs real DB
  });
});
```

### 2. Integration Tests (`*.integration.test.ts`)
**Purpose**: Test integration between components and external systems

**What to test:**
- Database CRUD operations
- Functions using `withDb()`
- File system operations
- API endpoints
- IPC handlers (actual functionality)
- Data persistence
- Transaction handling

**Example - Integration Test for Database Operations:**
```typescript
describe("Kit Database Operations (Integration)", () => {
  let testDb: string;
  
  beforeEach(async () => {
    testDb = await createTestDatabase();
  });
  
  afterEach(async () => {
    await cleanupTestDatabase(testDb);
  });
  
  it("should create kit with voices in database", async () => {
    // Test the actual database operation
    const result = await addKit(testDb, testKit);
    
    expect(result.success).toBe(true);
    
    // Verify actual database state
    const kit = await getKit(testDb, testKit.name);
    expect(kit.data).toMatchObject(testKit);
    
    // Verify voices were created
    const voices = await getVoices(testDb, testKit.name);
    expect(voices.data).toHaveLength(4);
  });
});
```

### 3. Component Tests (`*.test.tsx`)
**Purpose**: Test React component behavior and user interactions

**What to test:**
- Component rendering with different props
- User interactions (clicks, input)
- Conditional rendering
- Error states
- Loading states
- Accessibility

**What NOT to test:**
- Hook implementation details
- Internal state management specifics
- Business logic (test in unit tests)

### 4. IPC Handler Tests

**IMPORTANT**: IPC handler tests should be split into two types:

#### Registration Tests (Unit)
Test that handlers are registered with correct names:
```typescript
describe("registerSampleIpcHandlers", () => {
  it("should register all required handlers", () => {
    const mockIpcMain = { handle: vi.fn() };
    
    registerSampleIpcHandlers(mockSettings);
    
    expect(mockIpcMain.handle).toHaveBeenCalledWith(
      "move-sample-in-kit",
      expect.any(Function)
    );
    // Don't test what the handler does, just that it's registered
  });
});
```

#### Handler Logic Tests (Integration)
Test the actual handler functionality with real services:
```typescript
describe("Sample IPC Handlers (Integration)", () => {
  it("should move sample within kit", async () => {
    const handler = createSampleMoveHandler(testDb);
    
    const result = await handler(event, {
      fromSlot: 1,
      toSlot: 2,
      kitName: "TestKit"
    });
    
    expect(result.success).toBe(true);
    // Verify actual database state changed
  });
});
```

## Test Organization

### File Structure and Naming
```typescript
// ✅ CORRECT: Test files in __tests__ directories
app/renderer/components/
├── KitEditor.tsx
├── hooks/
│   ├── useKitEditor.ts
│   └── __tests__/
│       └── useKitEditor.test.ts    // Test for the hook
└── __tests__/
    └── KitEditor.test.tsx          // Test for the component

// ✅ CORRECT: Service test naming
electron/main/services/
├── sampleService.ts
└── __tests__/
    └── sampleService.test.ts       // Test for the service

// Test naming convention: [filename].test.[ts|tsx]
// For services: The unit test file for "thisService.ts" should be "__tests__/thisService.test.ts"
```

### Test Structure Pattern
```typescript
// ✅ CORRECT: Clear test organization
describe('useKitEditor', () => {
  let mockDb: ReturnType<typeof vi.fn>;
  
  beforeEach(() => {
    mockDb = vi.fn();
    vi.mocked(window.electron.db).mockReturnValue(mockDb);
  });

  afterEach(() => {
    vi.clearAllMocks();
    cleanup(); // Clear DOM after each test
  });

  describe('when kit is editable', () => {
    it('should allow adding samples to voice slots', async () => {
      // Arrange
      const mockKit = { name: 'A0', editable: true };
      mockDb.getKit = vi.fn().mockResolvedValue({ success: true, data: mockKit });
      
      // Act
      const { result } = renderHook(() => useKitEditor('A0'));
      await act(async () => {
        await result.current.addSample('/path/to/kick.wav', 1, 1);
      });
      
      // Assert
      expect(mockDb.addSample).toHaveBeenCalledWith('A0', '/path/to/kick.wav', 1, 1);
    });
  });

  describe('error handling', () => {
    it('should handle database errors gracefully', async () => {
      mockDb.getKit = vi.fn().mockResolvedValue({ 
        success: false, 
        error: 'Database error' 
      });
      
      const { result } = renderHook(() => useKitEditor('A0'));
      
      expect(result.current.error).toBe('Database error');
    });
  });
});
```

## Mock Strategy

### Centralized Mocks (vitest.setup.ts)
```typescript
// ✅ Use centralized mocks, extend as needed
import { vi } from 'vitest';

// Global mock setup
vi.mock('../electron/main/db/romperDbCore', () => ({
  getKit: vi.fn(),
  addSample: vi.fn(),
  updateKit: vi.fn(),
}));

// In individual test files - extend global mocks
beforeEach(() => {
  vi.mocked(getKit).mockResolvedValue({ 
    success: true, 
    data: { name: 'A0', editable: true } 
  });
});
```

### Dependency Injection Testing
```typescript
// ✅ CORRECT: Test hooks with dependency injection
it('should handle scan errors with custom toast', async () => {
  const mockToast = {
    success: vi.fn(),
    error: vi.fn(),
  };
  
  const mockFileReader = {
    scanDirectory: vi.fn().mockRejectedValue(new Error('Scan failed')),
  };

  const { result } = renderHook(() => 
    useKitScan('/path/to/store', { 
      toast: mockToast, 
      fileReader: mockFileReader 
    })
  );

  await act(async () => {
    try {
      await result.current.scanKits();
    } catch (error) {
      // Expected to throw
    }
  });

  expect(mockToast.error).toHaveBeenCalledWith('Scan failed');
});
```

## Coverage Requirements

### 80% Minimum Coverage
- **Statements**: 80% minimum
- **Branches**: 80% minimum  
- **Functions**: 80% minimum
- **Lines**: 80% minimum

### Coverage Report Types

The project uses three coverage report formats via Vitest:

```typescript
// vite.config.ts coverage configuration
coverage: {
  enabled: true,
  reporter: ["json", "html", "text-summary"],
  reportsDirectory: "./coverage",
}
```

**Usage Guidelines:**

1. **text-summary** (Console Output)
   - **Primary**: Token-efficient summary for quick analysis
   - **Use case**: First review by both humans and agents
   - **Format**: Printed to console during test runs
   - **Content**: Overall percentages and totals

2. **html** (Human Interface) 
   - **Target**: Human developers
   - **Use case**: Detailed line-by-line analysis and investigation
   - **Location**: `./coverage/index.html`
   - **Features**: Interactive browsing, visual highlighting, drill-down navigation

3. **json** (Machine Readable)
   - **Target**: Agents and automated analysis
   - **Use case**: Programmatic processing when blow-by-blow information needed
   - **Location**: `./coverage/coverage-final.json`
   - **Content**: Complete coverage data for all files, functions, branches, and lines

**Agent Coverage Analysis Workflow:**
1. Review `text-summary` output first for overall coverage status
2. If detailed analysis needed, parse `json` report for specific uncovered lines/functions
3. Prioritize lowest coverage files for test implementation
4. Focus on improving function coverage (often lowest) before statement coverage

### Test Categories
```typescript
// ✅ Test both happy path and error conditions
describe('addSample', () => {
  // Happy path
  it('should successfully add valid sample', async () => {
    // Test successful operation
  });

  // Error conditions
  it('should reject invalid file paths', async () => {
    // Test path validation
  });

  it('should handle database errors', async () => {
    // Test error handling
  });

  it('should validate voice/slot constraints', async () => {
    // Test business rule validation
  });
});
```

## Isolation and Cleanup

### Test Isolation Requirements
```typescript
// ✅ CORRECT: Proper test isolation
describe('Component tests', () => {
  beforeEach(() => {
    // Fresh setup for each test
    vi.clearAllMocks();
    
    // Reset DOM state
    document.body.innerHTML = '';
    
    // Reset any global state
    localStorage.clear();
  });

  afterEach(() => {
    // Clean up after each test
    cleanup(); // React Testing Library cleanup
    vi.restoreAllMocks();
  });
});

// ❌ WRONG: Tests that depend on each other
describe('Bad tests', () => {
  let sharedState = {};
  
  it('first test', () => {
    sharedState.value = 'test1'; // Modifies shared state
  });
  
  it('second test', () => {
    expect(sharedState.value).toBe('test1'); // Depends on first test
  });
});
```

## React Component Testing

### Testing Library Best Practices
```typescript
// ✅ CORRECT: Test user interactions, not implementation
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

it('should toggle edit mode when button is clicked', async () => {
  const user = userEvent.setup();
  const mockOnSave = vi.fn();
  
  render(<KitEditor kitName="A0" onSave={mockOnSave} />);
  
  const editButton = screen.getByRole('button', { name: /edit/i });
  await user.click(editButton);
  
  expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
});

// ❌ WRONG: Testing implementation details
it('should set state when method is called', () => {
  const wrapper = render(<KitEditor />);
  const instance = wrapper.instance();
  
  instance.toggleEditMode(); // Testing internal method
  expect(instance.state.editable).toBe(true); // Testing internal state
});
```

## Database Testing

### Integration Test Patterns
```typescript
// ✅ CORRECT: Database integration tests
describe('romperDbCore integration', () => {
  let testDb: BetterSQLite3Database;
  
  beforeEach(() => {
    // Create in-memory test database
    testDb = new Database(':memory:');
    // Apply schema
    initializeDatabase(testDb);
  });

  afterEach(() => {
    testDb.close();
  });

  it('should create kit with samples', () => {
    const kit = { name: 'A0', editable: true };
    const sample = { 
      kitName: 'A0', 
      sourcePath: '/test/kick.wav',
      voiceNumber: 1,
      slotNumber: 1 
    };

    const kitResult = createKit(testDb, kit);
    expect(kitResult.success).toBe(true);

    const sampleResult = addSample(testDb, sample);
    expect(sampleResult.success).toBe(true);

    const retrieved = getKitWithSamples(testDb, 'A0');
    expect(retrieved.success).toBe(true);
    expect(retrieved.data?.samples).toHaveLength(1);
  });
});
```

## Anti-Patterns to Avoid

### Testing Implementation Details
```typescript
// ❌ AVOID: Testing internal implementation
it('should call useState with correct initial value', () => {
  const useStateSpy = vi.spyOn(React, 'useState');
  render(<Component />);
  expect(useStateSpy).toHaveBeenCalledWith(false);
});

// ✅ CORRECT: Testing behavior
it('should display initial state correctly', () => {
  render(<Component />);
  expect(screen.getByText('Initial State')).toBeInTheDocument();
});
```

### Complex Test Setup
```typescript
// ❌ AVOID: Overly complex test setup
it('should work with complex setup', () => {
  const mockA = vi.fn();
  const mockB = vi.fn();
  const mockC = vi.fn();
  // ... 20 more mocks
  // Test becomes hard to understand
});

// ✅ CORRECT: Focused test with minimal setup
it('should add sample when valid path provided', () => {
  const mockAddSample = vi.fn().mockResolvedValue({ success: true });
  
  // Single, clear mock for what we're testing
});
```

## Quick Validation Checklist

- [ ] Tests in `__tests__/` directories with `.test.ts/.test.tsx` naming
- [ ] Proper beforeEach/afterEach cleanup
- [ ] Tests isolated and independent
- [ ] Both happy path and error conditions tested
- [ ] Mocks focused on behavior, not implementation
- [ ] Coverage meets 80% minimum threshold
- [ ] Descriptive test names explaining behavior
- [ ] Using centralized mocks from vitest.setup.ts
- [ ] React components tested via user interactions
- [ ] Database tests use in-memory test database

---

*These standards apply to test files in `**/__tests__/*.test.ts` and `**/__tests__/*.test.tsx` using Vitest and React Testing Library.*