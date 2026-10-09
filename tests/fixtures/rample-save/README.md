# Rample `_save` fixtures

Real `_save` folders copied from a Rample's SD card, unchanged, for the
reader's tests (`electron/main/rample/__tests__/rampleSaveFixtures.test.ts`).
Committed by decision D1 on [#786](https://github.com/peteb4ker/romper/issues/786).
See [`docs/developer/rample-save-integration.md`](../../../docs/developer/rample-save-integration.md)
for what the files hold.

One folder per firmware, named after it. Nothing in the files records a
firmware version, so a folder whose firmware hasn't been read from the
device (**Settings → INFO**, hardware check 1) says `-inferred`.

| Folder | Source | Firmware |
|---|---|---|
| `fw-2.00-inferred/` | Pete's Rample, copied 2026-10-04 | 2.00, inferred from `settings.rpl`'s keys; unconfirmed until check 1 |

Rules:

- Never edit a file here. A new sample goes in a new folder (a 3.00 copy
  as `fw-3.00/`, a hardware check's copy as `fw-<version>/<check>/`).
- Copy from the card with `cp -X` on macOS, so no `._` files come along.
- `.gitattributes` marks `*.rpl` as binary, so Git never changes a byte.
- The files hold knob positions, MIDI notes and device settings; no
  samples, names or anything personal.
