import React from "react";
import { BiSolidPiano } from "react-icons/bi";
import { FiFolder } from "react-icons/fi";
import { GiDrumKit } from "react-icons/gi";
import { MdAutoAwesome, MdMic } from "react-icons/md";
import { TiArrowLoop } from "react-icons/ti";

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
  // Size classes mapping
  const sizeClasses = {
    lg: "text-3xl",
    md: "text-2xl",
    sm: "text-xl",
  };

  const sizeClass = sizeClasses[size];
  const baseClassName = `${sizeClass} ${className}`;

  const iconProps = {
    className: baseClassName,
  };

  switch (iconType) {
    case "drumkit":
      return (
        <GiDrumKit
          {...iconProps}
          className={`${baseClassName} text-accent-warning`}
        />
      );
    case "fx":
      return (
        <MdAutoAwesome
          {...iconProps}
          className={`${baseClassName} text-voice-3`}
        />
      );
    case "loop":
      return (
        <TiArrowLoop
          {...iconProps}
          className={`${baseClassName} text-voice-4`}
        />
      );
    case "mic":
      return (
        <MdMic {...iconProps} className={`${baseClassName} text-voice-1`} />
      );
    case "piano":
      return (
        <BiSolidPiano
          {...iconProps}
          className={`${baseClassName} text-accent-primary`}
        />
      );
    default:
      return <FiFolder {...iconProps} className={baseClassName} />;
  }
};
