# SonarQube Issues Task List - Romper Sample Manager

**Generated**: 2025-08-02  
**Total Issues**: 487 (195 Open, 292 Closed)  
**Project**: peteb4ker_romper

## Summary by Severity

| Severity | Open | Closed | Total |
|----------|------|--------|-------|
| **BLOCKER** | 8 | 4 | 12 |
| **CRITICAL** | 24 | 56 | 80 |
| **MAJOR** | 114 | 150 | 264 |
| **MINOR** | 49 | 82 | 131 |
| **INFO** | 0 | 0 | 0 |

---

## BLOCKER Issues (Must Fix Immediately)

### Missing Test Assertions (typescript:S2699)

- [ ] **Fix test assertion in KitVoicePanels.test.tsx:137**
  - File: `app/renderer/components/__tests__/KitVoicePanels.test.tsx`
  - Action: Add expect() assertions to test case at line 137

- [ ] **Fix test assertion in useKitScan.test.ts:74**
  - File: `app/renderer/components/hooks/__tests__/useKitScan.test.ts`
  - Action: Add expect() assertions to test case at line 74

- [ ] **Fix test assertion in useSampleManagement.test.ts:743**
  - File: `app/renderer/components/hooks/__tests__/useSampleManagement.test.ts`
  - Action: Add expect() assertions to test case at line 743

- [ ] **Fix test assertion in useSampleManagement.test.ts:767**
  - File: `app/renderer/components/hooks/__tests__/useSampleManagement.test.ts`
  - Action: Add expect() assertions to test case at line 767

- [ ] **Fix test assertion in useSampleManagement.test.ts:783**
  - File: `app/renderer/components/hooks/__tests__/useSampleManagement.test.ts`
  - Action: Add expect() assertions to test case at line 783

- [ ] **Fix test assertion in useSampleManagement.test.ts:805**
  - File: `app/renderer/components/hooks/__tests__/useSampleManagement.test.ts`
  - Action: Add expect() assertions to test case at line 805

- [ ] **Fix test assertion in useSampleManagement.test.ts:818**
  - File: `app/renderer/components/hooks/__tests__/useSampleManagement.test.ts`
  - Action: Add expect() assertions to test case at line 818

- [ ] **Fix test assertion in useSampleManagement.test.ts:846**
  - File: `app/renderer/components/hooks/__tests__/useSampleManagement.test.ts`
  - Action: Add expect() assertions to test case at line 846

---

## CRITICAL Issues (High Priority)

### Cognitive Complexity Violations (typescript:S3776)

- [ ] **Refactor inferVoiceTypeFromFilename in kitUtilsShared.ts (Complexity: 36)**
  - File: `shared/kitUtilsShared.ts:78`
  - Action: Extract complex voice type inference logic into separate functions

- [ ] **Refactor moveFilesToTargetDirectory in fileOperations.ts (Complexity: 28)**
  - File: `electron/main/db/fileOperations.ts:12`
  - Action: Break down file moving logic into smaller functions

- [ ] **Refactor KitsView component (Complexity: 24)**
  - File: `app/renderer/views/KitsView.tsx:394`
  - Action: Extract complex conditional rendering into sub-components

- [ ] **Refactor scanAndStoreKitData in databaseScanning.ts (Complexity: 27)**
  - File: `app/renderer/components/utils/databaseScanning.ts:63`
  - Action: Split into separate scan and store functions

- [ ] **Refactor calculateValidationResults in useValidationResults.ts (Complexity: 24)**
  - File: `app/renderer/components/hooks/useValidationResults.ts:98`
  - Action: Extract validation logic into separate utility functions

- [ ] **Refactor scanAndProcessWavFiles in scanService.ts (Complexity: 22)**
  - File: `electron/main/services/scanService.ts:40`
  - Action: Separate scanning from processing logic

- [ ] **Refactor processExistingKitData in databaseScanning.ts (Complexity: 20)**
  - File: `app/renderer/components/utils/databaseScanning.ts:232`
  - Action: Extract data processing steps into helper functions

- [ ] **Refactor handleKitScan in useKitScan.ts (Complexity: 20)**
  - File: `app/renderer/components/hooks/useKitScan.ts:56`
  - Action: Break down scan handling into discrete steps

- [ ] **Refactor VoicePanelsLogic in useKitVoicePanels.ts (Complexity: 17)**
  - File: `app/renderer/components/hooks/useKitVoicePanels.ts:55`
  - Action: Simplify panel logic with early returns

- [ ] **Refactor LocalStoreWizardUI component (Complexity: 16)**
  - File: `app/renderer/components/LocalStoreWizardUI.tsx:31`
  - Action: Extract wizard steps into separate components

- [ ] **Refactor processWavFile in orchestrationFunctions.ts (Complexity: 16)**
  - File: `app/renderer/components/utils/scanners/orchestrationFunctions.ts:39`
  - Action: Separate wav processing concerns

- [ ] **Refactor scanSampleFiles in orchestrationFunctions.ts (Complexity: 16)**
  - File: `app/renderer/components/utils/scanners/orchestrationFunctions.ts:143`
  - Action: Break down sample scanning logic

- [ ] **Refactor processFiles in orchestrator.ts (Complexity: 16)**
  - File: `app/renderer/components/utils/scanners/orchestrator.ts:30`
  - Action: Simplify file processing pipeline

### Other Critical Issues

- [ ] **Remove empty type intersection in KitIconRenderer.tsx:15**
  - File: `app/renderer/components/shared/KitIconRenderer.tsx`
  - Action: Remove `& {}` from type definition

- [ ] **Reduce nesting depth in archiveUtils.ts:41**
  - File: `electron/main/archiveUtils.ts`
  - Action: Use early returns to reduce nesting

- [ ] **Reduce nesting depth in archiveUtils.ts:104**
  - File: `electron/main/archiveUtils.ts`
  - Action: Extract nested logic to separate function

- [ ] **Reduce nesting depth in archiveUtils.ts:109**
  - File: `electron/main/archiveUtils.ts`
  - Action: Refactor conditional logic

- [ ] **Reduce nesting depth in useKitStepSequencer.ts:18**
  - File: `app/renderer/components/hooks/useKitStepSequencer.ts`
  - Action: Simplify nested conditionals

---

## MAJOR Issues (Medium Priority)

### Accessibility Issues

- [ ] **Fix interactive element in KitGridItem.tsx:95-108**
  - File: `app/renderer/components/KitGridItem.tsx`
  - Action: Replace div with button, add keyboard support

- [ ] **Fix interactive element in KitItem.tsx:44-58**
  - File: `app/renderer/components/KitItem.tsx`
  - Action: Replace div with button, add ARIA attributes

- [ ] **Fix interactive element in KitList.tsx:256-262**
  - File: `app/renderer/components/KitList.tsx`
  - Action: Use proper button element with accessibility

- [ ] **Fix interactive element in PreferencesDialog.tsx:87-90**
  - File: `app/renderer/components/dialogs/PreferencesDialog.tsx`
  - Action: Replace div with accessible button

### Promise Handling Issues

- [ ] **Fix promise in boolean context in SampleWaveform.tsx:88**
  - File: `app/renderer/components/SampleWaveform.tsx`
  - Action: Add await to promise call

- [ ] **Fix promise in boolean context in SampleWaveform.tsx:221**
  - File: `app/renderer/components/SampleWaveform.tsx`
  - Action: Add await to promise call

- [ ] **Add await in try block in SampleWaveform.tsx:86**
  - File: `app/renderer/components/SampleWaveform.tsx`
  - Action: Properly await async operation

- [ ] **Add await in try block in SampleWaveform.tsx:219**
  - File: `app/renderer/components/SampleWaveform.tsx`
  - Action: Properly await async operation

- [ ] **Fix promise where void expected in KitDetails.tsx:14**
  - File: `app/renderer/components/KitDetails.tsx`
  - Action: Handle promise properly or make function async

- [ ] **Fix promise where void expected in useKitDetailsLogic.ts:15**
  - File: `app/renderer/components/hooks/useKitDetailsLogic.ts`
  - Action: Handle promise properly or make function async

### Form Label Association Issues

- [ ] **Associate label with control in PreferencesDialog.tsx:159**
  - File: `app/renderer/components/dialogs/PreferencesDialog.tsx`
  - Action: Add htmlFor attribute to label

- [ ] **Associate label with control in PreferencesDialog.tsx:177**
  - File: `app/renderer/components/dialogs/PreferencesDialog.tsx`
  - Action: Add htmlFor attribute to label

- [ ] **Associate label with control in PreferencesDialog.tsx:191**
  - File: `app/renderer/components/dialogs/PreferencesDialog.tsx`
  - Action: Add htmlFor attribute to label

- [ ] **Associate label with control in PreferencesDialog.tsx:199**
  - File: `app/renderer/components/dialogs/PreferencesDialog.tsx`
  - Action: Add htmlFor attribute to label

- [ ] **Associate label with control in PreferencesDialog.tsx:310**
  - File: `app/renderer/components/dialogs/PreferencesDialog.tsx`
  - Action: Add htmlFor attribute to label

- [ ] **Associate label with control in PreferencesDialog.tsx:331**
  - File: `app/renderer/components/dialogs/PreferencesDialog.tsx`
  - Action: Add htmlFor attribute to label

- [ ] **Associate label with control in LocalStoreWizardUI.tsx:164**
  - File: `app/renderer/components/LocalStoreWizardUI.tsx`
  - Action: Add htmlFor attribute to label

- [ ] **Associate label with control in WizardSourceStep.tsx:52**
  - File: `app/renderer/components/wizard/WizardSourceStep.tsx`
  - Action: Add htmlFor attribute to label

### SQL Query Issues

- [ ] **Replace SELECT * in migration at line 42**
  - File: `electron/main/db/migrations/0001_foamy_malcolm_colcord.sql`
  - Action: Specify column names explicitly

- [ ] **Replace SELECT * in migration at line 44**
  - File: `electron/main/db/migrations/0001_foamy_malcolm_colcord.sql`
  - Action: Specify column names explicitly

- [ ] **Replace SELECT * in migration at line 46**
  - File: `electron/main/db/migrations/0001_foamy_malcolm_colcord.sql`
  - Action: Specify column names explicitly

- [ ] **Replace SELECT * in migration at line 110**
  - File: `electron/main/db/migrations/0001_foamy_malcolm_colcord.sql`
  - Action: Specify column names explicitly

- [ ] **Replace SELECT * in migration at line 112**
  - File: `electron/main/db/migrations/0001_foamy_malcolm_colcord.sql`
  - Action: Specify column names explicitly

- [ ] **Replace SELECT * in migration at line 114**
  - File: `electron/main/db/migrations/0001_foamy_malcolm_colcord.sql`
  - Action: Specify column names explicitly

### Code Organization Issues (Count: 75 total)

- [ ] **Remove unused PropTypes (47 occurrences)**
  - Action: Identify and remove unused prop type definitions

- [ ] **Fix array index as React keys (8 occurrences)**
  - Action: Use stable identifiers instead of array indices

- [ ] **Simplify nested ternary operators (10 occurrences)**
  - Action: Extract complex ternaries to if/else or separate variables

- [ ] **Add optional chaining (8 occurrences)**
  - Action: Use ?. operator where appropriate

- [ ] **Mark readonly members (2 occurrences)**
  - Action: Add readonly modifier to never-reassigned members

---

## MINOR Issues (Low Priority)

### useState Destructuring Issues

- [ ] **Destructure useState in KitVoicePanel.tsx:113**
  - File: `app/renderer/components/KitVoicePanel.tsx`
  - Action: Add setter to useState destructuring

- [ ] **Destructure useState in SampleWaveform.tsx:28**
  - File: `app/renderer/components/SampleWaveform.tsx`
  - Action: Add setter to useState destructuring

- [ ] **Destructure useState in useStepPattern.ts:17**
  - File: `app/renderer/components/hooks/useStepPattern.ts`
  - Action: Add setter to useState destructuring

- [ ] **Destructure useState in TestSettingsProvider.tsx:10**
  - File: `app/renderer/views/__tests__/TestSettingsProvider.tsx`
  - Action: Add setter to useState destructuring

- [ ] **Destructure useState in TestSettingsProvider.tsx:12**
  - File: `app/renderer/views/__tests__/TestSettingsProvider.tsx`
  - Action: Add setter to useState destructuring

- [ ] **Destructure useState in TestSettingsProvider.tsx:13**
  - File: `app/renderer/views/__tests__/TestSettingsProvider.tsx`
  - Action: Add setter to useState destructuring

- [ ] **Destructure useState in TestSettingsProvider.tsx:14**
  - File: `app/renderer/views/__tests__/TestSettingsProvider.tsx`
  - Action: Add setter to useState destructuring

### Other Minor Issues

- [ ] **Remove boolean literal in TestSettingsProvider.tsx:37**
  - File: `app/renderer/views/__tests__/TestSettingsProvider.tsx`
  - Action: Simplify boolean expression

- [ ] **Use for-of loop in localStoreWizard.e2e.test.ts:69-70**
  - File: `app/renderer/components/hooks/__e2e__/localStoreWizard.e2e.test.ts`
  - Action: Replace traditional for loop with for-of

---

## Execution Instructions for Agents

1. **Start with BLOCKER issues** - These prevent tests from working properly
2. **For each task:**
   - Read the file at the specified line
   - Apply the suggested fix
   - Run tests to ensure nothing breaks
   - Mark the checkbox as complete
3. **Run `npm run lint` and `npm run test` after each fix**
4. **Commit changes in logical groups** (e.g., all test assertions together)
5. **Update this checklist as tasks are completed**

## Progress Tracking

- Total Open Issues: 195
- Completed This Session: 0
- Remaining: 195

Last Updated: 2025-08-02