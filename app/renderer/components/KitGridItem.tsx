import {
  BookmarkSimple,
  Copy,
  LockSimple,
  MusicNote,
  TrashIcon,
  WarningIcon,
} from "@phosphor-icons/react";
import { toCapitalCase } from "@romper/shared/kitUtilsShared";
import React, { useRef, useState } from "react";

import { useKitItem } from "./hooks/kit-management/useKitItem";
import StereoIcon from "./icons/StereoIcon";
import ActionPopover from "./shared/ActionPopover";
import { KitIconRenderer } from "./shared/KitIconRenderer";
import {
  BaseKitItemProps,
  extractVoiceNames,
  KitItemRenderProps,
} from "./shared/kitItemUtils";

interface KitGridItemProps extends BaseKitItemProps {
  isNew?: boolean;
  onDeleteKit?: (kitName: string) => Promise<void>;
  onDuplicateKit?: (
    source: string,
    dest: string,
  ) => Promise<{ error?: string }>;
  onRequestDeleteSummary?: (
    kitName: string,
  ) => Promise<{ locked: boolean; sampleCount: number } | null>;
}

const EXIT_ANIMATION_MS = 250;

const stripExtension = (filename: string) => filename.replace(/\.[^.]+$/, "");

const highlightMatch = (
  text: string,
  term: string,
  markClass = "bg-accent-primary/25 text-accent-primary",
) => {
  const idx = text.toLowerCase().indexOf(term.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className={`${markClass} font-semibold rounded-sm px-0.5`}>
        {text.slice(idx, idx + term.length)}
      </mark>
      {text.slice(idx + term.length)}
    </>
  );
};

const getVoiceCountStyle = (count: number) => {
  if (count === 0) {
    return { text: "text-accent-danger", weight: "" };
  }
  if (count === 12) {
    return { text: "text-accent-success", weight: "font-bold" };
  }
  return { text: "text-accent-primary", weight: "" };
};

interface DeletePopoverContentProps {
  isDeleting: boolean;
  kitName: string;
  onCancel: () => void;
  onConfirm: () => void;
  sampleCount: number;
}

const DeletePopoverContent: React.FC<DeletePopoverContentProps> = ({
  isDeleting,
  kitName,
  onCancel,
  onConfirm,
  sampleCount,
}) => (
  <div className="flex flex-col gap-2">
    <div className="flex items-center gap-1.5">
      {sampleCount > 0 ? (
        <WarningIcon
          className="text-accent-warning flex-shrink-0"
          size={14}
          weight="bold"
        />
      ) : null}
      <span className="text-sm font-semibold text-text-primary">
        Delete kit {kitName}?
      </span>
    </div>
    {sampleCount > 0 && (
      <p className="text-xs text-text-secondary">
        {sampleCount} sample {sampleCount === 1 ? "reference" : "references"}{" "}
        will be removed. Files on disk are not affected.
      </p>
    )}
    {sampleCount === 0 && (
      <p className="text-xs text-text-tertiary">No samples. Safe to remove.</p>
    )}
    <div className="flex gap-2">
      <button
        className={`px-2 py-1 text-xs text-white rounded font-semibold inline-flex items-center gap-1 disabled:opacity-50 ${sampleCount > 0 ? "bg-accent-danger hover:bg-accent-danger/80" : "bg-accent-primary hover:bg-accent-primary/80"}`}
        data-testid="confirm-delete-button"
        disabled={isDeleting}
        onClick={(e) => {
          e.stopPropagation();
          onConfirm();
        }}
      >
        <TrashIcon size={13} />
        {isDeleting ? "Deleting..." : "Delete"}
      </button>
      <button
        className="px-2 py-1 text-xs bg-surface-4 text-text-secondary rounded hover:bg-surface-3 font-semibold"
        disabled={isDeleting}
        onClick={(e) => {
          e.stopPropagation();
          onCancel();
        }}
      >
        Cancel
      </button>
    </div>
  </div>
);

interface DuplicatePopoverContentProps {
  duplicateDest: string;
  duplicateError: null | string;
  kitName: string;
  onCancel: () => void;
  onConfirm: () => void;
  onDestChange: (value: string) => void;
}

const DuplicatePopoverContent: React.FC<DuplicatePopoverContentProps> = ({
  duplicateDest,
  duplicateError,
  kitName,
  onCancel,
  onConfirm,
  onDestChange,
}) => (
  <div className="flex flex-col gap-2">
    <label className="text-xs font-semibold text-text-primary">
      Duplicate {kitName} to:
      <input
        autoFocus
        className="ml-2 px-2 py-1 rounded border border-border-default text-sm bg-surface-2 text-text-primary w-16"
        data-testid="duplicate-dest-input"
        maxLength={3}
        onChange={(e) => onDestChange(e.target.value.toUpperCase())}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onConfirm();
          }
        }}
        value={duplicateDest}
      />
    </label>
    {duplicateError && (
      <div className="text-xs text-accent-danger">{duplicateError}</div>
    )}
    <div className="flex gap-2">
      <button
        className="px-2 py-1 text-xs bg-accent-success text-white rounded hover:bg-accent-success/80 font-semibold"
        data-testid="confirm-duplicate-button"
        onClick={(e) => {
          e.stopPropagation();
          onConfirm();
        }}
      >
        Duplicate
      </button>
      <button
        className="px-2 py-1 text-xs bg-surface-4 text-text-secondary rounded hover:bg-surface-3 font-semibold"
        onClick={(e) => {
          e.stopPropagation();
          onCancel();
        }}
      >
        Cancel
      </button>
    </div>
  </div>
);

const KitGridItem = React.memo(
  React.forwardRef<HTMLDivElement, KitGridItemProps & KitItemRenderProps>(
    (
      {
        isFavorite: isFavoriteProp,
        isNew,
        isSelected,
        isValid,
        kit,
        kitData,
        onDelete,
        onDeleteKit,
        onDuplicate,
        onDuplicateKit,
        onRequestDeleteSummary,
        onSelect,
        onToggleFavorite,
        sampleCounts,
        ...rest
      },
      ref,
    ) => {
      const voiceNames = extractVoiceNames(kitData);
      const { iconLabel, iconType } = useKitItem(voiceNames);
      const icon = <KitIconRenderer iconType={iconType} size="md" />;
      const isFavorite = isFavoriteProp ?? kitData?.is_favorite ?? false;

      // Animation states
      const [isExiting, setIsExiting] = useState(false);
      const [isPulsing, setIsPulsing] = useState(false);

      // Delete popover state
      const deleteButtonRef = useRef<HTMLButtonElement>(null);
      const [showDeletePopover, setShowDeletePopover] = useState(false);
      const [deleteSampleCount, setDeleteSampleCount] = useState<number>(0);
      const [isDeleting, setIsDeleting] = useState(false);

      // Duplicate popover state
      const duplicateButtonRef = useRef<HTMLButtonElement>(null);
      const [showDuplicatePopover, setShowDuplicatePopover] = useState(false);
      const [duplicateDest, setDuplicateDest] = useState("");
      const [duplicateError, setDuplicateError] = useState<null | string>(null);

      const handleDeleteClick = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (onRequestDeleteSummary) {
          const summary = await onRequestDeleteSummary(kit);
          if (!summary) return; // locked or error
          setDeleteSampleCount(summary.sampleCount);
          setShowDeletePopover(true);
        } else if (onDelete) {
          onDelete();
        }
      };

      const handleConfirmDelete = async () => {
        if (!onDeleteKit) return;
        setIsDeleting(true);
        try {
          setShowDeletePopover(false);
          setIsExiting(true);
          await new Promise<void>((resolve) => {
            setTimeout(resolve, EXIT_ANIMATION_MS);
          });
          await onDeleteKit(kit);
        } catch {
          // Only reset if deletion failed — component stays mounted
          setIsDeleting(false);
          setIsExiting(false);
        }
      };

      const handleDuplicateClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (onDuplicateKit) {
          setDuplicateDest("");
          setDuplicateError(null);
          setShowDuplicatePopover(true);
        } else {
          onDuplicate();
        }
      };

      const handleConfirmDuplicate = async () => {
        if (!onDuplicateKit) return;
        const result = await onDuplicateKit(kit, duplicateDest);
        if (result.error) {
          setDuplicateError(result.error);
        } else {
          setShowDuplicatePopover(false);
          setDuplicateDest("");
          setDuplicateError(null);
        }
      };

      const totalSamples =
        (sampleCounts?.[0] || 0) +
        (sampleCounts?.[1] || 0) +
        (sampleCounts?.[2] || 0) +
        (sampleCounts?.[3] || 0);
      const statusText = !isValid ? "Invalid kit" : `${totalSamples} samples`;
      const ariaLabel = `Kit ${kit} - ${statusText}`;

      const canDelete =
        isValid && onDeleteKit && kitData?.editable && !kitData?.locked;

      // Build animation classes
      const animationClasses = isExiting
        ? "animate-kit-exit"
        : isNew
          ? "animate-kit-enter animate-border-flash"
          : "";

      return (
        <div
          aria-label={ariaLabel}
          aria-selected={isSelected ? "true" : "false"}
          className={`card-grain relative flex flex-col p-2 rounded-md border text-sm h-full w-full ${
            !isValid
              ? "border-border-subtle opacity-70 cursor-not-allowed"
              : kitData?.modified_since_sync
                ? "border-accent-warning/40 bg-accent-warning/5"
                : "border-border-subtle"
          } cursor-pointer hover:bg-surface-2 hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary ${animationClasses}`}
          data-kit={kit}
          data-testid={`kit-item-${kit}`}
          onClick={onSelect}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onSelect();
            }
          }}
          ref={ref}
          role="option"
          tabIndex={isSelected ? 0 : -1}
          {...rest}
        >
          {/* Top row: icon, kit name, status icons, actions */}
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span title={iconLabel}>{icon}</span>
              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                <span
                  className={`font-mono text-[15px] font-semibold tracking-wide flex-shrink-0 ${
                    isValid ? "text-text-primary" : "text-accent-danger"
                  }`}
                >
                  {kit}
                </span>
                {isValid && !kitData?.editable && (
                  <span
                    className="flex-shrink-0"
                    data-testid="lock-icon"
                    title="Factory kit (read-only)"
                  >
                    <LockSimple
                      className="text-text-secondary"
                      size={15}
                      weight="bold"
                    />
                  </span>
                )}
                {kitData?.voices?.some((v) => v.stereo_mode) && (
                  <span
                    className={`flex-shrink-0 ${kitData?.searchMatch?.matchedOn?.includes("stereo") ? "text-accent-primary" : "text-text-tertiary"}`}
                    data-testid="stereo-indicator"
                    title="Has stereo-linked voices"
                  >
                    <StereoIcon size={15} />
                  </span>
                )}
                {kitData?.alias && (
                  <>
                    <span className="text-text-tertiary flex-shrink-0">·</span>
                    <span
                      className="text-[15px] text-text-secondary truncate"
                      title={`Kit alias: ${kitData.alias}`}
                    >
                      {kitData.searchMatch?.matchedAlias &&
                      kitData.searchMatch.searchTerm
                        ? highlightMatch(
                            kitData.alias,
                            kitData.searchMatch.searchTerm,
                          )
                        : kitData.alias}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Search match indicators (artist only — alias highlighted inline, samples shown in voice strip) */}
            {isValid && kitData?.searchMatch?.matchedArtist && (
              <div className="flex flex-wrap gap-1 ml-1">
                <span
                  className="px-1 py-0.5 text-xs bg-voice-3-muted text-voice-3 rounded border border-voice-3/30 font-mono truncate inline-flex items-center gap-0.5"
                  title={`Artist: ${kitData.searchMatch.matchedArtist}`}
                >
                  <MusicNote data-testid="icon-music-note" size={13} />{" "}
                  {kitData.searchMatch.matchedArtist}
                </span>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-1">
              {onToggleFavorite && (
                <button
                  className={`p-1 text-xs ml-1 transition-colors duration-150 ${
                    isFavorite
                      ? "text-accent-favorite hover:brightness-110"
                      : "text-text-tertiary hover:text-accent-favorite"
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    // Pulse on favorite add (not remove)
                    if (!isFavorite) {
                      setIsPulsing(true);
                      setTimeout(() => setIsPulsing(false), 200);
                    }
                    onToggleFavorite(kit);
                  }}
                  title={
                    isFavorite ? "Remove from favorites" : "Add to favorites"
                  }
                >
                  <BookmarkSimple
                    className={`${isFavorite ? "" : "opacity-30"} ${isPulsing ? "animate-favorite-pulse" : ""}`}
                    size={17}
                    weight="fill"
                  />
                </button>
              )}
              {isValid && (
                <button
                  className="p-1 text-xs text-text-tertiary hover:text-accent-success ml-1"
                  onClick={handleDuplicateClick}
                  ref={duplicateButtonRef}
                  title="Duplicate kit"
                >
                  <Copy size={15} />
                </button>
              )}
              {canDelete && (
                <button
                  className="p-1 text-xs text-text-tertiary hover:text-accent-danger"
                  data-testid="delete-kit-button"
                  onClick={handleDeleteClick}
                  ref={deleteButtonRef}
                  title="Delete kit"
                >
                  <TrashIcon size={15} />
                </button>
              )}
              {/* Legacy: support old onDelete without popover */}
              {isValid &&
                !onDeleteKit &&
                onDelete &&
                kitData?.editable &&
                !kitData?.locked && (
                  <button
                    className="p-1 text-xs text-text-tertiary hover:text-accent-danger"
                    data-testid="delete-kit-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete();
                    }}
                    title="Delete kit"
                  >
                    <TrashIcon size={15} />
                  </button>
                )}
            </div>
          </div>

          {/* Delete confirmation popover */}
          <ActionPopover
            anchorRef={deleteButtonRef}
            isOpen={showDeletePopover}
            onClose={() => setShowDeletePopover(false)}
          >
            <DeletePopoverContent
              isDeleting={isDeleting}
              kitName={kit}
              onCancel={() => setShowDeletePopover(false)}
              onConfirm={handleConfirmDelete}
              sampleCount={deleteSampleCount}
            />
          </ActionPopover>

          {/* Duplicate popover */}
          <ActionPopover
            anchorRef={duplicateButtonRef}
            isOpen={showDuplicatePopover}
            onClose={() => {
              setShowDuplicatePopover(false);
              setDuplicateError(null);
            }}
          >
            <DuplicatePopoverContent
              duplicateDest={duplicateDest}
              duplicateError={duplicateError}
              kitName={kit}
              onCancel={() => {
                setShowDuplicatePopover(false);
                setDuplicateError(null);
              }}
              onConfirm={handleConfirmDuplicate}
              onDestChange={setDuplicateDest}
            />
          </ActionPopover>

          {/* Voice channel strip */}
          {isValid &&
            sampleCounts &&
            totalSamples > 0 &&
            (() => {
              const matchesByVoice =
                kitData?.searchMatch?.matchedSamplesByVoice;
              const hasVoiceMatches =
                matchesByVoice && Object.keys(matchesByVoice).length > 0;

              return (
                <>
                  <div className="border-t border-border-subtle mt-1.5 mb-1" />
                  <div className="flex items-start gap-1 w-full">
                    {sampleCounts.map((count, idx) => {
                      const voiceNumber = idx + 1;
                      const voiceName = voiceNames?.[voiceNumber];
                      const voiceDisplayName =
                        typeof voiceName === "string"
                          ? toCapitalCase(voiceName)
                          : voiceName;
                      const countStyle = getVoiceCountStyle(count);
                      const voiceMatches = matchesByVoice?.[voiceNumber];
                      const hasMatches =
                        voiceMatches && voiceMatches.length > 0;
                      const displayLabel =
                        voiceDisplayName ||
                        (hasVoiceMatches ? `Voice ${voiceNumber}` : "\u00A0");

                      return (
                        <div
                          className={`w-1/4 flex flex-col items-center ${
                            hasVoiceMatches && !hasMatches
                              ? "opacity-30 justify-center"
                              : "gap-0.5"
                          }`}
                          key={`voice-${voiceNumber}`}
                          title={
                            `Voice ${voiceNumber}: ${count} samples` +
                            (voiceName ? ` (${voiceName})` : "")
                          }
                        >
                          <span className="text-[11px] text-text-secondary font-mono truncate w-full text-center">
                            {displayLabel}
                          </span>
                          {hasMatches ? (
                            <div
                              className="w-full overflow-hidden transition-all duration-300 ease-in-out"
                              data-testid={`voice-${voiceNumber}-matches`}
                              style={{
                                maxHeight: `${voiceMatches.length * 1.25 + 0.25}rem`,
                              }}
                            >
                              {voiceMatches.map((filename) => {
                                const stripped = stripExtension(filename);
                                const term = kitData?.searchMatch?.searchTerm;
                                return (
                                  <span
                                    className="block text-[10px] font-mono text-text-secondary truncate w-full text-center leading-tight"
                                    key={filename}
                                    title={filename}
                                  >
                                    {term
                                      ? highlightMatch(
                                          stripped,
                                          term,
                                          "bg-accent-success/25 text-accent-success",
                                        )
                                      : stripped}
                                  </span>
                                );
                              })}
                            </div>
                          ) : hasVoiceMatches ? null : (
                            <span
                              className={`text-[13px] font-mono ${countStyle.text} ${countStyle.weight}`}
                            >
                              {count}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              );
            })()}

          {/* Voice names row — shown when voices have names but no samples to display them in */}
          {isValid &&
            (!sampleCounts || totalSamples === 0) &&
            voiceNames &&
            Object.keys(voiceNames).length > 0 && (
              <>
                <div className="border-t border-border-subtle mt-1.5 mb-1" />
                <div className="flex items-center gap-1 flex-wrap">
                  {Object.entries(voiceNames).map(([voiceNum, name]) => (
                    <span
                      className="text-[11px] text-text-secondary font-mono truncate"
                      key={`voice-name-${voiceNum}`}
                    >
                      {typeof name === "string" ? toCapitalCase(name) : name}
                    </span>
                  ))}
                </div>
              </>
            )}
        </div>
      );
    },
  ),
);

KitGridItem.displayName = "KitGridItem";
export default KitGridItem;
