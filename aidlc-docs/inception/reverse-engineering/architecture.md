# System Architecture

## System Overview
Romper follows a three-layer Electron architecture with strict separation between main process (Node.js backend), preload bridge (secure IPC), and renderer (React UI). Data flows unidirectionally through IPC channels with consistent error handling via the DbResult pattern.

## Architecture Layers

### Layer 1: Electron Main Process (electron/main/)
- Window management, IPC server, database access, file operations, settings, audio processing
- Key services: database (Drizzle ORM/SQLite), sample management, sync, scanning, local store validation, archive

### Layer 2: Preload Bridge (electron/preload/index.ts)
- Context-isolated, type-safe IPC bridge exposing 100+ methods via contextBridge
- Handles menu event forwarding and settings management
- Security: nodeIntegration=false, contextIsolation=true

### Layer 3: React Renderer (app/renderer/)
- Hook-based architecture: all business logic in custom hooks, thin presentation components
- Views: KitsView (main orchestrator), AboutView
- Components organized by domain: kit-management, sample-management, voice-panels, wizard, shared

## Data Flow Pattern
```
User Action -> React Component -> Custom Hook -> IPC Call (electronAPI)
-> Main Process Handler -> Service Layer -> Database/File System
-> Response via IPC -> Hook State Update -> Component Re-render
```

## Key Architectural Patterns

### Reference-Only Sample Architecture
Stores absolute source_path in database, never copies files locally. Files only copied to SD card during sync.

### Natural Keys
Kit names (A0, B1) as primary keys instead of sequential IDs. Direct correspondence to Rample hardware naming.

### Explicit Voice Tracking
voice_number (1-4) stored explicitly in every record. Never inferred from position or order.

### Hook-Based Business Logic
All logic in use* custom hooks. Components remain thin rendering shells. Hooks compose for complex operations.

### Event-Driven Undo/Redo
Records action metadata, dispatches refresh events. Database is source of truth for state restoration.

### Synchronous Database with Async IPC
better-sqlite3 provides synchronous DB access. IPC layer is async. No race conditions in DB operations.

## Database
- SQLite via Drizzle ORM + better-sqlite3
- 4 tables: banks, kits, voices, samples
- 12 migrations tracking schema evolution
- Natural keys, composite unique constraints, JSON columns for patterns/conditions
