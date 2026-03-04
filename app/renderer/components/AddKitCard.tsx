import { Plus } from "@phosphor-icons/react";
import React from "react";

interface AddKitCardProps {
  bankLetter: string;
  isCreating: boolean;
  onClick: (bankLetter: string) => void;
}

const CARD_HEIGHT = 104;

const AddKitCard: React.FC<AddKitCardProps> = ({
  bankLetter,
  isCreating,
  onClick,
}) => {
  return (
    <div style={{ height: CARD_HEIGHT }}>
      <button
        aria-label={`Add kit to bank ${bankLetter}`}
        className="w-full h-full rounded-lg border-2 border-dashed border-border-subtle flex flex-col items-center justify-center gap-1.5 text-text-tertiary transition-colors duration-150 hover:border-accent-primary hover:text-accent-primary hover:bg-surface-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-border-subtle disabled:hover:text-text-tertiary disabled:hover:bg-transparent"
        data-testid={`add-kit-${bankLetter}`}
        disabled={isCreating}
        onClick={() => onClick(bankLetter)}
      >
        <Plus size={20} weight="bold" />
        <span className="text-xs font-medium">
          {isCreating ? "Creating..." : "Add Kit"}
        </span>
      </button>
    </div>
  );
};

export default AddKitCard;
