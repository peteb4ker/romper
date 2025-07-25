import React from "react";
import Spinner from "./Spinner";

interface FilePickerButtonProps {
  /** The text to display when not selecting */
  children: React.ReactNode;
  /** Whether the file picker is currently active */
  isSelecting: boolean;
  /** Function to call when button is clicked */
  onClick: () => void | Promise<void>;
  /** Whether the button should be disabled (in addition to selection state) */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Test ID for the button */
  "data-testid"?: string;
  /** Icon to show alongside text (optional) */
  icon?: React.ReactNode;
  /** Custom text to show when selecting (defaults to "Selecting...") */
  selectingText?: string;
}

/**
 * Reusable file picker button with consistent selecting state UX
 * Shows spinner, "Selecting..." text, and disabled state when active
 */
const FilePickerButton: React.FC<FilePickerButtonProps> = ({
  children,
  isSelecting,
  onClick,
  disabled = false,
  className = "",
  "data-testid": testId,
  icon,
  selectingText = "Selecting...",
}) => {
  const handleClick = async () => {
    if (isSelecting || disabled) return;
    await onClick();
  };

  const isDisabled = isSelecting || disabled;
  
  return (
    <button
      type="button"
      className={`disabled:opacity-50 flex items-center justify-center gap-2 ${className}`}
      onClick={handleClick}
      disabled={isDisabled}
      data-testid={testId}
    >
      {isSelecting ? (
        <>
          <Spinner size={18} className="mr-2" /> {selectingText}
        </>
      ) : (
        <>
          {icon && icon}
          {children}
        </>
      )}
    </button>
  );
};

export default FilePickerButton;