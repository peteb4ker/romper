import React from 'react';

export const MessageDisplayContext = React.createContext({
  showMessage: () => {},
  dismissMessage: () => {},
});

export function MessageDisplayProvider({ children }) {
  return (
    <MessageDisplayContext.Provider value={{ showMessage: () => {}, dismissMessage: () => {} }}>
      {children}
    </MessageDisplayContext.Provider>
  );
}
