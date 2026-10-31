import { FileXIcon, XIcon } from "@phosphor-icons/react";
import {
  describeDriveNotConnected,
  describeDriveNotResponding,
  describeFolderMissing,
  describeMissingFiles,
  describeUntrackedFiles,
  LIBRARY_CHECK_TITLE,
} from "@romper/shared/storeCheckWording";
import React from "react";

import {
  storeCheckStore,
  useLibraryCheckDialogOpen,
  useStoreCheckSummary,
} from "../hooks/kit-management/storeCheckStore";
import ModalDialog from "../shared/ModalDialog";

/**
 * The "Library check" dialog (#824, stage 3 of docs/developer/store-check.md):
 * the kits the background check found files missing from, or in their
 * folder and not in the kit, and a line for each drive that wasn't
 * connected or didn't respond. It opens from the status bar item and shows
 * the check as it stands, so a kit drops off the list when its problem is
 * gone. It replaces the dialog that ran the whole-store validator.
 *
 * It only shows problems; the fixes (scan, remove, find) come with later
 * stages.
 */
const LibraryCheckDialog: React.FC = () => {
  const isOpen = useLibraryCheckDialogOpen();
  const { attention, notConnected, notResponding } = useStoreCheckSummary();
  if (!isOpen) return null;

  return (
    <ModalDialog
      aria-labelledby="library-check-title"
      className="bg-surface-2 border border-border-subtle w-full max-w-2xl max-h-[80vh] overflow-y-auto rounded-lg shadow-[0_8px_40px_rgba(0,0,0,0.4)] p-6"
      data-testid="library-check-dialog"
      onClose={storeCheckStore.closeDialog}
    >
      <div className="flex justify-between items-center mb-4">
        <h2
          className="text-xl font-bold flex items-center gap-2"
          id="library-check-title"
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

      {attention.length > 0 && (
        <ul
          className="border border-border-default rounded"
          data-testid="library-check-kits"
        >
          {attention.map((finding) => (
            <li
              className="p-3 border-b border-border-default last:border-b-0"
              data-testid={`library-check-kit-${finding.kitName}`}
              key={finding.kitName}
            >
              <div className="font-mono font-bold">{finding.kitName}</div>
              <ul className="text-sm text-accent-warning">
                {finding.missing > 0 && (
                  <li>{describeMissingFiles(finding.missing)}</li>
                )}
                {finding.untracked.length > 0 && (
                  <li>{describeUntrackedFiles(finding.untracked.length)}</li>
                )}
                {finding.folderMissing && (
                  <li>{describeFolderMissing(finding.kitName)}</li>
                )}
              </ul>
            </li>
          ))}
        </ul>
      )}

      {(notConnected.length > 0 || notResponding.length > 0) && (
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
