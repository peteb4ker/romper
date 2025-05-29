# Product Requirements Document (PRD)

## Romper: Rample SD Card Manager

### 1. SD Card Management
- 1.1. Detect and select SD card
- 1.2. List kits on SD card
- 1.3. Scan SD card for kits and samples
- 1.4. Refresh kit and sample lists

### 2. Kit Browser & Navigation
- 2.1. Display all kits in a sortable, filterable list
- 2.2. Show kit metadata (labels, sample counts, voice names)
- 2.3. Bank navigation and anchor scrolling
- 2.4. Select a kit to view/edit details
- 2.5. Duplicate kit
- 2.6. Create new kit (manual slot or next available)

### 3. Kit Details & Editing
- 3.1. View kit details (voice names, samples, plan)
- 3.2. Kit plans to map between any source file and target kit / voice slots
 - 3.2.1 Adding / editing a kit plan slides a gutter up from the bottom of the screen containing the plan
 - 3.2.2 Plans are autosaved in the global labels file. Saving a plan does not commit the plan.
 - 3.2.3 Dragging and dropping one or more samples onto a voice in a plan adds the path of the source sample(s) to the plan.  This is immediately reflected in the UI.
 - 3.2.3 Plans can be committed by the user via a button click at any time.
 - 3.2.5 When committing a kit plan, samples are written to the SD card in the correct WAV, folder and filename format.
 - 3.2.6 Kits with plans have a yellow plan indicator on the main kit list.
 - 3.2.7 The drop target for samples is the entire voice
 - 3.2.8 The sample number is indicated for each sample, from 1-12.
 - 3.2.9 A maximum of 12 samples can be added to a voice.  A warning message is shown when more than 12 samples are added.
 - 3.2.10 If a user drops multiple samples on a voice, some of those samples can be used to fill the 12 slots, the plan is saved and beyond that, the samples are ignored and a warning message is shown.
 - 3.2.11 Samples can be rearranged
- 3.3. Edit kit metadata (voice names, labels)
- 3.4. Rescan voice names (single/all)
- 3.5. Play/stop sample preview

### 4. File & Sample Management
- 4.1. List samples per kit/voice
- 4.2. Drag-and-drop sample assignment
- 4.3. Highlight duplicate samples in plan
- 4.4. Show sample waveform preview

### 5. Settings & Persistence
- 5.1. Read/write settings (SD card path, theme, etc.)
- 5.2. Persist kit labels and voice names to file in root of SD card
 - 5.2.1 Summarize and log changes made to the file on each write.
- 5.3. Dark mode/theme toggle

### 6. UI/UX
- 6.1. Responsive, modern UI (Tailwind, React)
- 6.2. Keyboard and mouse navigation
- 6.3. Error and warning display (missing SD, invalid kit, etc.)
- 6.4. About view (version, license, GitHub, feedback)

### 7. Electron Integration
- 7.1. Preload script for secure API exposure
- 7.2. IPC for all file and SD card operations
- 7.3. Main process: window management, settings, IPC handler registration

### 8. Testing & Quality
- 8.1. Unit tests for all logic, hooks, and UI components
- 8.2. Isolated, DRY test setup (mocks, cleanup)
- 8.3. Coverage reporting and enforcement

---

**Note:**
- All features are implemented with a focus on modularity, testability, and Electron security best practices.
- See `/src/renderer/components`, `/src/main`, `/src/preload`, and `/shared` for implementation details.
