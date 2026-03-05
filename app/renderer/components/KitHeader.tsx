import type { Kit, KitWithRelations } from "@romper/shared/db/schema";

import {
  ArrowLeft,
  ArrowsClockwise,
  BookmarkSimple,
  CaretLeft,
  CaretRight,
  Circle,
  Lock,
  PencilSimple,
} from "@phosphor-icons/react";
import React, { useCallback } from "react";

import LedIconGrid from "./led-icon/LedIconGrid";

interface KitHeaderProps {
  editingKitAlias: boolean;
  handleSaveKitAlias: (alias: string) => void;
  isEditable?: boolean;
  kit: Kit | null;
  kitAliasInput: string;
  kitAliasInputRef: React.RefObject<HTMLInputElement>;
  kitIndex?: number;
  kitName: string;
  kits?: KitWithRelations[];
  onBack?: (scrollToKit?: string) => void;
  onNextKit?: () => void;
  onPrevKit?: () => void;
  onScanKit?: () => void;
  onToggleEditableMode?: () => void;
  onToggleFavorite?: (kitName: string) => void;
  setEditingKitAlias: (v: boolean) => void;
  setKitAliasInput: (v: string) => void;
}

// Helper function to render navigation button content
const renderNavigationButtonContent = (
  isNext: boolean,
  kitIndex: number,
  kits: KitWithRelations[],
  Icon: React.ComponentType<{ className?: string; size?: number }>,
) => {
  const targetIndex = isNext ? kitIndex + 1 : kitIndex - 1;
  const hasTargetKit = isNext ? kitIndex < kits.length - 1 : kitIndex > 0;
  const kitName = hasTargetKit ? kits[targetIndex]?.name || "" : "";

  return (
    <>
      {!isNext && <Icon className="inline-block mr-1" />}
      {kitName}
      {isNext && <Icon className="inline-block ml-1" />}
    </>
  );
};

// Helper function to get button navigation state
const getNavigationButtonState = (
  isNext: boolean,
  kitIndex: number,
  kits: KitWithRelations[],
) => {
  const isDisabled = isNext ? kitIndex === kits.length - 1 : kitIndex === 0;
  const targetIndex = isNext ? kitIndex + 1 : kitIndex - 1;
  const hasTargetKit = isNext ? kitIndex < kits.length - 1 : kitIndex > 0;
  const kitName = hasTargetKit ? kits[targetIndex]?.name || "" : "";

  return {
    isDisabled,
    style: isDisabled ? { cursor: "not-allowed", opacity: 0.5 } : {},
    title: hasTargetKit
      ? `${isNext ? "Next" : "Previous"} Kit: ${kitName}`
      : `No ${isNext ? "next" : "previous"} kit`,
  };
};

// Helper function to render kit alias input
const renderKitAliasInput = (
  kitAliasInput: string,
  kitAliasInputRef: React.RefObject<HTMLInputElement>,
  setEditingKitAlias: (v: boolean) => void,
  setKitAliasInput: (v: string) => void,
  handleSaveKitAlias: (alias: string) => void,
  kit: Kit | null,
) => (
  <input
    autoFocus
    className="border-b border-accent-primary bg-transparent text-base font-semibold text-text-primary focus:outline-none px-1 w-48 text-center"
    onBlur={() => {
      setEditingKitAlias(false);
      handleSaveKitAlias(kitAliasInput.trim());
    }}
    onChange={(e) => setKitAliasInput(e.target.value)}
    onKeyDown={(e) => {
      if (e.key === "Enter") {
        setEditingKitAlias(false);
        handleSaveKitAlias(kitAliasInput.trim());
      } else if (e.key === "Escape") {
        setEditingKitAlias(false);
        setKitAliasInput(kit?.alias || "");
      }
    }}
    ref={kitAliasInputRef}
    value={kitAliasInput}
  />
);

// Helper function to render kit alias button
const renderKitAliasButton = (
  setEditingKitAlias: (v: boolean) => void,
  kit: Kit | null,
) => (
  <button
    className="font-semibold text-base text-accent-primary cursor-pointer hover:underline bg-transparent border-none p-0 text-center"
    onClick={() => setEditingKitAlias(true)}
    onKeyDown={(e) => {
      if (e.key === "Enter" || e.key === " ") {
        setEditingKitAlias(true);
      }
    }}
    title="Edit kit name"
  >
    {kit?.alias || <span className="italic text-text-tertiary">(no name)</span>}
  </button>
);

const KitHeader: React.FC<KitHeaderProps> = ({
  editingKitAlias,
  handleSaveKitAlias,
  isEditable,
  kit,
  kitAliasInput,
  kitAliasInputRef,
  kitIndex,
  kitName,
  kits,
  onBack,
  onNextKit,
  onPrevKit,
  onScanKit,
  onToggleEditableMode,
  onToggleFavorite,
  setEditingKitAlias,
  setKitAliasInput,
}) => {
  // Simple back handler without artificial guards
  const handleBack = useCallback(() => {
    if (!onBack) return;
    onBack();
  }, [onBack]);

  // Get navigation button states
  const prevButtonState =
    kits && kitIndex !== undefined
      ? getNavigationButtonState(false, kitIndex, kits)
      : null;
  const nextButtonState =
    kits && kitIndex !== undefined
      ? getNavigationButtonState(true, kitIndex, kits)
      : null;

  return (
    <div className="sticky top-0 z-10 bg-surface-2 px-3 py-2 flex items-center gap-2 border-b border-border-subtle">
      {/* App Icon */}
      <LedIconGrid />

      {/* Left side: Navigation buttons */}
      <div className="flex items-center gap-2">
        {onBack && (
          <button
            className="px-2 py-1 text-xs bg-surface-3 text-text-primary rounded hover:bg-surface-4 transition duration-150"
            onClick={handleBack}
            title="Back"
          >
            <ArrowLeft className="inline-block mr-1" size={14} /> Back
          </button>
        )}
        {onPrevKit && prevButtonState && (
          <button
            className="px-2 py-1 text-xs bg-accent-primary/15 text-accent-primary rounded w-16 transition duration-150 hover:bg-accent-primary/25"
            disabled={prevButtonState.isDisabled}
            onClick={onPrevKit}
            style={prevButtonState.style}
            title={prevButtonState.title}
          >
            {renderNavigationButtonContent(false, kitIndex!, kits!, CaretLeft)}
          </button>
        )}
        {onNextKit && nextButtonState && (
          <button
            className="px-2 py-1 text-xs bg-accent-primary/15 text-accent-primary rounded w-16 transition duration-150 hover:bg-accent-primary/25"
            disabled={nextButtonState.isDisabled}
            onClick={onNextKit}
            style={nextButtonState.style}
            title={nextButtonState.title}
          >
            {renderNavigationButtonContent(true, kitIndex!, kits!, CaretRight)}
          </button>
        )}
      </div>

      {/* Center spacer */}
      <div className="flex-1" />

      {/* Center: Kit name */}
      <div className="flex items-center justify-center gap-2 min-w-0 flex-1">
        <span className="font-mono text-lg font-bold text-text-primary">
          {kitName}
        </span>
        <span className="text-lg font-bold text-text-primary">:</span>
        <div className="min-w-[8rem] flex justify-center">
          {editingKitAlias
            ? renderKitAliasInput(
                kitAliasInput,
                kitAliasInputRef,
                setEditingKitAlias,
                setKitAliasInput,
                handleSaveKitAlias,
                kit,
              )
            : renderKitAliasButton(setEditingKitAlias, kit)}
        </div>

        {/* Favorite bookmark button */}
        {onToggleFavorite && (
          <button
            className={`ml-3 p-2 transition-colors duration-150 rounded-full hover:bg-surface-3 ${
              kit?.is_favorite
                ? "text-accent-favorite hover:brightness-110"
                : "text-text-tertiary hover:text-accent-favorite"
            }`}
            onClick={() => onToggleFavorite(kitName)}
            title={
              kit?.is_favorite ? "Remove from favorites" : "Add to favorites"
            }
          >
            <BookmarkSimple
              className={kit?.is_favorite ? "" : "opacity-30"}
              size={20}
              weight="fill"
            />
          </button>
        )}
      </div>

      {/* Right side spacer */}
      <div className="flex-1" />

      {/* Right side: Action buttons */}
      <div className="flex items-center gap-2">
        {onToggleEditableMode && (
          <div className="flex items-center gap-2">
            {kit?.modified_since_sync && (
              <div className="flex items-center gap-1 mr-2">
                <Circle
                  className="text-accent-warning"
                  size={12}
                  weight="fill"
                />
                <span className="text-xs font-medium text-accent-warning">
                  Modified
                </span>
              </div>
            )}
            <span className="text-xs font-medium text-text-secondary w-12">
              {isEditable ? "Editable" : "Locked"}
            </span>
            <button
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-accent-sync focus:ring-offset-2 ${
                isEditable ? "bg-accent-sync" : "bg-surface-3"
              }`}
              onClick={onToggleEditableMode}
              title={`${isEditable ? "Disable" : "Enable"} editable mode`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${
                  isEditable ? "translate-x-6" : "translate-x-1"
                }`}
              />
              <span className="sr-only">
                {isEditable ? "Disable" : "Enable"} editable mode
              </span>
            </button>
            {isEditable ? (
              <PencilSimple className="text-accent-sync" size={16} />
            ) : (
              <Lock className="text-text-tertiary" size={16} />
            )}
          </div>
        )}

        {onScanKit && (
          <button
            className="ml-2 px-2 py-1 text-xs bg-accent-success text-text-inverse rounded shadow hover:brightness-110 font-semibold flex items-center transition duration-150"
            onClick={onScanKit}
            title="Perform comprehensive kit scan (voice names, WAV analysis, artist metadata)"
          >
            <ArrowsClockwise className="inline-block mr-1" size={14} />
            Scan Kit
          </button>
        )}
      </div>
    </div>
  );
};

export default KitHeader;
