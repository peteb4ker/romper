import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import BankHeader from "../BankHeader";

afterEach(() => {
  cleanup();
});

describe("BankHeader", () => {
  describe("grid variant (default)", () => {
    it("renders bank letter and name", () => {
      render(<BankHeader bank="A" bankName="Test Artist" />);
      expect(screen.getByText("A")).toBeDefined();
      expect(screen.getByText("Test Artist")).toBeDefined();
    });

    it("renders bank letter without name", () => {
      render(<BankHeader bank="B" />);
      expect(screen.getByText("B")).toBeDefined();
    });

    it("shows edit button when onBankNameChange is provided", () => {
      const onChange = vi.fn();
      render(
        <BankHeader bank="A" bankName="Artist" onBankNameChange={onChange} />,
      );
      expect(screen.getByTestId("bank-name-edit-A")).toBeDefined();
    });

    it("does not show edit button when onBankNameChange is not provided", () => {
      render(<BankHeader bank="A" bankName="Artist" />);
      expect(screen.queryByTestId("bank-name-edit-A")).toBeNull();
    });

    it("enters edit mode on pencil icon click", () => {
      const onChange = vi.fn();
      render(
        <BankHeader bank="A" bankName="Artist" onBankNameChange={onChange} />,
      );

      fireEvent.click(screen.getByTestId("bank-name-edit-A"));

      const input = screen.getByTestId("bank-name-input-A");
      expect(input).toBeDefined();
      expect((input as HTMLInputElement).value).toBe("Artist");
    });

    it("enters edit mode on name text click", () => {
      const onChange = vi.fn();
      render(
        <BankHeader bank="A" bankName="Artist" onBankNameChange={onChange} />,
      );

      fireEvent.click(screen.getByTestId("bank-name-display-A"));

      expect(screen.getByTestId("bank-name-input-A")).toBeDefined();
    });

    it("saves on Enter key", () => {
      const onChange = vi.fn();
      render(
        <BankHeader bank="A" bankName="Artist" onBankNameChange={onChange} />,
      );

      fireEvent.click(screen.getByTestId("bank-name-edit-A"));
      const input = screen.getByTestId("bank-name-input-A");
      fireEvent.change(input, { target: { value: "New Name" } });
      fireEvent.keyDown(input, { key: "Enter" });

      expect(onChange).toHaveBeenCalledWith("A", "New Name");
    });

    it("saves on blur", () => {
      const onChange = vi.fn();
      render(
        <BankHeader bank="A" bankName="Artist" onBankNameChange={onChange} />,
      );

      fireEvent.click(screen.getByTestId("bank-name-edit-A"));
      const input = screen.getByTestId("bank-name-input-A");
      fireEvent.change(input, { target: { value: "Blurred Name" } });
      fireEvent.blur(input);

      expect(onChange).toHaveBeenCalledWith("A", "Blurred Name");
    });

    it("cancels on Escape key", () => {
      const onChange = vi.fn();
      render(
        <BankHeader bank="A" bankName="Artist" onBankNameChange={onChange} />,
      );

      fireEvent.click(screen.getByTestId("bank-name-edit-A"));
      const input = screen.getByTestId("bank-name-input-A");
      fireEvent.change(input, { target: { value: "Changed" } });
      fireEvent.keyDown(input, { key: "Escape" });

      expect(onChange).not.toHaveBeenCalled();
      expect(screen.queryByTestId("bank-name-input-A")).toBeNull();
    });

    it("does not call onChange when value unchanged", () => {
      const onChange = vi.fn();
      render(
        <BankHeader bank="A" bankName="Artist" onBankNameChange={onChange} />,
      );

      fireEvent.click(screen.getByTestId("bank-name-edit-A"));
      const input = screen.getByTestId("bank-name-input-A");
      fireEvent.keyDown(input, { key: "Enter" });

      expect(onChange).not.toHaveBeenCalled();
    });

    it("calls onChange with empty string to clear name", () => {
      const onChange = vi.fn();
      render(
        <BankHeader bank="A" bankName="Artist" onBankNameChange={onChange} />,
      );

      fireEvent.click(screen.getByTestId("bank-name-edit-A"));
      const input = screen.getByTestId("bank-name-input-A");
      fireEvent.change(input, { target: { value: "" } });
      fireEvent.keyDown(input, { key: "Enter" });

      expect(onChange).toHaveBeenCalledWith("A", "");
    });
  });

  describe("list variant", () => {
    it("renders bank letter and name in list style", () => {
      render(<BankHeader bank="C" bankName="List Artist" variant="list" />);
      expect(screen.getByText("C")).toBeDefined();
      expect(screen.getByText("List Artist")).toBeDefined();
    });

    it("shows edit button in list variant", () => {
      const onChange = vi.fn();
      render(
        <BankHeader
          bank="C"
          bankName="Artist"
          onBankNameChange={onChange}
          variant="list"
        />,
      );
      expect(screen.getByTestId("bank-name-edit-C")).toBeDefined();
    });
  });
});
