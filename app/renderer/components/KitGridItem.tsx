import {
  BookmarkSimpleIcon,
  CopyIcon,
  LockSimpleIcon,
  MusicNoteIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import { toCapitalCase } from "@romper/shared/kitUtilsShared";
import React, { useState } from "react";

import type {
  DuplicateKitFn,
  RequestDeleteSummaryFn,
} from "./hooks/kit-management/useKitItemActions";

import { useKitItem } from "./hooks/kit-management/useKitItem";
import { useKitItemActions } from "./hooks/kit-management/useKitItemActions";
import StereoIcon from "./icons/StereoIcon";
import { KitVoiceStrip } from "./KitVoiceStrip";
import ActionPopover from "./shared/ActionPopover";
import { KitIconRenderer } from "./shared/KitIconRenderer";
import {
  DeletePopoverContent,
  DuplicatePopoverContent,
} from "./shared/KitItemActionPopovers";
import {
  BaseKitItemProps,
  extractVoiceNames,
  KitItemRenderProps,
} from "./shared/kitItemUtils";
import { highlightMatch } from "./shared/searchHighlight";

interface KitGridItemProps extends BaseKitItemProps {
  // The NOSONAR markers below suppress S6767 false positives: every
  // one of these props is destructured and referenced multiple times
  // in the body. SonarTS's TS analyser misses the usage.
  isNew?: boolean; // NOSONAR
  onDeleteKit?: (kitName: string) => Promise<void>; // NOSONAR
  onDuplicateKit?: DuplicateKitFn; // NOSONAR
  onRequestDeleteSummary?: RequestDeleteSummaryFn; // NOSONAR
}

const getBorderStyle = (isValid: boolean, modifiedSinceSync?: boolean) => {
  if (!isValid) return "border-border-subtle opacity-70 cursor-not-allowed";
  if (modifiedSinceSync) return "border-accent-warning/40 bg-accent-warning/5";
  return "border-border-subtle";
};

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

      // Favorite pulse animation state
      const [isPulsing, setIsPulsing] = useState(false);

      // Delete/duplicate popover state machines and exit animation
      const actions = useKitItemActions({
        kitName: kit,
        onDelete,
        onDeleteKit,
        onDuplicate,
        onDuplicateKit,
        onRequestDeleteSummary,
      });

      const totalSamples =
        (sampleCounts?.[0] || 0) +
        (sampleCounts?.[1] || 0) +
        (sampleCounts?.[2] || 0) +
        (sampleCounts?.[3] || 0);
      const statusText = isValid ? `${totalSamples} samples` : "Invalid kit";
      const ariaLabel = `Kit ${kit} - ${statusText}`;

      const canDelete =
        isValid && onDeleteKit && kitData?.editable && !kitData?.locked;

      // Build animation classes
      let animationClasses = "";
      if (actions.isExiting) animationClasses = "animate-kit-exit";
      else if (isNew)
        animationClasses = "animate-kit-enter animate-border-flash";

      return (
        <div
          aria-label={ariaLabel}
          aria-selected={isSelected ? "true" : "false"}
          className={`card-grain relative flex flex-col p-2 rounded-md border text-sm h-full w-full ${getBorderStyle(isValid, kitData?.modified_since_sync)} cursor-pointer hover:bg-surface-2 hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary ${animationClasses}`}
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
                    <LockSimpleIcon
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
                  <MusicNoteIcon data-testid="icon-music-note" size={13} />{" "}
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
                  <BookmarkSimpleIcon
                    className={`${isFavorite ? "" : "opacity-30"} ${isPulsing ? "animate-favorite-pulse" : ""}`}
                    size={17}
                    weight="fill"
                  />
                </button>
              )}
              {isValid && (
                <button
                  className="p-1 text-xs text-text-tertiary hover:text-accent-success ml-1"
                  onClick={actions.handleDuplicateClick}
                  ref={actions.duplicateButtonRef}
                  title="Duplicate kit"
                >
                  <CopyIcon size={15} />
                </button>
              )}
              {canDelete && (
                <button
                  className="p-1 text-xs text-text-tertiary hover:text-accent-danger"
                  data-testid="delete-kit-button"
                  onClick={actions.handleDeleteClick}
                  ref={actions.deleteButtonRef}
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
            anchorRef={actions.deleteButtonRef}
            isOpen={actions.showDeletePopover}
            onClose={actions.closeDeletePopover}
          >
            <DeletePopoverContent
              isDeleting={actions.isDeleting}
              kitName={kit}
              onCancel={actions.closeDeletePopover}
              onConfirm={actions.handleConfirmDelete}
              sampleCount={actions.deleteSampleCount}
            />
          </ActionPopover>

          {/* Duplicate popover */}
          <ActionPopover
            anchorRef={actions.duplicateButtonRef}
            isOpen={actions.showDuplicatePopover}
            onClose={actions.closeDuplicatePopover}
          >
            <DuplicatePopoverContent
              duplicateDest={actions.duplicateDest}
              duplicateError={actions.duplicateError}
              kitName={kit}
              onCancel={actions.closeDuplicatePopover}
              onConfirm={actions.handleConfirmDuplicate}
              onDestChange={actions.setDuplicateDest}
            />
          </ActionPopover>

          {/* Voice channel strip */}
          {isValid && sampleCounts && totalSamples > 0 && (
            <KitVoiceStrip
              kitData={kitData}
              sampleCounts={sampleCounts}
              voiceNames={voiceNames}
            />
          )}

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
