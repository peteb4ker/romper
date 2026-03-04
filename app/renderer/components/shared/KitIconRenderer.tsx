import {
  ArrowsCounterClockwise,
  Folder,
  MicrophoneStage,
  PianoKeys,
  Sparkle,
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
        <Sparkle
          className={`text-text-secondary ${className}`}
          size={iconSize}
          weight="fill"
        />
      );
    case "loop":
      return (
        <ArrowsCounterClockwise
          className={`text-text-secondary ${className}`}
          size={iconSize}
        />
      );
    case "mic":
      return (
        <MicrophoneStage
          className={`text-text-secondary ${className}`}
          size={iconSize}
          weight="fill"
        />
      );
    case "piano":
      return (
        <PianoKeys
          className={`text-text-secondary ${className}`}
          size={iconSize}
          weight="fill"
        />
      );
    default:
      return (
        <Folder
          className={`text-text-secondary ${className}`}
          size={iconSize}
        />
      );
  }
};
