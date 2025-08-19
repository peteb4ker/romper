import React from "react";

import ChangeLocalStoreDirectoryDialog from "./dialogs/ChangeLocalStoreDirectoryDialog";
import PreferencesDialog from "./dialogs/PreferencesDialog";

interface KitViewDialogsProps {
  onCloseChangeDirectory: () => void;
  onClosePreferences: () => void;
  onMessage: (text: string, type?: string, duration?: number) => void;
  showChangeDirectoryDialog: boolean;
  showPreferencesDialog: boolean;
}

/**
 * Groups all KitsView dialogs together for better organization
 * Reduces clutter in the main KitsView component
 */
const KitViewDialogs: React.FC<KitViewDialogsProps> = ({
  onCloseChangeDirectory,
  onClosePreferences,
  onMessage,
  showChangeDirectoryDialog,
  showPreferencesDialog,
}) => {
  // Pass through the message function directly
  const handleMessage = React.useCallback(
    (text: string, type?: string, duration?: number) => {
      onMessage(text, type, duration);
    },
    [onMessage]
  );

  return (
    <>
      <ChangeLocalStoreDirectoryDialog
        isOpen={showChangeDirectoryDialog}
        onClose={onCloseChangeDirectory}
        onMessage={handleMessage}
      />

      <PreferencesDialog
        isOpen={showPreferencesDialog}
        onClose={onClosePreferences}
      />
    </>
  );
};

export default React.memo(KitViewDialogs);
