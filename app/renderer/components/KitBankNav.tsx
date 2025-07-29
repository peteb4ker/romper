import React from "react";

import type { KitWithRelations } from "../../../shared/db/schema";

interface KitBankNavProps {
  kits: KitWithRelations[];
  onBankClick: (bank: string) => void;
  bankNames?: Record<string, string>;
  selectedBank?: string;
}

const banks = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));

const KitBankNav: React.FC<KitBankNavProps> = ({
  kits,
  onBankClick,
  bankNames = {},
  selectedBank,
}) => (
  <div className="flex flex-row flex-wrap gap-1 justify-center">
    {banks.map((bank) => {
      const enabled = kits.some((k) => k && k.name && k.name.startsWith(bank));
      const isSelected = enabled && selectedBank === bank;
      return (
        <button
          key={bank}
          className={`px-2 py-1 rounded text-xs font-mono font-bold transition
                        ${
                          isSelected
                            ? "bg-blue-800 text-white shadow border border-blue-900"
                            : enabled
                              ? "bg-blue-100 dark:bg-slate-700 text-blue-800 dark:text-blue-200 hover:bg-blue-200 dark:hover:bg-slate-600"
                              : "bg-gray-100 dark:bg-slate-800 text-gray-400 dark:text-gray-500 cursor-not-allowed"
                        }
                    `}
          disabled={!enabled}
          onClick={() => onBankClick(bank)}
          aria-label={`Jump to bank ${bank}`}
          title={bankNames[bank] ? bankNames[bank] : undefined}
          aria-current={isSelected ? "true" : undefined}
        >
          {bank}
        </button>
      );
    })}
  </div>
);

export default KitBankNav;
