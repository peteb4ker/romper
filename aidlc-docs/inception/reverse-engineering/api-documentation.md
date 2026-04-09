# API Documentation

## IPC API (100+ Endpoints)

All IPC communication flows through `window.electronAPI` exposed by the preload bridge. Grouped by domain:

### Kit Management (10 endpoints)
| Endpoint | Purpose | Parameters | Returns |
|----------|---------|------------|---------|
| getKits | Get all kits with relations | none | KitWithRelations[] |
| getKit | Get single kit | kitName: string | KitWithRelations \| null |
| getKitsMetadata | Get kits metadata (lightweight) | none | Partial<Kit>[] |
| createKit | Create kit with 4 voices | kitSlot: string | void |
| deleteKit | Delete kit atomically | kitName: string | void |
| copyKit | Deep copy a kit | sourceKit, destKit | void |
| getKitDeleteSummary | Pre-delete summary | kitName | {kitName, locked, sampleCount, voiceCount} |
| updateKit | Update kit metadata | kitName, updates | void |
| updateKitBpm | Update BPM | kitName, bpm | void |
| updateStepPattern | Update sequencer pattern | kitName, pattern: number[][] | void |

### Voice Management (5 endpoints)
| Endpoint | Purpose | Parameters | Returns |
|----------|---------|------------|---------|
| updateVoiceAlias | Set voice name | kitName, voiceNumber, alias | void |
| updateVoiceVolume | Set voice volume (0-100) | kitName, voiceNumber, volume | void |
| updateVoiceSampleMode | Set sample mode | kitName, voiceNumber, mode | void |
| updateVoiceStereoMode | Toggle stereo | kitName, voiceNumber, stereoMode | void |
| updateTriggerConditions | Set A:B conditions | kitName, conditions | void |

### Sample Management (10 endpoints)
| Endpoint | Purpose | Parameters | Returns |
|----------|---------|------------|---------|
| addSampleToSlot | Add sample to empty slot | kitName, voice, slot, filePath | DbResult |
| replaceSampleInSlot | Replace existing sample | kitName, voice, slot, filePath | DbResult |
| deleteSampleFromSlot | Delete with reindexing | kitName, voice, slot | DbResult |
| deleteSampleFromSlotWithoutReindexing | Delete without reindex | kitName, voice, slot | DbResult |
| moveSampleInKit | Move within kit (drag-drop) | kitName, fromV, fromS, toV, toS, mode | DbResult |
| moveSampleBetweenKits | Move across kits | MoveSampleParams | DbResult |
| updateSampleGain | Set gain (-24 to +12 dB) | kitName, voice, slot, gainDb | void |
| getAllSamplesForKit | Get kit's samples | kitName | Sample[] |
| getAllSamples | Get all samples | dbDir | Sample[] |
| getSampleAudioBuffer | Get audio data for playback | kitName, voice, slot | ArrayBuffer |

### Audio and Format (5 endpoints)
| Endpoint | Purpose | Parameters | Returns |
|----------|---------|------------|---------|
| getAudioMetadata | Extract WAV metadata | filePath | AudioMetadata |
| validateSampleFormat | Check WAV validity | filePath | {isValid, format, error?} |
| validateSampleSources | Verify all sources exist | kitName | {valid, issues[]} |
| playSample | Preview playback | filePath, options? | void |
| stopSample | Stop playback | none | void |

### Favorites (3 endpoints)
| Endpoint | Purpose | Parameters | Returns |
|----------|---------|------------|---------|
| toggleKitFavorite | Toggle favorite status | kitName | {isFavorite} |
| getFavoriteKits | Get all favorites | none | KitWithRelations[] |
| getFavoriteKitsCount | Count favorites | none | number |

### Sync Operations (4 endpoints + events)
| Endpoint | Purpose | Parameters | Returns |
|----------|---------|------------|---------|
| generateSyncChangeSummary | Plan sync | none | SyncSummary |
| startKitSync | Begin sync | syncData | void |
| cancelKitSync | Cancel sync | none | void |
| onSyncProgress | Progress listener | callback | void |

### Bank Management (3 endpoints)
| Endpoint | Purpose | Parameters | Returns |
|----------|---------|------------|---------|
| getAllBanks | Get banks A-Z | none | Bank[] |
| updateBank | Update bank metadata | letter, updates | void |
| scanBanks | Scan for bank data | none | {success, banksFound} |

### File System (12 endpoints)
| Endpoint | Purpose |
|----------|---------|
| selectLocalStorePath | Open directory dialog |
| selectExistingLocalStore | Select + validate local store |
| selectSdCard | Select SD card |
| getLocalStoreStatus | Check store readiness |
| validateLocalStore | Deep validation |
| validateLocalStoreBasic | Quick validation |
| listFilesInRoot | List store root files |
| ensureDir | Create directory |
| copyDir | Recursive copy |
| readFile | Read file contents |
| showItemInFolder | Reveal in file explorer |
| downloadAndExtractArchive | Download factory samples |

### Database Management (3 endpoints)
| Endpoint | Purpose |
|----------|---------|
| createRomperDb | Initialize database |
| insertKit | Low-level kit insert |
| insertSample | Low-level sample insert |

### Menu Events (6 events forwarded as DOM events)
- menu-scan-all-kits, menu-change-local-store-directory, menu-preferences, menu-about, menu-undo, menu-redo

## Data Models

### KitWithRelations
Primary data model combining Kit fields with Bank, Voice[], and Sample[] relations.

### DbResult<T>
```typescript
type DbResult<T> = { success: true; data: T } | { success: false; error: string }
```

### Key Types (from shared/db/schema.ts)
- **Kit**: name(PK), alias, bank_letter(FK), bpm, editable, is_favorite, locked, modified_since_sync, step_pattern(JSON), trigger_conditions(JSON)
- **Voice**: id(PK), kit_name(FK), voice_number(1-4), voice_alias, sample_mode, stereo_mode, voice_volume
- **Sample**: id(PK), kit_name(FK), voice_number, slot_number(0-11), filename, source_path, is_stereo, gain_db, wav metadata fields
- **Bank**: letter(PK A-Z), artist, rtf_filename, scanned_at
