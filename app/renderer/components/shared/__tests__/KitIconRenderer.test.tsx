import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { KitIconRenderer } from "../KitIconRenderer";

describe("KitIconRenderer", () => {
  describe("Icon Type Rendering", () => {
    it("should render mic icon", () => {
      const { container } = render(<KitIconRenderer iconType="mic" />);
      const icon = container.querySelector("svg");
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveClass("text-voice-1");
    });

    it("should render loop icon", () => {
      const { container } = render(<KitIconRenderer iconType="loop" />);
      const icon = container.querySelector("svg");
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveClass("text-voice-4");
    });

    it("should render fx icon", () => {
      const { container } = render(<KitIconRenderer iconType="fx" />);
      const icon = container.querySelector("svg");
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveClass("text-voice-3");
    });

    it("should render piano icon", () => {
      const { container } = render(<KitIconRenderer iconType="piano" />);
      const icon = container.querySelector("svg");
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveClass("text-accent-primary");
    });

    it("should render drumkit icon", () => {
      const { container } = render(<KitIconRenderer iconType="drumkit" />);
      const icon = container.querySelector("svg");
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveClass("text-accent-warning");
    });

    it("should render folder icon by default for unknown types", () => {
      const { container } = render(<KitIconRenderer iconType="unknown" />);
      const icon = container.querySelector("svg");
      expect(icon).toBeInTheDocument();
    });

    it("should render folder icon for folder type", () => {
      const { container } = render(<KitIconRenderer iconType="folder" />);
      const icon = container.querySelector("svg");
      expect(icon).toBeInTheDocument();
    });
  });

  describe("Size Props", () => {
    it("should render small size icon", () => {
      const { container } = render(
        <KitIconRenderer iconType="mic" size="sm" />,
      );
      const icon = container.querySelector("svg");
      expect(icon).toBeInTheDocument();
    });

    it("should render medium size icon by default", () => {
      const { container } = render(<KitIconRenderer iconType="mic" />);
      const icon = container.querySelector("svg");
      expect(icon).toBeInTheDocument();
    });

    it("should render large size icon", () => {
      const { container } = render(
        <KitIconRenderer iconType="mic" size="lg" />,
      );
      const icon = container.querySelector("svg");
      expect(icon).toBeInTheDocument();
    });
  });

  describe("Custom Classes", () => {
    it("should apply custom className", () => {
      const { container } = render(
        <KitIconRenderer className="custom-class" iconType="mic" />,
      );
      const icon = container.querySelector("svg");
      expect(icon).toHaveClass("custom-class");
    });

    it("should apply both size and custom classes", () => {
      const { container } = render(
        <KitIconRenderer className="custom-class" iconType="piano" size="lg" />,
      );
      const icon = container.querySelector("svg");
      expect(icon).toHaveClass("custom-class");
    });

    it("should handle empty className gracefully", () => {
      const { container } = render(
        <KitIconRenderer className="" iconType="drumkit" />,
      );
      const icon = container.querySelector("svg");
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveClass("text-accent-warning");
    });
  });

  describe("Icon Accessibility", () => {
    it("should render svg elements", () => {
      const iconTypes = ["mic", "loop", "fx", "piano", "drumkit", "folder"];

      iconTypes.forEach((iconType) => {
        const { container } = render(<KitIconRenderer iconType={iconType} />);
        const icon = container.querySelector("svg");
        expect(icon).toBeInTheDocument();
      });
    });
  });

  describe("Component Stability", () => {
    it("should handle undefined iconType gracefully", () => {
      const { container } = render(
        <KitIconRenderer iconType={undefined as unknown} />,
      );
      const icon = container.querySelector("svg");
      expect(icon).toBeInTheDocument(); // Should render default folder icon
    });

    it("should handle null iconType gracefully", () => {
      const { container } = render(
        <KitIconRenderer iconType={null as unknown} />,
      );
      const icon = container.querySelector("svg");
      expect(icon).toBeInTheDocument(); // Should render default folder icon
    });

    it("should handle empty string iconType", () => {
      const { container } = render(<KitIconRenderer iconType="" />);
      const icon = container.querySelector("svg");
      expect(icon).toBeInTheDocument(); // Should render default folder icon
    });
  });

  describe("Color Theme Classes", () => {
    it("should include token-based classes for mic icon", () => {
      const { container } = render(<KitIconRenderer iconType="mic" />);
      const icon = container.querySelector("svg");
      expect(icon).toHaveClass("text-voice-1");
    });

    it("should include token-based classes for loop icon", () => {
      const { container } = render(<KitIconRenderer iconType="loop" />);
      const icon = container.querySelector("svg");
      expect(icon).toHaveClass("text-voice-4");
    });

    it("should include token-based classes for fx icon", () => {
      const { container } = render(<KitIconRenderer iconType="fx" />);
      const icon = container.querySelector("svg");
      expect(icon).toHaveClass("text-voice-3");
    });

    it("should include token-based classes for piano icon", () => {
      const { container } = render(<KitIconRenderer iconType="piano" />);
      const icon = container.querySelector("svg");
      expect(icon).toHaveClass("text-accent-primary");
    });

    it("should include token-based classes for drumkit icon", () => {
      const { container } = render(<KitIconRenderer iconType="drumkit" />);
      const icon = container.querySelector("svg");
      expect(icon).toHaveClass("text-accent-warning");
    });
  });
});
