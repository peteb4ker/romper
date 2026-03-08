import type { KitWithRelations } from "@romper/shared/db/schema";
import type { AnyUndoAction } from "@romper/shared/undoTypes";

import React from "react";

import type { VoiceSamples } from "./kitTypes";

import KitEditor from "./KitEditor";

interface KitEditorContainerProps {
  kit: KitWithRelations;
  kitError?: null | string;
  kitIndex: number;
  kitName: string;
  kits: KitWithRelations[];
  onAddUndoAction: (action: AnyUndoAction) => void;
  onBack: (scrollToKit?: string) => Promise<void>;
  onKitUpdated: () => Promise<void>;
  onMessage: (text: string, type?: string, duration?: number) => void;
  onNextKit: () => void;
  onPrevKit: () => void;
  onRequestSamplesReload: () => Promise<void>;
  onToggleEditableMode?: (kitName: string) => Promise<void>;
  onToggleFavorite?: (
    kitName: string,
  ) => Promise<{ isFavorite?: boolean; success: boolean }>;
  onUpdateKitAlias?: (kitName: string, alias: string) => Promise<void>;
  samples: VoiceSamples;
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
    onKitUpdated,
    onMessage,
    onNextKit,
    onPrevKit,
    onRequestSamplesReload,
    onToggleEditableMode,
    onToggleFavorite,
    onUpdateKitAlias,
    samples,
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
      onKitUpdated={onKitUpdated}
      onMessage={handleMessage}
      onNextKit={onNextKit}
      onPrevKit={onPrevKit}
      onRequestSamplesReload={handleRequestSamplesReload}
      onToggleEditableMode={onToggleEditableMode}
      onToggleFavorite={onToggleFavorite}
      onUpdateKitAlias={onUpdateKitAlias}
      samples={samples}
    />
  );
};

export default React.memo(KitEditorContainer);
