import React from "react";
import { beforeEach } from "vitest";

import { createElectronAPIMock } from "../mocks/electron/electronAPI";

interface TestElectronProviderProps {
  children: React.ReactNode;
  electronAPIMock?: ReturnType<typeof createElectronAPIMock>;
}

/**
 * Test provider that sets up electronAPI mock for renderer tests
 * Centralizes electronAPI setup to reduce duplication across test files
 */
export const TestElectronProvider: React.FC<TestElectronProviderProps> = ({
  children,
  electronAPIMock = createElectronAPIMock(),
}) => {
  beforeEach(() => {
    window.electronAPI = electronAPIMock;
  });

  return <>{children}</>;
};

/**
 * Higher-order component for wrapping components with electron context
 */
export const withElectronMock = <P extends object>(
  Component: React.ComponentType<P>,
  mockOverrides: Partial<typeof window.electronAPI> = {},
) => {
  return (props: P) => (
    <TestElectronProvider
      electronAPIMock={createElectronAPIMock(mockOverrides)}
    >
      <Component {...props} />
    </TestElectronProvider>
  );
};

/**
 * Setup function for tests that need electronAPI without React
 */
export const setupElectronAPI = (
  overrides: Partial<typeof window.electronAPI> = {},
) => {
  const mockAPI = createElectronAPIMock(overrides);

  beforeEach(() => {
    window.electronAPI = mockAPI;
  });

  return mockAPI;
};
