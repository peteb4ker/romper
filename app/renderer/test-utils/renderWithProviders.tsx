import { render, RenderOptions, RenderResult } from "@testing-library/react";
import React from "react";

interface WrapperProps {
  children: React.ReactNode;
}

export const AllTheProviders: React.FC<WrapperProps> = ({ children }) => {
  return <>{children}</>;
};

interface CustomRenderOptions extends Omit<RenderOptions, "wrapper"> {}

const customRender = (
  ui: React.ReactElement,
  options?: CustomRenderOptions,
): RenderResult => {
  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <AllTheProviders>{children}</AllTheProviders>
  );
  return render(ui, { wrapper: Wrapper, ...options });
};

export * from "@testing-library/react";
export { customRender as render };
