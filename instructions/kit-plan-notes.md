1. this feature enables the user to create new kits or modify existing kits before persisting them to local storage. this is analogous to a git working copy, albeit drastically simplified.  A plan solves the problem of adding new samples to a kit and being able to clearly see what those changes are before saving. Also managing potentially many copies of the same samples across multiple kits without the user feeling lost.

Users will typically have banks of samples elsewhere on their filesystem from software like Splice or XO or ableton. Rather than making the user copy those samples into the rample specific file structure, filename and format, romper plans take care of all of the complexity for them.

2. the primary user is the owner of a rample sampler that wants to create and manage kits from samples they already own, or create variants of existing kits in the romper library.

3. essential actions:

There is a global application setting called 'default to mono samples'.   this setting should be on by default, and persisted to the local settings store when changed.  This setting defines how stereo samples are handled. Specifics are defined later.

Each kit has exactly one plan - its integral to the kit.  Plan mode is toggled either on or off for a kit.

CThe rample hardware module ships with dozens of predefined factory kits, on the device and downloadable as a bulk zip file from squarp.net, if needed. In addition, a user may have kits that they have created manually prior to using Romper. These predefined kits were not created with a plan and may not need plan features. These kits aren't immutable, but the user may choose to never use plan features on these kits to keep them as-is. Plan mode can be toggled on and off at the kit level, with pre-defined kits defaulting to plan mode 'off' and new kits defaulting to plan mode 'on'.  When scanning a directory for existing kits, existing non-empty kits will have plan mode 'off'.  empty kits will have plan mode 'on'.

WAV format requirements
- Wav files played on the rample must be 8 or 16 bit 44100 Hz mono or stereo.  wav files added to a plan that are not in this format should be marked with a warning indicating that the format will be changed upon plan commit. This is not a big issue, just a courtesy to the user.
- only valid WAV files can be added to the plan. other files are rejected. this is checked before the file is added to the plan.

Initializing the Romper Local Store and Romper DB
- Plan functionality requires a romper local store and romper DB. It cannot function without both.
 - Romper local store is a user-defined directory that will house kits and samples that will be synced to the Romper SD card
 - Romper DB, which is a sqlite database stored in the `.romperdb` folder in the romper local store.
 - As these are foundational, if they don't exist, the app should create them.
 - Exactly one local store and associated romper DB should be stored in the application settings. If present, it is loaded on startup.
- Creating a local store is done via a wizard
 - The user chooses the source of the local store. There are 3 options
  - From the Rample SD card
   - if they choose the SD card, they must navigate to the mounted SD card. If it is not mounted they must mount it before proceeding.
   - From the Squarp.net archive: https://data.squarp.net/RampleSamplesV1-2.zip
   - A blank folder
 - The user chooses the target of the local store.
  - The default is the the OS-equivalent 'Documents' folder.
  - A custom path can be chosen.
  - The `romper` directory will be created in this location
 - The local store is initialized from the source
  - Kit folder initialization
   - If the SD card is the source, all files are copied from the SD card to the local store
   - If the Squarp.net archive is the source, the archive is downloaded and extracted to the local store
   - IF a blank folder is chosen, no files are copied.
  - Romper DB initialization
   - The Romper DB is initialized based upon the new contents of the local store
   - The Romper DB lives in the `.romperdb` folder within the `romper` local store directory.
- The user can create a new local store at a new location. This is a settings menu action.
- The user can change the location of the local store, for example initializing a new local store and romper DB. This is not recommended but the implementation should support it.
- Validation logic can be used to check that the local store kit folders and sample files match the romper DB metadata and plans.
 - IF the romper DB metadata or plans are out of sync, error should be presented to the user.  This may require manual intervention by the user.  Specific cases and troubleshooting are to be determined at a later date.

Managing plans
- Plans are backed by the Romper DB
 - When a plan is modified, the plan is immediately persisted to local storage. this saves all of the plan metadata to the local store.
 - The database handles undo/redo of sample additions and deletions.
- A user can add a sample to a slot.  the source path of that sample will be attributed to the slot in the plan.
 - samples can be dragged and dropped from the filesystem to a voice slot
  - Voice slots in plan mode are drop targets.
  - If there is no sample in the slot, the drop target says 'Add sample'
- A user can replace samples in a slot.
 - If there is already a plan sample or committed in the slot, the drop target message says 'Replace sample'.
- The user can add multiple samples in one action. those samples are incrementally added to the voice until the 12 slot limit is reached.
 - if this action will add new samples and create new samples, the user should be prompted upon drop as to whether tehy want to continue.
- A user can delete an existing sample as a plan action. This action is added to the plan, the slot is indicated as empty and it is possible to undo this action to restore the existing sample.  This restore action can be done at any time
- when a sample is added to a plan:
  - if the sample is mono, it is linked to the voice and slot that it was added to.
  - if the sample is stereo, and the 'default to mono' setting is ON: treat the stereo sample as mono.
  - if the sample is stereo, and the 'default to mono' setting is OFF:
    - if the same slot in the next voice already has a sample, the user should be prompted whether they want the sample to be mono (and occuopy one slot) OR replace the sample in the next voice slot (to have a stereo sample).
    - the left channel is attributed to the voice and slot it was added to.
    - the right channel is attributed to the same slot in the next voice. e.g. left: voice 1, slot 5; right: voice 2, slot 5.
    - if the stereo sample is added to voice 4 (and therefore there is no next voice), the sample should be added as mono and the user given a warning about its mono status.

Previewing a sample in the plan
 - Sample playback features for planned samples work the same as for  samples stored in the romper local store. Uncommitted samples are played from their source location.
 - Sequencer playback for planned samples work the same as for slotted samples stored in the kit.
 - When previewing a stereo sample that is to be treated as mono, the two channels are merged on playback to play the sample in mono.

Committing the plan
- a user can commit a plan via the 'commit plan' button at the top of the screen
- when the plan is committed,
 -the plan is executed and all of the samples are  persisted to the local rample store.
  -  Samples are converted to 16 bit 44100 Hz
  - A stereo sample that is to be persisted as mono is converted to mono using an average method.
  - the plan is put into the 'committed' state. it is unchanged, unless additional samples are added to the plan, in which case it is in the 'uncommitted' state.

3. Core functionality

The addition of plans bring the following core concepts to Romper:

- Plan. An integral part of a kit. It can be toggled on and off.   It stores mappings between paths of samples stored outside of Romper to voice slots.
- Romper local store. The local copy of kits and samples, which may be created from the SD card, the squarp Zip archive or a blank folder.   When a plan is committed, samples are written to this folder.   When the SD card is synced (out of scope of this PRD) all files on the SD card are deleted and replaced with the contents of this folder.
- Romper DB. A SQLlite database that contains metadata about the romper local store, kits, voices, samples and plans. The romper DB lives in the root of the romper local store.  The romper DB is not copied to the SD card.


