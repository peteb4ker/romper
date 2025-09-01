import React, { useEffect, useRef } from "react";
import { FiLoader, FiSearch, FiX } from "react-icons/fi";

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
        <FiSearch
          aria-hidden="true"
          className="absolute left-3 w-4 h-4 text-gray-400 pointer-events-none z-10"
        />

        {/* Input Field */}
        <input
          aria-label="Search kits"
          className={`
            pl-10 pr-10 py-2 text-sm border border-gray-300 dark:border-gray-600 
            rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
            placeholder-gray-500 dark:placeholder-gray-400
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
            transition-all duration-200
            ${value ? "w-64" : "w-48 focus:w-64"}
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
            <FiLoader
              aria-label="Searching..."
              className="w-4 h-4 text-gray-400 animate-spin"
            />
          ) : value ? (
            <button
              aria-label="Clear search"
              className="w-4 h-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              onClick={onClear}
              title="Clear search (Esc)"
              type="button"
            >
              <FiX className="w-4 h-4" />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default SearchInput;
