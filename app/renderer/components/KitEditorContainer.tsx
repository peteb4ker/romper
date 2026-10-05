import type { DbResult, KitWithRelations } from "@romper/shared/db/schema";
import type { AnyUndoAction } from "@romper/shared/undoTypes";

import React from "react";

import type { SequenceUndo, VoiceSamples } from "./kitTypes";

import KitEditor from "./KitEditor";

interface KitEditorContainerProps {
  kit: KitWithRelations;
  kitError?: null | string;
  kitIndex: number;
  kitName: string;
  kits: KitWithRelations[];
  onAddUndoAction: (action: AnyUndoAction) => void;
  onBack: (scrollToKit?: string) => Promise<void>;
  onBpmSaved?: (kitName: string, bpm: number) => void;
  onKitModified?: (kitName: string) => void;
  onKitUpdated: () => Promise<void>;
  onMessage: (text: string, type?: string, duration?: number) => void;
  onNextKit: () => void;
  onPrevKit: () => void;
  onRefreshKitMetadata?: () => Promise<void>;
  onRequestSamplesReload: () => Promise<void>;
  onToggleEditableMode?: (kitName: string) => Promise<void>;
  onToggleFavorite?: (
    kitName: string,
  ) => Promise<DbResult<{ isFavorite: boolean }>>;
  onUpdateKitAlias?: (kitName: string, alias: string) => Promise<void>;
  samples: VoiceSamples;
  sequenceUndo?: SequenceUndo;
}

/**
 * Container component for KitEditor
 * Provides memoization and prop optimization
 */
const KitEditorContainer: React.FC<KitEditorContainerProps> = (props) => {
  const {
    kit,
    kitError,
    kitIndex,
    kitName,
    kits,
    onAddUndoAction,
    onBack,
    onBpmSaved,
    onKitModified,
    onKitUpdated,
    onMessage,
    onNextKit,
    onPrevKit,
    onRefreshKitMetadata,
    onRequestSamplesReload,
    onToggleEditableMode,
    onToggleFavorite,
    onUpdateKitAlias,
    samples,
    sequenceUndo,
  } = props;

  // Memoize callbacks to prevent unnecessary re-renders
  const handleBack = React.useCallback(
    (scrollToKit?: string) => {
      return onBack(scrollToKit);
    },
    [onBack],
  );

  const handleMessage = React.useCallback(
    (text: string, type?: string, duration?: number) => {
      onMessage(text, type, duration);
    },
    [onMessage],
  );

  const handleRequestSamplesReload = React.useCallback(() => {
    return onRequestSamplesReload();
  }, [onRequestSamplesReload]);

  return (
    <KitEditor
      kit={kit}
      kitError={kitError}
      kitIndex={kitIndex}
      kitName={kitName}
      kits={kits}
      onAddUndoAction={onAddUndoAction}
      onBack={handleBack}
      onBpmSaved={onBpmSaved}
      onKitModified={onKitModified}
      onKitUpdated={onKitUpdated}
      onMessage={handleMessage}
      onNextKit={onNextKit}
      onPrevKit={onPrevKit}
      onRefreshKitMetadata={onRefreshKitMetadata}
      onRequestSamplesReload={handleRequestSamplesReload}
      onToggleEditableMode={onToggleEditableMode}
      onToggleFavorite={onToggleFavorite}
      onUpdateKitAlias={onUpdateKitAlias}
      samples={samples}
      sequenceUndo={sequenceUndo}
    />
  );
};

export default React.memo(KitEditorContainer);
