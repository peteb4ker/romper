import type { KitWithRelations } from "@romper/shared/db/schema";

import React from "react";

interface KitBankNavProps {
  bankNames?: Record<string, string>;
  kits: KitWithRelations[];
  onBankClick: (bank: string) => void;
  selectedBank?: string;
}

const banks = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));

const KitBankNav: React.FC<KitBankNavProps> = ({
  bankNames = {},
  kits,
  onBankClick,
  selectedBank,
}) => (
  <div className="flex flex-row flex-wrap gap-1 justify-center">
    {banks.map((bank) => {
      const enabled = kits.some(
        (k) =>
          k && k.name && typeof k.name === "string" && k.name.startsWith(bank)
      );
      const isSelected = enabled && selectedBank === bank;

      let buttonClasses: string;
      if (isSelected) {
        buttonClasses = "bg-blue-800 text-white shadow border border-blue-900";
      } else if (enabled) {
        buttonClasses =
          "bg-blue-100 dark:bg-slate-700 text-blue-800 dark:text-blue-200 hover:bg-blue-200 dark:hover:bg-slate-600";
      } else {
        buttonClasses =
          "bg-gray-100 dark:bg-slate-800 text-gray-400 dark:text-gray-500 cursor-not-allowed";
      }

      return (
        <button
          aria-current={isSelected ? "true" : undefined}
          aria-label={`Jump to bank ${bank}`}
          className={`px-2 py-1 rounded text-xs font-mono font-bold transition ${buttonClasses}`}
          disabled={!enabled}
          key={bank}
          onClick={() => onBankClick(bank)}
          title={bankNames[bank] ? bankNames[bank] : undefined}
        >
          {bank}
        </button>
      );
    })}
  </div>
);

export default KitBankNav;
