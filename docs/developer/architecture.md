---
layout: default
title: Romper Architecture
---

# Romper Architecture

This document describes the core architectural patterns and design decisions in Romper.

## Application Architecture

### Electron Multi-Process Model
- **Main Process**: Database operations, file system access, IPC coordination
- **Renderer Process**: React UI, user interactions, audio playback
- **IPC Communication**: Type-safe communication between processes via Electron IPC

### Component Architecture
- **Hook-based Logic**: All business logic lives in custom hooks (`hooks/use<ComponentName>.ts`)
- **Presentation Components**: UI components contain only rendering logic and hook calls
- **Separation of Concerns**: Clear boundaries between data, logic, and presentation layers

## Data Architecture

### Database Layer (Drizzle ORM)
- **Schema-First Design**: Type-safe database operations with compile-time validation
- **Synchronous Driver**: better-sqlite3 for predictable, blocking database operations
- **Natural Keys**: Uses human-readable kit names (A0, B1, etc.) as foreign keys

### Data Flow Pattern
```
User Action → Hook → IPC → Main Process → Database → IPC → Hook → Component Update
```

### Key Database Entities
- **Kits**: Container for samples with metadata and editing state
- **Voices**: 4 voices per kit with optional aliases (kick, snare, etc.)
- **Samples**: Individual audio files organized by voice and slot

## Sample Management Architecture

### Reference-Only Storage
User-added samples are **referenced by absolute path** rather than copied locally. This enables:
- **Flexible file locations**: Samples can live anywhere on filesystem
- **No storage duplication**: Original files remain in place
- **Clean local store**: Prevents pollution of baseline content

### File Operations Flow
1. **Assignment**: Sample path stored in database (`source_path` field)
2. **Preview**: Direct playback from original file location
3. **Sync**: Copy from `source_path` to SD card with format conversion

### Local Store Initialization
During setup, Romper creates a local store from one of three sources (SD card, factory samples, or empty folder). This baseline remains unchanged - user modifications are tracked as references only.

## Kit Editing System

### Editable State Management
- **Kit-level editing mode**: Toggle between read-only and editable states
- **Modification tracking**: Track changes since last SD card sync
- **Action history**: Database-persisted undo/redo system

### Voice and Slot Organization
- **Fixed structure**: 4 voices per kit, up to 12 samples per voice
- **Explicit tracking**: `voice_number` field (1-4) for reliable identification
- **Flexible assignment**: Drag-and-drop sample assignment to any voice/slot

## Audio Processing Architecture

### Format Handling Strategy
- **Lazy conversion**: Format conversion only during SD card sync, not during editing
- **Preview accuracy**: Audio preview matches final Rample hardware behavior
- **Original preservation**: Source files never modified during operations

### Stereo Sample Logic
- **Global preference**: "Default to mono" setting affects new assignments
- **Per-sample override**: Individual samples can override global setting
- **Conflict resolution**: Handle stereo assignments that would conflict with existing samples

## Sync Operations Architecture

### Validation-First Approach
1. **Pre-sync validation**: Verify all referenced files exist and are accessible
2. **User confirmation**: Show exactly what will be copied/converted
3. **Atomic operations**: All-or-nothing sync with rollback on failure
4. **State synchronization**: Update database to reflect successful sync

### File System Safety
- **Path validation**: Sanitize and validate all file paths
- **Permission checking**: Verify access rights before operations
- **Atomic file operations**: Use proper locking and temporary files

## Error Handling Architecture

### Graceful Degradation
- **Functional continuity**: App remains usable when non-critical components fail
- **User communication**: Clear error messages with actionable guidance
- **Recovery mechanisms**: Automatic retry with exponential backoff where appropriate

### Data Protection
- **Validation layers**: Multiple validation points before destructive operations
- **Backup strategies**: Automatic backups before significant changes
- **Reference integrity**: Handle missing or moved files gracefully

## Performance Architecture

### UI Responsiveness
- **Sub-50ms target**: All user interactions should respond within 50ms
- **Memoization strategy**: Cache expensive computations (kit metadata, voice labels)
- **Efficient rendering**: React.memo, useMemo, virtualization for large lists

### Database Performance
- **Prepared statements**: Drizzle ORM uses prepared statements for common queries
- **Batch operations**: Group related database operations for efficiency
- **Strategic indexing**: Optimize for common query patterns

## Testing Architecture

### Test Organization
- **Co-located tests**: Unit tests in `__tests__/` directories next to source code
- **Test isolation**: Each test file is independent with proper cleanup
- **Mock strategy**: Centralized mocks in `vitest.setup.ts`, extended as needed

### Coverage Strategy
- **80% coverage requirement**: Maintain high test coverage across codebase
- **Unit vs Integration**: Clear separation between fast unit tests and comprehensive integration tests
- **Dependency mocking**: Test only the code under test, mock all dependencies

## Security Architecture

### File System Security
- **Path validation**: Prevent directory traversal and unauthorized access
- **Input sanitization**: Validate all user-provided file paths and names
- **Secure defaults**: Fail securely when validation fails

### Data Integrity
- **Database constraints**: Schema-level validation for data consistency
- **Transaction boundaries**: Group related operations for atomicity
- **Reference validation**: Verify file existence before critical operations

---

*This architecture provides a foundation for safe, efficient sample management while maintaining clear separation of concerns and excellent user experience.*