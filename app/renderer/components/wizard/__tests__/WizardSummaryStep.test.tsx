import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import WizardSummaryStep from "../WizardSummaryStep";

afterEach(() => {
  cleanup();
});

describe("WizardSummaryStep", () => {
  it("renders summary with source only (no sourceUrl or targetUrl)", () => {
    render(<WizardSummaryStep sourceName="Blank Folder" sourceUrl="" />);
    expect(screen.getByTestId("wizard-source-name")).toHaveTextContent(
      "Blank Folder"
    );
    expect(screen.queryByTestId("wizard-source-url")).toBeNull();
    expect(screen.queryByTestId("wizard-target-url")).toBeNull();
  });

  it("renders summary with source and sourceUrl only", () => {
    render(<WizardSummaryStep sourceName="SD Card" sourceUrl="/mock/sdcard" />);
    expect(screen.getByTestId("wizard-source-name")).toHaveTextContent(
      "SD Card"
    );
    expect(screen.getByTestId("wizard-source-url")).toHaveTextContent(
      "/mock/sdcard"
    );
    expect(screen.queryByTestId("wizard-target-url")).toBeNull();
  });

  it("renders summary with source, sourceUrl, and targetUrl", () => {
    render(
      <WizardSummaryStep
        sourceName="Squarp.net Factory Samples"
        sourceUrl="file:///mock/squarp.zip"
        targetUrl="/mock/target"
      />
    );
    expect(screen.getByTestId("wizard-source-name")).toHaveTextContent(
      "Squarp.net Factory Samples"
    );
    expect(screen.getByTestId("wizard-source-url")).toHaveTextContent(
      "file:///mock/squarp.zip"
    );
    expect(screen.getByTestId("wizard-target-url")).toHaveTextContent(
      "/mock/target"
    );
  });
});
