import {
  ArrowsCounterClockwiseIcon,
  FolderIcon,
  MicrophoneStageIcon,
  PianoKeysIcon,
  SparkleIcon,
} from "@phosphor-icons/react";
import React from "react";

import { DrumKit } from "../icons";

export type KnownKitIconType =
  | "drumkit"
  | "folder"
  | "fx"
  | "loop"
  | "mic"
  | "piano";

interface KitIconRendererProps {
  className?: string;
  iconType: KnownKitIconType;
  size?: "lg" | "md" | "sm";
}

/**
 * Shared component for rendering kit type icons
 * Reduces duplication between KitItem and KitGridItem components
 */
export const KitIconRenderer: React.FC<KitIconRendererProps> = ({
  className = "",
  iconType,
  size = "md",
}) => {
  // Size mapping (px)
  const sizeMap = {
    lg: 30,
    md: 25,
    sm: 20,
  };

  const iconSize = sizeMap[size];

  switch (iconType) {
    case "drumkit":
      return (
        <DrumKit
          className={`text-text-secondary ${className}`}
          size={iconSize + 2}
        />
      );
    case "fx":
      return (
        <SparkleIcon
          className={`text-text-secondary ${className}`}
          size={iconSize}
          weight="fill"
        />
      );
    case "loop":
      return (
        <ArrowsCounterClockwiseIcon
          className={`text-text-secondary ${className}`}
          size={iconSize}
        />
      );
    case "mic":
      return (
        <MicrophoneStageIcon
          className={`text-text-secondary ${className}`}
          size={iconSize}
          weight="fill"
        />
      );
    case "piano":
      return (
        <PianoKeysIcon
          className={`text-text-secondary ${className}`}
          size={iconSize}
          weight="fill"
        />
      );
    default:
      return (
        <FolderIcon
          className={`text-text-secondary ${className}`}
          size={iconSize}
        />
      );
  }
};
