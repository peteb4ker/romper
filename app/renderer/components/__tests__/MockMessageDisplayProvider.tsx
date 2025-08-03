import React from "react";

import { MessageDisplayContext } from "../MessageDisplayContext";

export const MockMessageDisplayProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => (
  <MessageDisplayContext.Provider
    value={{
      clearMessages: () => {},
      dismissMessage: () => {},
      messages: [],
      showMessage: () => {},
    }}
  >
    {children}
  </MessageDisplayContext.Provider>
);
