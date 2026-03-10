import { nativeImage } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Creates a macOS-compatible template NativeImage from a PNG file.
 * Files use the "Template" naming convention so macOS renders them
 * in the appropriate color for the menu context (light/dark mode).
 *
 * Electron automatically picks up @2x variants for Retina displays
 * when using nativeImage.createFromPath with the base filename.
 */
function createMenuIcon(iconName: string): Electron.NativeImage {
  const iconPath = path.join(__dirname, "resources", `${iconName}Template.png`);
  const image = nativeImage.createFromPath(iconPath);
  image.setTemplateImage(true);
  return image;
}

/** Pre-built menu icons for use in application menu items */
export const menuIcons = {
  changeLocalStore: createMenuIcon("folderOpen"),
  preferences: createMenuIcon("gearSix"),
  rampleManual: createMenuIcon("book"),
  romperManual: createMenuIcon("bookOpenText"),
  scanAllKits: createMenuIcon("magnifyingGlass"),
  scanBanks: createMenuIcon("barcode"),
};
