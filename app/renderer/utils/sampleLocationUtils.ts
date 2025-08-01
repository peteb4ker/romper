import { IconType } from "react-icons";
import { FiCloud, FiFolder, FiHardDrive, FiMusic } from "react-icons/fi";

export type SampleLocationType =
  | "splice"
  | "local-store"
  | "ableton"
  | "logic"
  | "native-instruments"
  | "downloads"
  | "documents"
  | "desktop"
  | "external-drive"
  | "custom";

export interface SampleLocationInfo {
  type: SampleLocationType;
  label: string;
  icon: IconType;
  description: string;
}

/**
 * Analyzes a file path and returns contextual location information
 */
export function analyzeSampleLocation(path: string): SampleLocationInfo {
  const normalizedPath = path.toLowerCase().replace(/\\/g, "/");

  // Splice library detection
  if (
    normalizedPath.includes("/splice/") ||
    normalizedPath.includes("splice sounds")
  ) {
    return {
      type: "splice",
      label: "Splice Pack",
      icon: FiCloud,
      description: "Cloud-synced Splice sample library",
    };
  }

  // Local store detection (our immutable baseline)
  // Check for both old .romper and new .romperdb paths
  if (
    normalizedPath.includes("/.romper/") ||
    normalizedPath.includes("/.romperdb/") ||
    normalizedPath.includes("/romper local store/") ||
    normalizedPath.includes("romper_local_store")
  ) {
    return {
      type: "local-store",
      label: "Local Store",
      icon: FiHardDrive,
      description: "Romper's immutable baseline samples",
    };
  }

  // Ableton Library
  if (
    normalizedPath.includes("/ableton/") ||
    normalizedPath.includes("/live ") ||
    normalizedPath.includes("ableton live")
  ) {
    return {
      type: "ableton",
      label: "Ableton Library",
      icon: FiMusic,
      description: "Ableton Live sample collection",
    };
  }

  // Logic Pro
  if (
    normalizedPath.includes("/logic/") ||
    normalizedPath.includes("/apple loops/") ||
    normalizedPath.includes("logic pro")
  ) {
    return {
      type: "logic",
      label: "Logic Library",
      icon: FiMusic,
      description: "Logic Pro sample collection",
    };
  }

  // Native Instruments
  if (
    normalizedPath.includes("/native instruments/") ||
    normalizedPath.includes("/ni ") ||
    normalizedPath.includes("/kontakt/")
  ) {
    return {
      type: "native-instruments",
      label: "NI Library",
      icon: FiMusic,
      description: "Native Instruments sample library",
    };
  }

  // Common user directories
  if (normalizedPath.includes("/downloads/")) {
    return {
      type: "downloads",
      label: "Downloads",
      icon: FiFolder,
      description: "Downloaded samples",
    };
  }

  if (normalizedPath.includes("/documents/")) {
    return {
      type: "documents",
      label: "Documents",
      icon: FiFolder,
      description: "Document folder samples",
    };
  }

  if (normalizedPath.includes("/desktop/")) {
    return {
      type: "desktop",
      label: "Desktop",
      icon: FiFolder,
      description: "Desktop samples",
    };
  }

  // External drives (common patterns)
  if (
    /^\/volumes\//i.exec(normalizedPath) || // macOS external
    /^[d-z]:\//i.exec(normalizedPath) || // Windows external drives
    normalizedPath.includes("/media/")
  ) {
    // Linux mounted drives
    return {
      type: "external-drive",
      label: "External Drive",
      icon: FiHardDrive,
      description: "External storage device",
    };
  }

  // Default: custom location
  return {
    type: "custom",
    label: "Custom",
    icon: FiFolder,
    description: "User-organized sample directory",
  };
}

/**
 * Gets a shortened, user-friendly version of a path
 * Shows just the relevant folder name instead of full path
 */
export function getShortLocationName(path: string): string {
  const info = analyzeSampleLocation(path);

  // For known locations, return the label
  if (info.type !== "custom") {
    return info.label;
  }

  // For custom locations, try to extract a meaningful folder name
  const parts = path.replace(/\\/g, "/").split("/");

  // Look for meaningful folder names (skip system folders)
  const meaningfulParts = parts.filter(
    (part) =>
      part &&
      !part.startsWith(".") &&
      part !== "Users" &&
      part !== "home" &&
      part !== "var" &&
      part !== "usr" &&
      part.length > 2,
  );

  // Return the last two meaningful parts
  if (meaningfulParts.length >= 2) {
    return meaningfulParts.slice(-2).join("/");
  } else if (meaningfulParts.length === 1) {
    return meaningfulParts[0];
  }

  // Fallback to filename
  return parts[parts.length - 1] || "Unknown";
}

/**
 * Formats a full path for display with progressive disclosure
 * Returns an object with short and full versions
 */
export function formatSamplePath(path: string): {
  short: string;
  full: string;
  location: SampleLocationInfo;
} {
  const location = analyzeSampleLocation(path);
  const short = getShortLocationName(path);

  return {
    short,
    full: path,
    location,
  };
}
