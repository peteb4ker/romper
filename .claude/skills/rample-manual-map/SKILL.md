---
name: rample-manual-map
description: Re-index the Squarp Rample manual and map its sections to Romper's use cases — fetch the manual, regenerate docs/developer/rample-manual-index.md, review changed, new and unmapped sections, and file issues for gaps. Use when Squarp publishes a new Rample manual or firmware, or when asked which Rample features Romper supports, mirrors or ignores.
argument-hint: "[--html <saved page>]"
---

Run by hand, when Squarp publishes a new Rample manual or firmware (Q-08,
#538). It isn't scheduled and CI doesn't run it.

The [index](../../../docs/developer/rample-manual-index.md) has one row per
manual section and sub-heading: the heading (the key), the box's anchor, a
hash of its text, the date that text last changed, and three columns kept
by hand: **Relationship** (`writes`, `mirrors`, `documents`, `none`),
**Use cases** (`UC-NN`, `Q-NN`) and **Notes**. Concepts are generated from
the `**Rample manual:**` links in `docs/developer/domain-model.md`.

## Copyright

The manual is Squarp's. Never commit its text or long quotes: not in the
index, issues, PRs or commit messages. The index holds headings, anchors,
hashes and notes in our own words. The fetched page and each section's text
stay in `.cache/rample-manual/`, which git ignores. A short quote (under a
sentence) is fine in a doc that cites the section, as the domain model does.

## Steps

1. **Work in a worktree** (CLAUDE.md), e.g.
   `npm run worktree:create rample-manual-<date>`.
2. **Run it:**

   ```sh
   npm run rample-manual            # fetch, rewrite the index, report
   npm run rample-manual -- --dry-run          # report only
   npm run rample-manual -- --html <saved.html> # a saved copy of the page
   ```

   It refuses to write when it finds under half the sections the index
   has: the page's layout has probably changed. Fix `parseManual` in
   `scripts/rample-manual-index.mjs` (with a test in
   `scripts/__tests__/rampleManualIndex.test.ts` on the synthetic fixture,
   never the real page), or pass `--force` if sections really were removed.
3. **Read the report** and act on each list:
   - **Text changed:** read the old and new text,
     `diff -ru .cache/rample-manual/previous .cache/rample-manual/sections`
     (the previous text is only there if this machine ran the script last
     time; otherwise read the section on the page). The report names the
     row's use cases and concepts. Check what they claim against the new
     text: the use case, the concept's entry in the domain model, Romper's
     manual (`docs/manual/`) and any code comment citing it. Fix a doc
     that's now wrong in this PR; file an issue for code that is.
   - **New:** map it (step 4).
   - **Renamed:** the mapping was carried over by anchor or by identical
     text. Check it still fits, and update domain-model links to the new
     anchor if the anchor changed.
   - **Removed:** the row is gone from the index with its mapping (printed
     in the report). If Romper relied on it, say so in an issue.
   - **Not mapped yet:** map it (step 4).
   - **Candidate features:** `none` rows with no issue cited and not
     marked "Not a gap". File an issue (step 5) or mark it.
   - **Citations of anchors the page no longer has:** update the link in
     that doc to the section's new anchor (from the index).
   - **Problems:** an unknown relationship or use case ID. Fix the row.
     These exit 1.
4. **Map rows** by editing the Relationship, Use cases and Notes cells in
   the index directly; a rerun keeps them. Edit nothing else: the run
   regenerates it.
   - `writes`: Romper writes what the Rample reads from the card (kit
     folders, file names, stereo pairs).
   - `mirrors`: Romper reproduces it for preview, without the card (the
     sequencer, the slicer, sample modes). Say in Notes where Romper's
     version differs.
   - `documents`: Romper's docs explain it.
   - `none`: Romper doesn't touch it. Combine the others with commas.
   - Use cases: the `UC-NN`/`Q-NN` where a user would notice the
     relationship; leave blank for `none`.
   - Notes: our own words, a sentence. Cite issues as `#N`. For a `none`
     row that isn't a gap (navigation, the device's display, a third-party
     tool), start with "Not a gap:" and say why.
   - If a concept in `domain-model.md` relies on the section, add the link
     to its **Rample manual:** line so the Concepts column picks it up.
5. **File an issue for each gap** you'd put on the backlog: a candidate
   feature, or a `mirrors` row whose Notes describe a difference that isn't
   tracked. Follow [`BACKLOG.md`](../../../BACKLOG.md):
   - a plain title saying what a user would notice, e.g. "Romper can't
     preview a kit's mute groups";
   - labels `Q-08`, the `UC-NN` where it shows (if any), a kind
     (`enhancement` for a missing feature, `bug` for a wrong one,
     `documentation` when our docs disagree with the manual) and a severity
     (`severity:low` unless it breaks what Romper writes);
   - the body links the manual section by anchor and says what Romper does
     today, in our words. Building it needs Pete's sign-off on the issue
     (product decisions are his).

   Then put the issue number in that row's Notes, which takes it off the
   candidate list. Check `gh issue list --label Q-08 --state all` first,
   so you don't file one twice.
6. **Rerun** `npm run rample-manual -- --html .cache/rample-manual/manual.html`
   to re-render and confirm no problems or unexpected candidates remain.
7. **Open a PR** with the index and any doc fixes. Its description lists
   the changed sections and what each affected, the issues filed, and the
   manual version (if the page states one) and fetch date.

## Limits

- Images aren't hashed. A section that is mostly a picture (the MIDI
  implementation chart) changes only if its caption does: look at it.
- A sub-heading is a bold line of upper-case words on its own (a Settings
  entry, STEREO SUPPORT). If Squarp restyles them, rows will be renamed or
  added; check the renames.
- The page states no manual or firmware version today. The index says so;
  if a version appears, it's stamped automatically.
