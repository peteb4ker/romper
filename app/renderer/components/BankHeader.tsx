import { Pencil, VinylRecord } from "@phosphor-icons/react";
import React, { useCallback, useEffect, useRef, useState } from "react";

export interface BankHeaderProps {
  bank: string;
  bankName?: string;
  onBankNameChange?: (bank: string, newName: string) => void;
  onBankVisible?: (bank: string) => void;
  variant?: "grid" | "list";
}

const BankHeader: React.FC<BankHeaderProps> = ({
  bank,
  bankName,
  onBankNameChange,
  onBankVisible,
  variant = "grid",
}) => {
  const headerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(bankName ?? "");

  useEffect(() => {
    if (!headerRef.current || !onBankVisible) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          onBankVisible(bank);
        }
      },
      {
        rootMargin: "-10% 0px -80% 0px",
        threshold: 0.5,
      },
    );

    observer.observe(headerRef.current);
    return () => observer.disconnect();
  }, [bank, onBankVisible]);

  useEffect(() => {
    setEditValue(bankName ?? "");
  }, [bankName]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = useCallback(() => {
    setIsEditing(false);
    const trimmed = editValue.trim();
    if (trimmed !== (bankName ?? "") && onBankNameChange) {
      onBankNameChange(bank, trimmed);
    }
  }, [editValue, bankName, bank, onBankNameChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        handleSave();
      } else if (e.key === "Escape") {
        setEditValue(bankName ?? "");
        setIsEditing(false);
      }
      e.stopPropagation();
    },
    [handleSave, bankName],
  );

  const handleEditClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (onBankNameChange) {
        setIsEditing(true);
      }
    },
    [onBankNameChange],
  );

  if (variant === "list") {
    return (
      <div className="mt-2 first:mt-0" id={`bank-${bank}`} ref={headerRef}>
        <div className="flex items-center gap-2 px-2 py-1 rounded bg-surface-3 border-l-4 border-l-accent-primary">
          <VinylRecord
            className="text-accent-primary/50 shrink-0"
            size={14}
            weight="duotone"
          />
          <span className="font-mono font-bold text-base text-accent-primary leading-none">
            {bank}
          </span>
          {isEditing ? (
            <input
              className="text-xs text-text-primary bg-surface-1 border border-border-strong rounded px-1 py-0.5 min-w-[80px] max-w-[200px] outline-none focus:ring-1 focus:ring-accent-primary"
              data-testid={`bank-name-input-${bank}`}
              onBlur={handleSave}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              ref={inputRef}
              type="text"
              value={editValue}
            />
          ) : (
            <>
              {bankName && (
                <>
                  <span className="text-border-strong text-xs leading-none">
                    &#x2022;
                  </span>
                  <span
                    className="text-xs text-text-secondary tracking-wide truncate cursor-pointer hover:text-text-primary"
                    data-testid={`bank-name-display-${bank}`}
                    onClick={handleEditClick}
                  >
                    {bankName}
                  </span>
                </>
              )}
              {onBankNameChange && (
                <button
                  className="text-text-tertiary hover:text-accent-primary transition-colors shrink-0"
                  data-testid={`bank-name-edit-${bank}`}
                  onClick={handleEditClick}
                  title={bankName ? "Edit bank name" : "Add bank name"}
                  type="button"
                >
                  <Pencil size={12} weight="bold" />
                </button>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  // Grid variant
  return (
    <div
      className="col-span-full mt-5 first:mt-1"
      id={`bank-${bank}`}
      ref={headerRef}
    >
      <div className="flex items-center gap-3 px-3 py-2 border-b border-border-subtle">
        <span className="font-mono font-black text-xl text-accent-primary leading-none">
          {bank}
        </span>
        {isEditing ? (
          <input
            className="text-sm text-text-primary bg-surface-1 border border-border-strong rounded px-2 py-0.5 min-w-[100px] max-w-[250px] outline-none focus:ring-1 focus:ring-accent-primary"
            data-testid={`bank-name-input-${bank}`}
            onBlur={handleSave}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            ref={inputRef}
            type="text"
            value={editValue}
          />
        ) : (
          <>
            {bankName && (
              <span
                className="text-sm text-text-secondary tracking-wide truncate cursor-pointer hover:text-text-primary"
                data-testid={`bank-name-display-${bank}`}
                onClick={handleEditClick}
              >
                {bankName}
              </span>
            )}
            {onBankNameChange && (
              <button
                className="text-text-tertiary hover:text-accent-primary transition-colors shrink-0"
                data-testid={`bank-name-edit-${bank}`}
                onClick={handleEditClick}
                title={bankName ? "Edit bank name" : "Add bank name"}
                type="button"
              >
                <Pencil size={14} weight="bold" />
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default React.memo(BankHeader);
