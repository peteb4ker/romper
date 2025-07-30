import React, { JSX } from "react";
import { BiSolidPiano } from "react-icons/bi";
import { FiCircle, FiCopy, FiFolder } from "react-icons/fi";
import { GiDrumKit } from "react-icons/gi";
import { MdAutoAwesome, MdMic } from "react-icons/md";
import { TiArrowLoop } from "react-icons/ti";

import type { KitWithRelations } from "../../../shared/db/schema";
import { toCapitalCase } from "../../../shared/kitUtilsShared";
import { useKitItem } from "./hooks/useKitItem";

interface KitGridItemProps {
  kit: string;
  colorClass: string;
  isValid: boolean;
  onSelect: () => void;
  onDuplicate: () => void;
  sampleCounts?: [number, number, number, number];
  kitData?: KitWithRelations | null;
}

// Add ref forwarding and selection props
const KitGridItem = React.memo(
  React.forwardRef<
    HTMLDivElement,
    KitGridItemProps & { "data-kit"?: string; isSelected?: boolean }
  >(
    (
      {
        kit,
        colorClass,
        isValid,
        onSelect,
        onDuplicate,
        sampleCounts,
        kitData,
        isSelected,
        ...rest
      },
      ref,
    ) => {
      // Get voice names from kitData.voices
      const voiceNames = kitData?.voices
        ? Object.fromEntries(
            kitData.voices
              .filter((v) => v.voice_alias)
              .map((v) => [v.voice_number, v.voice_alias]),
          )
        : undefined;

      const { iconType, iconLabel } = useKitItem(
        voiceNames as Record<string | number, string> | undefined,
      );

      // Compact icon rendering (text-2xl instead of text-5xl)
      let icon: JSX.Element;
      switch (iconType) {
        case "mic":
          icon = (
            <MdMic className="text-2xl text-pink-600 dark:text-pink-300" />
          );
          break;
        case "loop":
          icon = (
            <TiArrowLoop className="text-2xl text-amber-600 dark:text-amber-300" />
          );
          break;
        case "fx":
          icon = (
            <MdAutoAwesome className="text-2xl text-indigo-600 dark:text-indigo-300" />
          );
          break;
        case "piano":
          icon = (
            <BiSolidPiano className="text-2xl text-blue-700 dark:text-blue-300" />
          );
          break;
        case "drumkit":
          icon = (
            <GiDrumKit className="text-2xl text-yellow-700 dark:text-yellow-300" />
          );
          break;
        default:
          icon = <FiFolder className="text-2xl" />;
      }

      // Kit type visual identification borders and backgrounds
      const getKitTypeStyles = () => {
        if (!isValid) {
          return {
            border: "border-l-4 border-l-red-500",
            background: "bg-red-50 dark:bg-red-950",
          };
        }

        // Check if kit has unsaved changes (modified since sync)
        if (kitData?.modified_since_sync) {
          return {
            border: "border-l-4 border-l-amber-500",
            background: "bg-amber-50 dark:bg-amber-950",
          };
        }

        // Check if kit is editable (user-created)
        if (kitData?.editable) {
          return {
            border: "border-l-4 border-l-green-500",
            background: "bg-green-50 dark:bg-green-950",
          };
        }

        // Factory kits (read-only baseline)
        return {
          border: "border-l-4 border-l-gray-400",
          background: "bg-gray-50 dark:bg-gray-900",
        };
      };

      const kitTypeStyles = getKitTypeStyles();

      // Selection highlighting
      const selectedHighlight = isSelected
        ? "ring-2 ring-blue-400 dark:ring-blue-300 border-blue-400 dark:border-blue-300 bg-blue-50 dark:bg-blue-900"
        : "";

      // Compact vertical card layout with optimized spacing
      return (
        <div
          ref={ref}
          className={`flex flex-col justify-between p-2 rounded border text-sm h-full w-full ${kitTypeStyles.border} ${kitTypeStyles.background} ${
            isValid
              ? "border-gray-300 dark:border-slate-700 hover:brightness-95 dark:hover:brightness-110"
              : "border-red-500"
          } cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:focus-visible:ring-blue-300 ${selectedHighlight}`}
          onClick={onSelect}
          data-kit={kit}
          data-testid={`kit-item-${kit}`}
          tabIndex={isSelected ? 0 : -1}
          aria-selected={isSelected ? "true" : "false"}
          {...rest}
        >
          {/* Top row: icon, kit name, status badges */}
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span title={iconLabel}>{icon}</span>
              <span
                className={`font-mono text-sm truncate ${
                  isValid ? "text-gray-900 dark:text-gray-100" : "text-red-500"
                }`}
              >
                {kit}
              </span>
            </div>

            {/* Enhanced Status indicators */}
            <div className="flex items-center gap-1">
              {isValid && kitData?.modified_since_sync && (
                <span className="px-1.5 py-0.5 text-xs font-medium bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200 rounded border border-amber-300 dark:border-amber-700">
                  Unsaved
                </span>
              )}
              {isValid &&
                kitData?.editable &&
                !kitData?.modified_since_sync && (
                  <span className="px-1.5 py-0.5 text-xs font-medium bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded border border-green-300 dark:border-green-700">
                    Editable
                  </span>
                )}
              {isValid && (
                <button
                  className="p-1 text-xs text-gray-500 hover:text-green-600 ml-1"
                  title="Duplicate kit"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDuplicate();
                  }}
                >
                  <FiCopy />
                </button>
              )}
            </div>
          </div>

          {/* Voice indicators: Unified voice names and sample counts */}
          {isValid && sampleCounts && (
            <div className="flex items-end gap-1 w-full">
              {sampleCounts.map((count, idx) => {
                const voiceNumber = idx + 1;
                const voiceName = voiceNames?.[voiceNumber];

                // Color coding for sample counts
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

                // Unified label: voice name + count, or just count
                const displayText = voiceName
                  ? `${typeof voiceName === "string" ? toCapitalCase(voiceName) : voiceName} ${count}`
                  : count.toString();

                return (
                  <div
                    key={idx}
                    className="w-1/4 flex justify-center"
                    title={`Voice ${voiceNumber}: ${count} samples${voiceName ? ` (${voiceName})` : ""}`}
                  >
                    <span
                      className={`px-1 py-1 rounded text-xs font-mono ${color} ${fontWeight} text-center truncate w-full max-w-full`}
                    >
                      {displayText}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      );
    },
  ),
);

KitGridItem.displayName = "KitGridItem";
export default KitGridItem;
