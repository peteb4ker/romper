import {
  ArrowsCounterClockwise,
  Folder,
  Microphone,
  PianoKeys,
  Sparkle,
  Waveform,
} from "@phosphor-icons/react";
import React from "react";

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
    md: 24,
    sm: 20,
  };

  const iconSize = sizeMap[size];

  switch (iconType) {
    case "drumkit":
      return (
        <Waveform
          className={`text-accent-warning ${className}`}
          size={iconSize}
          weight="bold"
        />
      );
    case "fx":
      return (
        <Sparkle
          className={`text-voice-3 ${className}`}
          size={iconSize}
          weight="fill"
        />
      );
    case "loop":
      return (
        <ArrowsCounterClockwise
          className={`text-voice-4 ${className}`}
          size={iconSize}
        />
      );
    case "mic":
      return (
        <Microphone
          className={`text-voice-1 ${className}`}
          size={iconSize}
          weight="fill"
        />
      );
    case "piano":
      return (
        <PianoKeys
          className={`text-accent-primary ${className}`}
          size={iconSize}
          weight="fill"
        />
      );
    default:
      return <Folder className={className} size={iconSize} />;
  }
};
