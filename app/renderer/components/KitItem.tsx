import { toCapitalCase } from "@romper/shared/kitUtilsShared";
import React from "react";
import { FiCircle, FiCopy } from "react-icons/fi";

import { useKitItem } from "./hooks/kit-management/useKitItem";
import { KitIconRenderer } from "./shared/KitIconRenderer";
import {
  BaseKitItemProps,
  extractVoiceNames,
  KitItemRenderProps,
} from "./shared/kitItemUtils";

interface KitItemProps extends BaseKitItemProps {}

// Add ref forwarding to support programmatic focus from KitList
const KitItem = React.memo(
  React.forwardRef<HTMLDivElement, KitItemProps & KitItemRenderProps>(
    (
      {
        isSelected,
        isValid,
        kit,
        kitData,
        onDuplicate,
        onSelect,
        sampleCounts,
        ...rest
      },
      ref,
    ) => {
      // Extract voice names using shared utility
      const voiceNames = extractVoiceNames(kitData);

      const { iconLabel, iconType } = useKitItem(voiceNames);

      // Use shared icon renderer
      const icon = <KitIconRenderer iconType={iconType} size="lg" />;
      // Add persistent selection highlight (independent of focus)
      const selectedHighlight = isSelected
        ? "ring-2 ring-blue-400 dark:ring-blue-300 border-blue-400 dark:border-blue-300 bg-blue-50 dark:bg-blue-900"
        : "";
      // Calculate sample count for aria-label
      const totalSamples =
        (sampleCounts?.[0] || 0) +
        (sampleCounts?.[1] || 0) +
        (sampleCounts?.[2] || 0) +
        (sampleCounts?.[3] || 0);
      const statusText = !isValid ? "Invalid kit" : `${totalSamples} samples`;
      const ariaLabel = `Kit ${kit} - ${statusText}`;

      // Add data-testid to root element for unambiguous test selection
      return (
        <div
          aria-label={ariaLabel}
          aria-selected={isSelected ? "true" : "false"}
          className={`flex flex-col p-2 rounded border text-sm ${
            isValid
              ? "border-gray-300 dark:border-slate-700 hover:bg-gray-200 dark:hover:bg-slate-800"
              : "border-red-500 bg-red-100 dark:bg-red-900"
          } cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:focus-visible:ring-blue-300 ${selectedHighlight}`}
          data-kit={kit}
          data-testid={`kit-item-${kit}`}
          onClick={onSelect}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onSelect();
            }
          }}
          ref={ref}
          role="option"
          style={{ margin: 0 }}
          tabIndex={isSelected ? 0 : -1}
          {...rest}
        >
          {/* 2-column layout: icon | right content */}
          <div className="flex flex-row w-full h-full items-stretch">
            {/* Icon column */}
            <div className="flex items-center justify-center w-auto min-w-0 p-0 m-0 pr-2">
              <span
                className="block text-5xl"
                style={{ lineHeight: 1 }}
                title={iconLabel}
              >
                {icon}
              </span>
            </div>
            {/* Right column: 2 rows */}
            <div className="flex flex-col flex-1 min-w-0">
              {/* Top row: kit name, sample counts, copy button */}
              <div className="flex items-center w-full gap-2">
                <span
                  className={`font-mono truncate ${
                    isValid
                      ? "text-gray-900 dark:text-gray-100"
                      : "text-red-500"
                  }`}
                  style={{ flex: 1 }}
                >
                  {kit}
                </span>
                {isValid && kitData?.modified_since_sync && (
                  <div className="flex items-center gap-1 ml-2">
                    <FiCircle className="w-3 h-3 text-yellow-500 fill-current" />
                    <span className="text-xs font-medium text-yellow-600 dark:text-yellow-400">
                      Modified
                    </span>
                  </div>
                )}
                {isValid && sampleCounts && (
                  <span className="flex items-center gap-1 ml-2">
                    {sampleCounts.map((count, idx) => {
                      let color = "";
                      let fontWeight = "";
                      if (count === 0) {
                        color =
                          "bg-rose-200 dark:bg-rose-900 text-rose-800 dark:text-rose-200 border border-rose-300 dark:border-rose-800";
                      } else if (count === 12) {
                        color =
                          "bg-lime-300 dark:bg-lime-700 text-lime-900 dark:text-lime-100 border border-lime-400 dark:border-lime-600";
                        fontWeight = "font-bold";
                      } else {
                        color =
                          "bg-teal-300 dark:bg-teal-800 text-teal-900 dark:text-teal-100 border border-teal-400 dark:border-teal-700";
                      }
                      return (
                        <span
                          className={`px-1 rounded text-xs font-mono ${color} ${fontWeight}`}
                          key={`voice-${idx + 1}`}
                          title={`Voice ${idx + 1} samples`}
                        >
                          {count}
                        </span>
                      );
                    })}
                  </span>
                )}
                {isValid && (
                  <button
                    className="ml-2 p-1 text-xs text-gray-500 hover:text-green-600"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDuplicate();
                    }}
                    title="Duplicate kit"
                  >
                    <FiCopy />
                  </button>
                )}
              </div>
              {/* Bottom row: voice tags */}
              {isValid && voiceNames && (
                <div className="flex flex-wrap gap-1 mt-1 w-full min-h-[1.5rem] justify-end">
                  {Array.from(
                    new Set(Object.values(voiceNames).filter(Boolean)),
                  ).map((label, i) => (
                    <span
                      className="bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-100 px-1 py-0.5 rounded-sm text-[10px] font-mono"
                      key={`voice-label-${label}-${i}`}
                    >
                      {typeof label === "string" ? toCapitalCase(label) : label}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    },
  ),
);
KitItem.displayName = "KitItem";
export default KitItem;
