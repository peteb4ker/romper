import type {
  FindMissingFilesResult,
  FoundFile,
  MissingFileSearch,
} from "@romper/shared/electronApi";

import { MagnifyingGlassIcon } from "@phosphor-icons/react";
import {
  COPY_BACK_LABEL,
  describeFindMissingFilesButton,
  describeFoundFile,
  describeFoundPossibleFile,
  describeFoundSeveralFiles,
  describeNotFound,
  describeSearchIncomplete,
  FIND_MISSING_FILES_LABEL,
  POSSIBLE_MATCH_NOTE,
  USE_THIS_FILE_LABEL,
} from "@romper/shared/storeCheckWording";
import React, { useCallback, useEffect, useId, useRef, useState } from "react";

import { restoreFoundFile } from "./hooks/kit-management/findMissingFiles";

interface FindMissingFilesProps {
  /** Lays out the button and the results where the caller wants them */
  children: (parts: {
    button: React.ReactNode;
    results: React.ReactNode;
  }) => React.ReactNode;
  "data-testid": string;
  /** Another fix is running: the button stays focusable but does nothing */
  disabled: boolean;
  kitName: string;
  /** Called with true while this search or a restore runs, then false */
  onBusyChange?: (busy: boolean) => void;
  /** Main's error, shown as the caller shows main's scan errors */
  onError: (error: string) => void;
}

type Phase = "idle" | "picking" | "restoring" | "searching";

const SIZE_FORMAT = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 0,
  style: "unit",
  unit: "kilobyte",
});

/**
 * The "Find missing files…" fix (#823, stage 6 of
 * docs/developer/store-check.md), in the Library check and the kit
 * editor's missing-files notice. Main asks for a folder in a native
 * dialog (D1), searches the store's kit folders and that folder, and
 * lists what it found for each missing file. A file found is put back by
 * "Copy back" (its old place is in the store) or "Use this file" (it
 * isn't, D2), one at a time; Edit > Undo reverses it. Several files, or
 * only files with the same name, are listed for the user to choose (D3).
 * The search can be cancelled, and stops when this goes away.
 */
const FindMissingFiles: React.FC<FindMissingFilesProps> = ({
  children,
  "data-testid": testId,
  disabled,
  kitName,
  onBusyChange,
  onError,
}) => {
  const [phase, setPhase] = useState<Phase>("idle");
  const [results, setResults] = useState<FindMissingFilesResult | null>(null);
  const searching = useRef(false);

  const setBusy = useCallback(
    (next: Phase) => {
      setPhase(next);
      onBusyChange?.(next !== "idle");
    },
    [onBusyChange],
  );

  // A search still running when this goes away (the dialog closed, another
  // kit opened) is stopped
  useEffect(
    () => () => {
      if (searching.current) {
        void globalThis.electronAPI?.cancelFindMissingFiles?.();
      }
    },
    [],
  );

  const showError = (error: unknown) =>
    onError(error instanceof Error ? error.message : String(error));

  const find = async () => {
    if (disabled || phase !== "idle") return;
    setBusy("picking");
    try {
      const picked = await globalThis.electronAPI?.pickSearchFolder?.(kitName);
      if (!picked?.success) {
        if (picked?.error) onError(picked.error);
        return;
      }
      if (!picked.data) return;
      setBusy("searching");
      searching.current = true;
      const found = await globalThis.electronAPI?.findMissingFiles?.(
        kitName,
        picked.data,
      );
      if (!found?.success) {
        if (found?.error) onError(found.error);
      } else if (found.data && !found.data.cancelled) {
        setResults(found.data);
      }
    } catch (error) {
      showError(error);
    } finally {
      searching.current = false;
      setBusy("idle");
    }
  };

  const restore = async (file: MissingFileSearch, found: FoundFile) => {
    if (disabled || phase !== "idle") return;
    setBusy("restoring");
    try {
      const error = await restoreFoundFile(kitName, file, found);
      if (error) {
        onError(error);
      } else {
        // That file isn't missing any more
        setResults((current) =>
          current
            ? {
                ...current,
                files: current.files.filter(
                  (f) => f.sampleId !== file.sampleId,
                ),
              }
            : current,
        );
      }
    } catch (error) {
      showError(error);
    } finally {
      setBusy("idle");
    }
  };

  const inactive = disabled || phase !== "idle";
  const button = (
    <div className="flex shrink-0 items-start gap-2">
      <button
        aria-busy={phase === "picking" || phase === "searching"}
        aria-disabled={inactive}
        aria-label={describeFindMissingFilesButton(kitName)}
        className={`shrink-0 px-2 py-1 text-xs bg-accent-primary text-text-inverse rounded font-semibold flex items-center transition duration-150 ${
          inactive ? "opacity-60 cursor-wait" : "hover:bg-accent-primary/80"
        }`}
        data-testid={testId}
        onClick={() => void find()}
        type="button"
      >
        <MagnifyingGlassIcon
          aria-hidden="true"
          className="inline-block mr-1"
          size={14}
        />
        {FIND_MISSING_FILES_LABEL}
      </button>
      {phase === "searching" && (
        <button
          className="shrink-0 px-2 py-1 text-xs bg-surface-4 text-text-secondary rounded hover:bg-surface-3 font-semibold"
          data-testid={`${testId}-cancel`}
          onClick={() =>
            void globalThis.electronAPI?.cancelFindMissingFiles?.()
          }
          type="button"
        >
          Cancel
        </button>
      )}
    </div>
  );

  const list =
    results && (results.files.length > 0 || results.incomplete) ? (
      <FoundFilesList
        busy={inactive}
        onRestore={(file, found) => void restore(file, found)}
        results={results}
        testId={testId}
      />
    ) : null;

  return (
    <>
      {children({
        button,
        results: (
          <div aria-live="polite" data-testid={`${testId}-results`}>
            {list}
          </div>
        ),
      })}
    </>
  );
};

/** Put back one file found for a missing sample */
type Restore = (file: MissingFileSearch, found: FoundFile) => void;

/** What the search found, one entry per missing file */
const FoundFilesList: React.FC<{
  busy: boolean;
  onRestore: Restore;
  results: FindMissingFilesResult;
  testId: string;
}> = ({ busy, onRestore, results, testId }) => (
  <div className="mt-2 text-xs text-text-primary">
    {results.incomplete && (
      <p className="mb-1 text-text-secondary">
        {describeSearchIncomplete(results.incomplete, results.folderName)}
      </p>
    )}
    <ul className="space-y-1">
      {results.files.map((file) => (
        <FoundFileEntry
          busy={busy}
          file={file}
          folderName={results.folderName}
          key={file.sampleId}
          // A read-only kit isn't offered "Use this file" (decided on #823,
          // 2026-11-07); main refuses it there too
          onRestore={file.inStore || results.kitEditable ? onRestore : null}
          testId={`${testId}-file-${file.sampleId}`}
        />
      ))}
    </ul>
  </div>
);

/** One missing file: nothing found, the one file to use, or a choice */
const FoundFileEntry: React.FC<{
  busy: boolean;
  file: MissingFileSearch;
  folderName: string;
  /** Null when the file can't be put back from here */
  onRestore: null | Restore;
  testId: string;
}> = ({ busy, file, folderName, onRestore, testId }) => {
  const lineId = useId();
  const only = onlyChoice(file.found);

  if (file.found.length === 0) {
    return (
      <li data-testid={testId}>
        {describeNotFound(file.fileName, folderName)}
      </li>
    );
  }
  if (only) {
    return (
      <li
        className="flex items-start justify-between gap-3"
        data-testid={testId}
      >
        <span id={lineId}>
          {only.match
            ? describeFoundFile(file.fileName, only.where)
            : describeFoundPossibleFile(file.fileName, only.where)}
        </span>
        <RestoreButton
          busy={busy}
          describedBy={lineId}
          file={file}
          found={only}
          onRestore={onRestore}
          testId={`${testId}-restore`}
        />
      </li>
    );
  }
  return (
    <li data-testid={testId}>
      <span>{describeFoundSeveralFiles(file.found.length, file.fileName)}</span>
      <ul className="mt-1 ml-3 space-y-1">
        {file.found.map((found, index) => (
          <FoundChoice
            busy={busy}
            file={file}
            found={found}
            key={found.path}
            onRestore={onRestore}
            testId={`${testId}-choice-${index}`}
          />
        ))}
      </ul>
    </li>
  );
};

/**
 * The one file to offer: the only match (D3), else the only file found.
 * Null when the user has to choose.
 */
function onlyChoice(found: FoundFile[]): FoundFile | null {
  const matches = found.filter((f) => f.match);
  if (matches.length === 1) return matches[0];
  return found.length === 1 ? found[0] : null;
}

/** One of several files found, with where it is, its size and date */
const FoundChoice: React.FC<{
  busy: boolean;
  file: MissingFileSearch;
  found: FoundFile;
  onRestore: null | Restore;
  testId: string;
}> = ({ busy, file, found, onRestore, testId }) => {
  const id = useId();
  const name = found.path.split(/[\\/]/).at(-1) ?? file.fileName;
  return (
    <li className="flex items-start justify-between gap-3" data-testid={testId}>
      <span id={id}>
        <span className="font-mono">
          {found.where}/{name}
        </span>
        <span className="text-text-secondary">
          {" "}
          {SIZE_FORMAT.format(Math.max(1, Math.round(found.size / 1024)))},{" "}
          {new Date(found.mtimeMs).toLocaleString()}
        </span>
        {!found.match && (
          <span className="text-accent-warning"> ({POSSIBLE_MATCH_NOTE})</span>
        )}
      </span>
      <RestoreButton
        busy={busy}
        describedBy={id}
        file={file}
        found={found}
        onRestore={onRestore}
        testId={`${testId}-restore`}
      />
    </li>
  );
};

/** "Copy back" or "Use this file", described by the line it acts on */
const RestoreButton: React.FC<{
  busy: boolean;
  describedBy: string;
  file: MissingFileSearch;
  found: FoundFile;
  onRestore: null | Restore;
  testId: string;
}> = ({ busy, describedBy, file, found, onRestore, testId }) =>
  onRestore && (
    <button
      aria-describedby={describedBy}
      aria-disabled={busy}
      className={`shrink-0 px-2 py-1 text-xs bg-accent-primary text-text-inverse rounded font-semibold transition duration-150 ${
        busy ? "opacity-60 cursor-wait" : "hover:bg-accent-primary/80"
      }`}
      data-testid={testId}
      onClick={() => {
        if (!busy) onRestore(file, found);
      }}
      type="button"
    >
      {file.inStore ? COPY_BACK_LABEL : USE_THIS_FILE_LABEL}
    </button>
  );

export default FindMissingFiles;
