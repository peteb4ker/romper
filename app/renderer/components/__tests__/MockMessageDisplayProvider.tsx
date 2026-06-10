import React from "react";

import { MessageDisplayContext } from "../MessageDisplayContext";

export const MockMessageDisplayProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => (
  <MessageDisplayContext.Provider
    value={{
      clearMessages: () => {},
      dismissMessage: (_id: number) => {},
      messages: [],
      showMessage: () => 0,
    }}
  >
    {children}
  </MessageDisplayContext.Provider>
);
