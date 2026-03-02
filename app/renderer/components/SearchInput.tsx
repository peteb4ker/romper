import { CircleNotch, MagnifyingGlass, X } from "@phosphor-icons/react";
import React, { useEffect, useRef } from "react";

export interface SearchActions {
  onChange: (value: string) => void;
  onClear: () => void;
}

export interface SearchInputProps {
  actions: SearchActions;
  autoFocus?: boolean;
  className?: string;
  placeholder?: string;
  state: SearchState;
}

export interface SearchState {
  isSearching: boolean;
  value: string;
}

/**
 * Search input component with loading states and clear button
 * Designed to match existing UI patterns in KitBrowserHeader
 */
const SearchInput: React.FC<SearchInputProps> = ({
  actions,
  autoFocus = false,
  className = "",
  placeholder = "Search kits, samples, artists...",
  state,
}) => {
  const { isSearching, value } = state;
  const { onChange, onClear } = actions;
  const inputRef = useRef<HTMLInputElement>(null);

  // Handle input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClear();
      inputRef.current?.blur();
    }
  };

  // Focus input on mount if autoFocus is enabled
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  return (
    <div className={`relative ${className}`}>
      <div className="relative flex items-center">
        {/* Search Icon */}
        <MagnifyingGlass
          aria-hidden="true"
          className="absolute left-3 text-text-tertiary pointer-events-none z-10"
          size={16}
        />

        {/* Input Field */}
        <input
          aria-label="Search kits"
          className={`
            pl-10 pr-10 py-2 text-sm border border-border-default
            rounded-md bg-surface-3 text-text-primary
            placeholder-text-tertiary
            focus:outline-none focus:ring-2 focus:ring-accent-primary focus:border-accent-primary
            transition-all duration-150
            w-full
          `}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          ref={inputRef}
          type="text"
          value={value}
        />

        {/* Loading Spinner or Clear Button */}
        <div className="absolute right-3 flex items-center">
          {isSearching ? (
            <CircleNotch
              aria-label="Searching..."
              className="text-accent-primary animate-spin"
              size={16}
            />
          ) : value ? (
            <button
              aria-label="Clear search"
              className="w-4 h-4 text-text-tertiary hover:text-text-primary transition-colors duration-150"
              onClick={onClear}
              title="Clear search (Esc)"
              type="button"
            >
              <X size={16} />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default SearchInput;
