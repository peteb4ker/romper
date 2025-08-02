# SonarQube Issues - Romper Sample Manager

This document tracks all currently OPEN SonarQube issues in the peteb4ker_romper project as of August 2, 2025.

## Issue Summary

- **Total Open Issues**: 149
- **Blockers**: 0
- **Critical**: 19 
- **Major**: 70
- **Minor**: 60
- **Info**: 0

## Blockers (0 issues)
No blocker issues currently open.

## Critical Issues (19 issues)

### Cognitive Complexity Violations
1. **AZhreN56MqCIInWtHM26** - `KitVoicePanel.tsx:1062` - Use `<select size=...>`, `<select multiple=...>`, or `<datalist>` instead of "listbox" role (S6819)
2. **AZherD35NWDmi-A-qXnR** - `useValidationResults.ts:98` - Cognitive complexity 24->15 (S3776)
3. **AZherD2vNWDmi-A-qXnI** - `useKitScan.ts:56` - Cognitive complexity 20->15 (S3776)
4. **AZherDxlNWDmi-A-qXmR** - `scanService.ts:40` - Cognitive complexity 22->15 (S3776)
5. **AZherEFTNWDmi-A-qXrr** - `KitsView.tsx:394` - Cognitive complexity 24->15 (S3776)
6. **AZherECmNWDmi-A-qXqh** - `LocalStoreWizardUI.tsx:31` - Cognitive complexity 16->15 (S3776)
7. **AZherD-YNWDmi-A-qXol** - `orchestrationFunctions.ts:39` - Cognitive complexity 16->15 (S3776)
8. **AZherD-YNWDmi-A-qXom** - `orchestrationFunctions.ts:143` - Cognitive complexity 16->15 (S3776)
9. **AZherD-MNWDmi-A-qXoj** - `orchestrator.ts:30` - Cognitive complexity 16->15 (S3776)
10. **AZherD--NWDmi-A-qXop** - `databaseScanning.ts:63` - Cognitive complexity 27->15 (S3776)
11. **AZherD--NWDmi-A-qXoq** - `databaseScanning.ts:232` - Cognitive complexity 20->15 (S3776)
12. **AZherD4FNWDmi-A-qXnS** - `useKitVoicePanels.ts:55` - Cognitive complexity 17->15 (S3776)
13. **AZherDx-NWDmi-A-qXmV** - `fileOperations.ts:12` - Cognitive complexity 28->15 (S3776)
14. **AZherEHONWDmi-A-qXr_** - `kitUtilsShared.ts:78` - Cognitive complexity 36->15 (S3776)
15. **AZherD3iNWDmi-A-qXnO** - `useKitStepSequencer.ts:18` - Refactor nested functions >4 levels (S2004)

### Archive Utils Deep Nesting
16. **AZherDzpNWDmi-A-qXmr** - `archiveUtils.ts:41` - Refactor nested functions >4 levels (S2004)
17. **AZherDzpNWDmi-A-qXms** - `archiveUtils.ts:104` - Refactor nested functions >4 levels (S2004)
18. **AZherDzpNWDmi-A-qXmt** - `archiveUtils.ts:109` - Refactor nested functions >4 levels (S2004)

### Sort Operations
19. **AZherEHONWDmi-A-qXr-** - `kitUtilsShared.ts:26` - Provide String.localeCompare for sort (S2871)

## Major Issues (70 issues)

### Accessibility Issues (13 issues)
1. **AZhreN56MqCIInWtHM22** - `KitVoicePanel.tsx:786` - Use `<option>` instead of "option" role (S6819)
2. **AZhreN56MqCIInWtHM23** - `KitVoicePanel.tsx:789` - Non-interactive elements shouldn't have interactive roles (S6842)
3. **AZhreN56MqCIInWtHM24** - `KitVoicePanel.tsx:908` - Use `<option>` instead of "option" role (S6819)
4. **AZhreN56MqCIInWtHM25** - `KitVoicePanel.tsx:915` - Non-interactive elements shouldn't have interactive roles (S6842)
5. **AZhreN56MqCIInWtHM27** - `KitVoicePanel.tsx:1065` - Non-interactive elements shouldn't have interactive roles (S6842)
6. **AZherEBzNWDmi-A-qXp_** - `KitVoicePanel.tsx:978` - Use `<section aria-label=...>` instead of "region" role (S6819)
7. **AZherEBJNWDmi-A-qXp3** - `KitGridItem.tsx:95` - Avoid non-native interactive elements (S6848)
8. **AZherEBJNWDmi-A-qXp5** - `KitGridItem.tsx:105` - `tabIndex` only on interactive elements (S6845)
9. **AZherD__NWDmi-A-qXo5** - `PreferencesDialog.tsx:87` - Avoid non-native interactive elements (S6848)
10. **AZherD__NWDmi-A-qXo7** - `PreferencesDialog.tsx:159` - Form label must be associated with control (S6853)
11. **AZherD__NWDmi-A-qXo8** - `PreferencesDialog.tsx:177` - Form label must have accessible text (S6853)
12. **AZherD__NWDmi-A-qXo9** - `PreferencesDialog.tsx:191` - Form label must be associated with control (S6853)
13. **AZherD__NWDmi-A-qXo-** - `PreferencesDialog.tsx:199` - Form label must have accessible text (S6853)

### React Performance Issues (5 issues)
1. **AZherEESNWDmi-A-qXrY** - `SettingsContext.tsx:304` - Context value changes every render (S6481)
2. **AZherEEeNWDmi-A-qXrd** - `TestSettingsProvider.tsx:33` - Context value changes every render (S6481)
3. **AZherEBWNWDmi-A-qXpq** - `KitList.tsx:223` - Move component definition out of parent (S6478)
4. **AZherD-MNWDmi-A-qXoh** - `orchestrator.ts:14` - Mark 'progressCallback' as readonly (S2933)
5. **AZherD-MNWDmi-A-qXoi** - `orchestrator.ts:15` - Mark 'errorStrategy' as readonly (S2933)

### Code Structure Issues (16 issues)
1. **AZhjbZZmekZkHoMWn1Fh** - `SampleWaveform.tsx:86` - Use 'await' for promise in 'try' (S4822)
2. **AZhjbZZmekZkHoMWn1Fi** - `SampleWaveform.tsx:219` - Use 'await' for promise in 'try' (S4822)
3. **AZherEAwNWDmi-A-qXpY** - `KitVoicePanels.tsx:114` - Provide multiple methods instead of using "isStereo" (S2301)
4. **AZherECZNWDmi-A-qXqf** - `KitDetails.tsx:14` - Promise-returning method where void expected (S6544)
5. **AZherD28NWDmi-A-qXnJ** - `useKitDetailsLogic.ts:15` - Promise-returning method where void expected (S6544)
6. **AZherDxYNWDmi-A-qXmQ** - `archiveService.ts:137` - Use optional chain expression (S6582)
7. **AZherD3JNWDmi-A-qXnL** - `useKitStepSequencerLogic.ts:213` - Use optional chain expression (S6582)
8. **AZherD0uNWDmi-A-qXm4** - `useKitBrowser.ts:221` - Use optional chain expression (S6582)
9. **AZherEFTNWDmi-A-qXrs** - `KitsView.tsx:458` - Use optional chain expression (S6582)
10. **AZherEGCNWDmi-A-qXrx** - `config.ts:16` - Use optional chain expression (S6582)
11. **AZherEGCNWDmi-A-qXry** - `config.ts:23` - Use optional chain expression (S6582)
12. **AZherD9mNWDmi-A-qXob** - `WizardProgressBar.tsx:8` - Use optional chain expression (S6582)
13. **AZherD4FNWDmi-A-qXnT** - `useKitVoicePanels.ts:65` - 'If' not only statement in 'else' (S6660)
14. **AZherD4FNWDmi-A-qXnU** - `useKitVoicePanels.ts:75` - 'If' not only statement in 'else' (S6660)
15. **AZherD_KNWDmi-A-qXou** - `bankOperations.ts:54` - Use String.localeCompare for sort (S2871)
16. **AZherEHONWDmi-A-qXr9** - `kitUtilsShared.ts:26` - Move sort to separate statement (S4043)

### Array Key Issues (5 issues)
1. **AZherEC-NWDmi-A-qXqy** - `StepSequencerGrid.tsx:46` - Don't use Array index in keys (S6479)
2. **AZherD4dNWDmi-A-qXnb** - `localStoreWizard.e2e.test.ts:174` - Unexpected empty object pattern (S3799)
3. **AZherECANWDmi-A-qXqZ** - `KitItem.tsx:54` - `tabIndex` only on interactive elements (S6845)
4. **AZherEBWNWDmi-A-qXps** - `KitList.tsx:258` - `tabIndex` only on interactive elements (S6845)
5. **AZherEHONWDmi-A-qXsB** - `kitUtilsShared.ts:172` - Use String#startsWith method (S6557)

### UI/UX Issues (20 issues)
1. **AZherECANWDmi-A-qXqX** - `KitItem.tsx:44` - Avoid non-native interactive elements (S6848)
2. **AZherD__NWDmi-A-qXo6** - `PreferencesDialog.tsx:87` - Non-interactive elements need keyboard listener (S1082)
3. **AZherEBJNWDmi-A-qXp4** - `KitGridItem.tsx:95` - Non-interactive elements need keyboard listener (S1082)
4. **AZherECANWDmi-A-qXqY** - `KitItem.tsx:44` - Non-interactive elements need keyboard listener (S1082)
5. **AZherEBWNWDmi-A-qXpr** - `KitList.tsx:256` - Avoid non-native interactive elements (S6848)
6. **AZherEC-NWDmi-A-qXqw** - `StepSequencerGrid.tsx:35` - Avoid non-native interactive elements (S6848)
7. **AZherEC-NWDmi-A-qXqx** - `StepSequencerGrid.tsx:38` - `tabIndex` only on interactive elements (S6845)
8. **AZherECmNWDmi-A-qXqo** - `LocalStoreWizardUI.tsx:79` - Extract nested ternary operation (S3358)
9. **AZherECmNWDmi-A-qXqp** - `LocalStoreWizardUI.tsx:81` - Extract nested ternary operation (S3358)
10. **AZherECmNWDmi-A-qXqs** - `LocalStoreWizardUI.tsx:211` - Extract nested ternary operation (S3358)
11. **AZherECmNWDmi-A-qXqr** - `LocalStoreWizardUI.tsx:218` - Extract nested ternary operation (S3358)
12. **AZherEC-NWDmi-A-qXqz** - `StepSequencerGrid.tsx:91` - Extract nested ternary operation (S3358)
13. **AZherEC-NWDmi-A-qXq0** - `StepSequencerGrid.tsx:93` - Extract nested ternary operation (S3358)
14. **AZherD0gNWDmi-A-qXm2** - `KitBankNav.tsx:34` - Extract nested ternary operation (S3358)
15. **AZherD9NNWDmi-A-qXoX** - `WizardStepNav.tsx:44` - Extract nested ternary operation (S3358)
16. **AZherECmNWDmi-A-qXqq** - `LocalStoreWizardUI.tsx:164` - Form label must be associated with control (S6853)
17. **AZherD__NWDmi-A-qXo_** - `PreferencesDialog.tsx:310` - Form label must be associated with control (S6853)
18. **AZherD__NWDmi-A-qXpA** - `PreferencesDialog.tsx:331` - Form label must be associated with control (S6853)
19. **AZherD9ANWDmi-A-qXoU** - `WizardSourceStep.tsx:52` - Form label must be associated with control (S6853)
20. **AZherD-wNWDmi-A-qXoo** - `FilePickerButton.tsx:60` - Correct identical sub-expressions (S1764)

### SQL Issues (6 issues)
1. **AZherDyzNWDmi-A-qXmd** - `0001_foamy_malcolm_colcord.sql:42` - SELECT * should not be used (SelectStarCheck)
2. **AZherDyzNWDmi-A-qXme** - `0001_foamy_malcolm_colcord.sql:44` - SELECT * should not be used (SelectStarCheck)
3. **AZherDyzNWDmi-A-qXmf** - `0001_foamy_malcolm_colcord.sql:46` - SELECT * should not be used (SelectStarCheck)
4. **AZherDyzNWDmi-A-qXmg** - `0001_foamy_malcolm_colcord.sql:110` - SELECT * should not be used (SelectStarCheck)
5. **AZherDyzNWDmi-A-qXmh** - `0001_foamy_malcolm_colcord.sql:112` - SELECT * should not be used (SelectStarCheck)
6. **AZherDyzNWDmi-A-qXmi** - `0001_foamy_malcolm_colcord.sql:114` - SELECT * should not be used (SelectStarCheck)

### Wizard Component Issues (5 issues)
1. **AZherD9NNWDmi-A-qXoV** - `WizardStepNav.tsx:16` - Element has implicit role, defining explicitly is redundant (S6822)
2. **AZherD9NNWDmi-A-qXoW** - `WizardStepNav.tsx:23` - href requires valid value for accessibility (S6844)
3. **AZherD9NNWDmi-A-qXoY** - `WizardStepNav.tsx:45` - href requires valid value for accessibility (S6844)
4. **AZherD9NNWDmi-A-qXoZ** - `WizardStepNav.tsx:58` - href requires valid value for accessibility (S6844)
5. **AZherD4dNWDmi-A-qXna** - `localStoreWizard.e2e.test.ts:69` - Use for-of loop instead (S4138)

## Minor Issues (60 issues)

### React State Management (10 issues)
1. **AZhjRqKuPa7dXImGnrS3** - `KitVoicePanel.tsx:113` - useState not destructured (S6754)
2. **AZhjRqIrPa7dXImGnrSx** - `SampleWaveform.tsx:28` - useState not destructured (S6754)
3. **AZherD4RNWDmi-A-qXnW** - `useStepPattern.ts:17` - useState not destructured (S6754)
4. **AZherEEeNWDmi-A-qXra** - `TestSettingsProvider.tsx:12` - useState not destructured (S6754)
5. **AZherEEeNWDmi-A-qXrb** - `TestSettingsProvider.tsx:13` - useState not destructured (S6754)
6. **AZherEEeNWDmi-A-qXrc** - `TestSettingsProvider.tsx:14` - useState not destructured (S6754)
7. **AZherEEeNWDmi-A-qXrZ** - `TestSettingsProvider.tsx:10` - useState not destructured (S6754)
8. **AZhjbZbcekZkHoMWn1Fl** - `schema.ts:44` - Deprecated signature (S1874)
9. **AZherEEeNWDmi-A-qXre** - `TestSettingsProvider.tsx:37` - Avoid boolean literal (S1125)
10. **AZherEGCNWDmi-A-qXrz** - `config.ts:48` - Use nullish coalescing operator (S6606)

### Unused Props/Variables (36 issues)
Props that are defined but never used:
- **KitVoicePanels.tsx** (11 props): kit, samples, selectedVoice, selectedSampleIdx, onSaveVoiceName, onRescanVoiceName, samplePlaying, playTriggers, stopTriggers, onPlay, onStop, onWaveformPlayingChange, kitName, onSampleKeyNav, onSampleSelect
- **KitStepSequencer.tsx** (4 props): samples, onPlaySample, stepPattern, setStepPattern  
- **KitBrowserHeader.tsx** (3 props): onShowNewKit, onCreateNextKit, nextKitSlot
- **KitDetails.tsx** (3 props): onCreateKit, onMessage, onRequestSamplesReload
- **shared/KitIconRenderer.tsx** (1 prop): Union type override issue

### Type/Union Issues (4 issues)
1. **AZhnht5tordITOg1gAP0** - `KitIconRenderer.tsx:15` - String overrides union type (S6571)
2. **AZherEFfNWDmi-A-qXrt** - `AboutView.tsx:59` - Ambiguous spacing after span (S6772)
3. **AZherEFfNWDmi-A-qXru** - `AboutView.tsx:71` - Ambiguous spacing after a element (S6772)
4. **AZherEBWNWDmi-A-qXpp** - `KitList.tsx:207` - Remove redundant jump (S3626)

### CSS/Style Issues (1 issue)
1. **AZherEALNWDmi-A-qXpB** - `KitDialogs.tsx:39` - Ambiguous spacing before input (S6772)

## Info Issues (0 issues)
- **AZhr7AgGlY8xlt9_KPPy** - `wavAnalysisScanner.ts:59` - Complete TODO comment (S1134)

## Priority Recommendations

### High Priority (Address First)
1. **Critical Cognitive Complexity** - Functions exceeding complexity threshold significantly impact maintainability
2. **Accessibility Issues** - Important for user experience and compliance
3. **React Performance** - Context values changing every render can cause performance issues
4. **Promise Handling** - Incorrect async/await usage can cause runtime issues

### Medium Priority  
1. **Code Structure** - Optional chaining and conditional simplification
2. **UI/UX** - Interactive element accessibility and proper form associations
3. **Array Operations** - Proper sorting and key usage

### Low Priority
1. **Unused Props** - Clean up but doesn't affect functionality
2. **Type Issues** - Mostly cosmetic union type issues
3. **Style Issues** - Spacing and formatting

## Notes
- Total issues from SonarQube API: 487 total issues (338 closed, 149 open)
- This document only tracks OPEN issues that need to be addressed
- Issues are sorted by severity and include specific file locations and line numbers for easy navigation
- Each issue includes the SonarQube rule code for reference to documentation