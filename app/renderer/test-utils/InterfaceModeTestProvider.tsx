import React from "react";

import {
  InterfaceMode,
  InterfaceModeProvider,
} from "../contexts/InterfaceModeContext";

interface InterfaceModeTestProviderProps {
  children: React.ReactNode;
  initialMode?: InterfaceMode;
}

export const InterfaceModeTestProvider: React.FC<
  InterfaceModeTestProviderProps
> = ({ children, initialMode = "browse" }) => {
  return <InterfaceModeProvider>{children}</InterfaceModeProvider>;
};
