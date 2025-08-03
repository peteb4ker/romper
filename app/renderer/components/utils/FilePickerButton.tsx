import React from "react";

import Spinner from "./Spinner";

interface FilePickerButtonProps {
  /** The text to display when not selecting */
  children: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
  /** Test ID for the button */
  "data-testid"?: string;
  /** Whether the button should be disabled (in addition to selection state) */
  disabled?: boolean;
  /** Icon to show alongside text (optional) */
  icon?: React.ReactNode;
  /** Whether the file picker is currently active */
  isSelecting: boolean;
  /** Function to call when button is clicked */
  onClick: () => Promise<void> | void;
  /** Custom text to show when selecting (defaults to "Selecting...") */
  selectingText?: string;
}

/**
 * Reusable file picker button with consistent selecting state UX
 * Shows spinner, "Selecting..." text, and disabled state when active
 */
const FilePickerButton: React.FC<FilePickerButtonProps> = ({
  children,
  className = "",
  "data-testid": testId,
  disabled = false,
  icon,
  isSelecting,
  onClick,
  selectingText = "Selecting...",
}) => {
  const handleClick = async () => {
    if (isSelecting || disabled) return;
    await onClick();
  };

  const isDisabled = isSelecting || disabled;

  return (
    <button
      className={`disabled:opacity-50 flex items-center justify-center gap-2 ${className}`}
      data-testid={testId}
      disabled={isDisabled}
      onClick={handleClick}
      type="button"
    >
      {isSelecting ? (
        <>
          <Spinner className="mr-2" data-testid="spinner" size={18} />{" "}
          {selectingText}
        </>
      ) : (
        <>
          {icon}
          {children}
        </>
      )}
    </button>
  );
};

export default FilePickerButton;
