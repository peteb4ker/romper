import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { KitIconRenderer } from "../KitIconRenderer";

describe("KitIconRenderer", () => {
  describe("Icon Type Rendering", () => {
    it("should render mic icon", () => {
      const { container } = render(<KitIconRenderer iconType="mic" />);
      const icon = container.querySelector("svg");
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveClass("text-pink-600", "dark:text-pink-300");
    });

    it("should render loop icon", () => {
      const { container } = render(<KitIconRenderer iconType="loop" />);
      const icon = container.querySelector("svg");
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveClass("text-amber-600", "dark:text-amber-300");
    });

    it("should render fx icon", () => {
      const { container } = render(<KitIconRenderer iconType="fx" />);
      const icon = container.querySelector("svg");
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveClass("text-indigo-600", "dark:text-indigo-300");
    });

    it("should render piano icon", () => {
      const { container } = render(<KitIconRenderer iconType="piano" />);
      const icon = container.querySelector("svg");
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveClass("text-blue-700", "dark:text-blue-300");
    });

    it("should render drumkit icon", () => {
      const { container } = render(<KitIconRenderer iconType="drumkit" />);
      const icon = container.querySelector("svg");
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveClass("text-yellow-700", "dark:text-yellow-300");
    });

    it("should render folder icon by default for unknown types", () => {
      const { container } = render(<KitIconRenderer iconType="unknown" />);
      const icon = container.querySelector("svg");
      expect(icon).toBeInTheDocument();
      // Folder icon doesn't have special colors, just base classes
      expect(icon).toHaveClass("text-2xl"); // default size
    });

    it("should render folder icon for folder type", () => {
      const { container } = render(<KitIconRenderer iconType="folder" />);
      const icon = container.querySelector("svg");
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveClass("text-2xl"); // default size
    });
  });

  describe("Size Classes", () => {
    it("should apply small size class", () => {
      const { container } = render(
        <KitIconRenderer iconType="mic" size="sm" />,
      );
      const icon = container.querySelector("svg");
      expect(icon).toHaveClass("text-xl");
    });

    it("should apply medium size class by default", () => {
      const { container } = render(<KitIconRenderer iconType="mic" />);
      const icon = container.querySelector("svg");
      expect(icon).toHaveClass("text-2xl");
    });

    it("should apply large size class", () => {
      const { container } = render(
        <KitIconRenderer iconType="mic" size="lg" />,
      );
      const icon = container.querySelector("svg");
      expect(icon).toHaveClass("text-3xl");
    });
  });

  describe("Custom Classes", () => {
    it("should apply custom className", () => {
      const { container } = render(
        <KitIconRenderer iconType="mic" className="custom-class" />,
      );
      const icon = container.querySelector("svg");
      expect(icon).toHaveClass("custom-class");
    });

    it("should apply both size and custom classes", () => {
      const { container } = render(
        <KitIconRenderer
          iconType="piano"
          size="lg"
          className="custom-class"
        />,
      );
      const icon = container.querySelector("svg");
      expect(icon).toHaveClass("text-3xl", "custom-class");
    });

    it("should handle empty className gracefully", () => {
      const { container } = render(
        <KitIconRenderer iconType="drumkit" className="" />,
      );
      const icon = container.querySelector("svg");
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveClass("text-2xl"); // default size still applied
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
        <KitIconRenderer iconType={undefined as any} />,
      );
      const icon = container.querySelector("svg");
      expect(icon).toBeInTheDocument(); // Should render default folder icon
    });

    it("should handle null iconType gracefully", () => {
      const { container } = render(
        <KitIconRenderer iconType={null as any} />,
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
    it("should include dark mode classes for mic icon", () => {
      const { container } = render(<KitIconRenderer iconType="mic" />);
      const icon = container.querySelector("svg");
      expect(icon).toHaveClass("dark:text-pink-300");
    });

    it("should include dark mode classes for loop icon", () => {
      const { container } = render(<KitIconRenderer iconType="loop" />);
      const icon = container.querySelector("svg");
      expect(icon).toHaveClass("dark:text-amber-300");
    });

    it("should include dark mode classes for fx icon", () => {
      const { container } = render(<KitIconRenderer iconType="fx" />);
      const icon = container.querySelector("svg");
      expect(icon).toHaveClass("dark:text-indigo-300");
    });

    it("should include dark mode classes for piano icon", () => {
      const { container } = render(<KitIconRenderer iconType="piano" />);
      const icon = container.querySelector("svg");
      expect(icon).toHaveClass("dark:text-blue-300");
    });

    it("should include dark mode classes for drumkit icon", () => {
      const { container } = render(<KitIconRenderer iconType="drumkit" />);
      const icon = container.querySelector("svg");
      expect(icon).toHaveClass("dark:text-yellow-300");
    });
  });
});