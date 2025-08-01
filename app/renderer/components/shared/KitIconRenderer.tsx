import React from "react";
import { BiSolidPiano } from "react-icons/bi";
import { FiFolder } from "react-icons/fi";
import { GiDrumKit } from "react-icons/gi";
import { MdAutoAwesome, MdMic } from "react-icons/md";
import { TiArrowLoop } from "react-icons/ti";

export type KitIconType =
  | "mic"
  | "loop"
  | "fx"
  | "piano"
  | "drumkit"
  | "folder"
  | string;

interface KitIconRendererProps {
  iconType: KitIconType;
  size?: "sm" | "md" | "lg";
  className?: string;
}

/**
 * Shared component for rendering kit type icons
 * Reduces duplication between KitItem and KitGridItem components
 */
export const KitIconRenderer: React.FC<KitIconRendererProps> = ({
  iconType,
  size = "md",
  className = "",
}) => {
  // Size classes mapping
  const sizeClasses = {
    sm: "text-xl",
    md: "text-2xl",
    lg: "text-3xl",
  };

  const sizeClass = sizeClasses[size];
  const baseClassName = `${sizeClass} ${className}`;

  const iconProps = {
    className: baseClassName,
  };

  switch (iconType) {
    case "mic":
      return (
        <MdMic
          {...iconProps}
          className={`${baseClassName} text-pink-600 dark:text-pink-300`}
        />
      );
    case "loop":
      return (
        <TiArrowLoop
          {...iconProps}
          className={`${baseClassName} text-amber-600 dark:text-amber-300`}
        />
      );
    case "fx":
      return (
        <MdAutoAwesome
          {...iconProps}
          className={`${baseClassName} text-indigo-600 dark:text-indigo-300`}
        />
      );
    case "piano":
      return (
        <BiSolidPiano
          {...iconProps}
          className={`${baseClassName} text-blue-700 dark:text-blue-300`}
        />
      );
    case "drumkit":
      return (
        <GiDrumKit
          {...iconProps}
          className={`${baseClassName} text-yellow-700 dark:text-yellow-300`}
        />
      );
    default:
      return <FiFolder {...iconProps} className={baseClassName} />;
  }
};
