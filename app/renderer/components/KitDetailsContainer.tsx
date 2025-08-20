import type { KitWithRelations } from "@romper/shared/db/schema";

import React from "react";

import type { VoiceSamples } from "./kitTypes";

import KitDetails from "./KitDetails";

interface KitDetailsContainerProps {
  kit: KitWithRelations;
  kitIndex: number;
  kitName: string;
  kits: KitWithRelations[];
  onAddUndoAction: (action: any) => void;
  onBack: (scrollToKit?: any) => Promise<void>;
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
 * Container component for KitDetails
 * Provides memoization and prop optimization
 */
const KitDetailsContainer: React.FC<KitDetailsContainerProps> = (props) => {
  const {
    kit,
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
    (scrollToKit?: any) => {
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
    <KitDetails
      kit={kit}
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

export default React.memo(KitDetailsContainer);
