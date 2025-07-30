import React, { createContext, useCallback, useContext, useState } from "react";

// Interface modes for different user journeys
export type InterfaceMode = "browse" | "edit" | "sync";

interface InterfaceModeContextType {
  mode: InterfaceMode;
  setMode: (mode: InterfaceMode) => void;
  isEditMode: boolean;
  isBrowseMode: boolean;
  isSyncMode: boolean;
}

const InterfaceModeContext = createContext<InterfaceModeContextType | null>(
  null,
);

export const useInterfaceMode = () => {
  const context = useContext(InterfaceModeContext);
  if (!context) {
    throw new Error(
      "useInterfaceMode must be used within InterfaceModeProvider",
    );
  }
  return context;
};

interface InterfaceModeProviderProps {
  children: React.ReactNode;
}

export const InterfaceModeProvider: React.FC<InterfaceModeProviderProps> = ({
  children,
}) => {
  const [mode, setModeState] = useState<InterfaceMode>("browse");

  const setMode = useCallback((newMode: InterfaceMode) => {
    setModeState(newMode);
    // Log mode changes for debugging
    console.log(`[InterfaceMode] Switching to ${newMode} mode`);
  }, []);

  const value: InterfaceModeContextType = {
    mode,
    setMode,
    isEditMode: mode === "edit",
    isBrowseMode: mode === "browse",
    isSyncMode: mode === "sync",
  };

  return (
    <InterfaceModeContext.Provider value={value}>
      {children}
    </InterfaceModeContext.Provider>
  );
};
