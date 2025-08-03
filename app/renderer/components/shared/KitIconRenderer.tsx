import React from "react";
import { BiSolidPiano } from "react-icons/bi";
import { FiFolder } from "react-icons/fi";
import { GiDrumKit } from "react-icons/gi";
import { MdAutoAwesome, MdMic } from "react-icons/md";
import { TiArrowLoop } from "react-icons/ti";

export type KitIconType = KnownKitIconType;
export type KnownKitIconType =
  | "drumkit"
  | "folder"
  | "fx"
  | "loop"
  | "mic"
  | "piano";

interface KitIconRendererProps {
  className?: string;
  iconType: KitIconType;
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
          className={`${baseClassName} text-yellow-700 dark:text-yellow-300`}
        />
      );
    case "fx":
      return (
        <MdAutoAwesome
          {...iconProps}
          className={`${baseClassName} text-indigo-600 dark:text-indigo-300`}
        />
      );
    case "loop":
      return (
        <TiArrowLoop
          {...iconProps}
          className={`${baseClassName} text-amber-600 dark:text-amber-300`}
        />
      );
    case "mic":
      return (
        <MdMic
          {...iconProps}
          className={`${baseClassName} text-pink-600 dark:text-pink-300`}
        />
      );
    case "piano":
      return (
        <BiSolidPiano
          {...iconProps}
          className={`${baseClassName} text-blue-700 dark:text-blue-300`}
        />
      );
    default:
      return <FiFolder {...iconProps} className={baseClassName} />;
  }
};
