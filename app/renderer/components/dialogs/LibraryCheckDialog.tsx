import type { StoreCheckKitFinding } from "@romper/shared/electronApi";

import { ArrowsClockwiseIcon, FileXIcon, XIcon } from "@phosphor-icons/react";
import {
  describeDriveNotConnected,
  describeDriveNotResponding,
  describeFolderMissing,
  describeMissingFiles,
  describeScanKit,
  describeUntrackedFiles,
  LIBRARY_CHECK_EMPTY,
  LIBRARY_CHECK_HEADINGS,
  LIBRARY_CHECK_TITLE,
  SCAN_KIT_LABEL,
} from "@romper/shared/storeCheckWording";
import React, { useContext, useLayoutEffect, useRef, useState } from "react";

import { removeMissingSamplesFromKit } from "../hooks/kit-management/removeMissingSamples";
import {
  storeCheckStore,
  useLibraryCheckDialogOpen,
  useStoreCheckSummary,
} from "../hooks/kit-management/storeCheckStore";
import { MessageDisplayContext } from "../MessageDisplayContext";
import RemoveMissingSamplesButton from "../RemoveMissingSamplesButton";
import ModalDialog from "../shared/ModalDialog";

/** The fix running now, and its kit: one at a time */
interface RunningFix {
  fix: "remove" | "scan";
  kitName: string;
}

/**
 * The "Library check" dialog (#824, stage 3 of docs/developer/store-check.md):
 * the kits the background check found files missing from, or in their
 * folder and not in the kit, and a line for each drive that wasn't
 * connected or didn't respond. It opens from the status bar item and shows
 * the check as it stands, so a kit drops off the list when its problem is
 * gone. It replaces the dialog that ran the whole-store validator.
 *
 * Each kit has a "Scan kit" button (#821, stage 4): it rescans the kit, and
 * main checks the kit again once the scan is over, so the kit's entry, its
 * badge and the status bar count follow at once. A kit with missing
 * samples also has "Remove missing samples" (#822, stage 5): main checks
 * the files again, removes the rows still missing (never one on a drive
 * that isn't connected, D6), and checks the kit again. Undo (Edit > Undo)
 * puts them back. Finding the files comes with stage 6.
 */
const LibraryCheckDialog: React.FC = () => {
  const isOpen = useLibraryCheckDialogOpen();
  const { attention, notConnected, notResponding } = useStoreCheckSummary();
  const messages = useContext(MessageDisplayContext);
  // The fix running now: one at a time
  const [running, setRunning] = useState<null | RunningFix>(null);
  const scanning = running?.fix === "scan" ? running.kitName : null;
  const titleRef = useRef<HTMLHeadingElement>(null);

  // A scan that fixes a kit removes its entry, and the button that had
  // focus with it: focus goes to the dialog's title, not to the page behind
  useLayoutEffect(() => {
    const title = titleRef.current;
    if (title && document.activeElement === document.body) {
      title.focus({ preventScroll: true });
    }
  });

  // Main's own words for why a fix failed, as the kit editor shows them
  const runFix = async (fix: RunningFix, run: () => Promise<null | string>) => {
    if (running !== null) return;
    setRunning(fix);
    try {
      const error = await run();
      if (error) messages?.showMessage(error, "error");
    } catch (error) {
      messages?.showMessage(
        error instanceof Error ? error.message : String(error),
        "error",
      );
    } finally {
      setRunning(null);
    }
  };

  const scanKit = (kitName: string) =>
    runFix({ fix: "scan", kitName }, async () => {
      const result = await globalThis.electronAPI?.rescanKit?.(kitName);
      return result && !result.success ? (result.error ?? null) : null;
    });

  const removeMissing = (kitName: string) =>
    runFix({ fix: "remove", kitName }, () =>
      removeMissingSamplesFromKit(kitName),
    );

  if (!isOpen) return null;

  const groups = [
    {
      heading: LIBRARY_CHECK_HEADINGS.missing,
      id: "missing",
      kits: attention.filter((kit) => kit.missing > 0 || kit.folderMissing),
      lines: (kit: StoreCheckKitFinding) => [
        ...(kit.missing > 0 ? [describeMissingFiles(kit.missing)] : []),
        ...(kit.folderMissing ? [describeFolderMissing(kit.kitName)] : []),
      ],
    },
    {
      heading: LIBRARY_CHECK_HEADINGS.untracked,
      id: "untracked",
      kits: attention.filter((kit) => kit.untracked.length > 0),
      lines: (kit: StoreCheckKitFinding) => [
        describeUntrackedFiles(kit.untracked.length),
      ],
    },
  ].filter((group) => group.kits.length > 0);
  const hasDrives = notConnected.length > 0 || notResponding.length > 0;

  return (
    <ModalDialog
      aria-labelledby="library-check-title"
      className="bg-surface-2 border border-border-subtle w-full max-w-2xl max-h-[80vh] overflow-y-auto rounded-lg shadow-[0_8px_40px_rgba(0,0,0,0.4)] p-6"
      data-testid="library-check-dialog"
      onClose={storeCheckStore.closeDialog}
    >
      <div className="flex justify-between items-center mb-4">
        <h2
          className="text-xl font-bold flex items-center gap-2 focus:outline-none"
          id="library-check-title"
          ref={titleRef}
          tabIndex={-1}
        >
          <FileXIcon
            aria-hidden="true"
            className="text-accent-warning"
            size={24}
            weight="fill"
          />
          {LIBRARY_CHECK_TITLE}
        </h2>
        <button
          aria-label="Close"
          className="text-text-tertiary hover:text-text-primary"
          onClick={storeCheckStore.closeDialog}
        >
          <XIcon size={24} />
        </button>
      </div>

      {groups.map((group) => (
        <section
          aria-labelledby={`library-check-${group.id}`}
          className="mb-4"
          data-testid={`library-check-group-${group.id}`}
          key={group.id}
        >
          <h3 className="font-bold mb-2" id={`library-check-${group.id}`}>
            {group.heading}
          </h3>
          <ul className="border border-border-default rounded">
            {group.kits.map((finding) => (
              <li
                className="p-3 border-b border-border-default last:border-b-0"
                data-testid={`library-check-${group.id}-${finding.kitName}`}
                key={finding.kitName}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-mono font-bold">{finding.kitName}</div>
                    <ul className="text-sm text-accent-warning">
                      {group.lines(finding).map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="flex shrink-0 items-start gap-2">
                    <button
                      aria-busy={scanning === finding.kitName}
                      aria-disabled={running !== null}
                      aria-label={describeScanKit(finding.kitName)}
                      className={`shrink-0 px-2 py-1 text-xs bg-accent-primary text-text-inverse rounded font-semibold flex items-center transition duration-150 ${
                        running === null
                          ? "hover:bg-accent-primary/80"
                          : "opacity-60 cursor-wait"
                      }`}
                      data-testid={`library-check-scan-${group.id}-${finding.kitName}`}
                      onClick={() => void scanKit(finding.kitName)}
                      type="button"
                    >
                      <ArrowsClockwiseIcon
                        aria-hidden="true"
                        className="inline-block mr-1"
                        size={14}
                      />
                      {SCAN_KIT_LABEL}
                    </button>
                    {group.id === "missing" && finding.missing > 0 && (
                      <RemoveMissingSamplesButton
                        busy={
                          running?.fix === "remove" &&
                          running.kitName === finding.kitName
                        }
                        count={finding.missing}
                        data-testid={`library-check-remove-${finding.kitName}`}
                        disabled={running !== null}
                        kitName={finding.kitName}
                        onRemove={() => void removeMissing(finding.kitName)}
                      />
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {groups.length === 0 && !hasDrives && (
        <p data-testid="library-check-empty">{LIBRARY_CHECK_EMPTY}</p>
      )}

      {hasDrives && (
        <ul
          className="mt-4 text-sm text-text-secondary space-y-1"
          data-testid="library-check-drives"
        >
          {notConnected.map((drive) => (
            <li key={`connected-${drive.volume}`}>
              {describeDriveNotConnected(drive)}
            </li>
          ))}
          {notResponding.map((volume) => (
            <li key={`responding-${volume}`}>
              {describeDriveNotResponding(volume)}
            </li>
          ))}
        </ul>
      )}
    </ModalDialog>
  );
};

export default LibraryCheckDialog;
