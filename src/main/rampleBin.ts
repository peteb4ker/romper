import fs from "fs";
import path from "path";

/**
 * Reads the entire contents of a rample.bin file as a Buffer.
 * @param filePath Path to rample.bin
 * @returns Buffer with file contents
 */
export function readRampleBin(filePath: string): Buffer {
  return fs.readFileSync(filePath);
}

/**
 * Writes a Buffer to rample.bin, replacing its contents.
 * @param filePath Path to rample.bin
 * @param data Buffer to write
 */
export function writeRampleBin(filePath: string, data: Buffer): void {
  fs.writeFileSync(filePath, data);
}

/**
 * Reads the header (first 16 bytes) of rample.bin as a Buffer.
 */
export function readRampleHeader(filePath: string): Buffer {
  const buf = readRampleBin(filePath);
  return buf.slice(0, 16);
}

/**
 * Reads the kit assignment table (bytes 0x10 to 0x10+400) as an array of numbers.
 * Each byte represents a kit slot assignment.
 */
export function readKitAssignments(filePath: string): number[] {
  const buf = readRampleBin(filePath);
  // Typical: 4 banks x 100 slots = 400 bytes, starting at offset 0x10
  return Array.from(buf.slice(0x10, 0x10 + 400));
}

/**
 * Reads global settings (bytes 0x1A0 to 0x1A0+32) as a Buffer.
 * The actual settings structure may vary by firmware.
 */
export function readGlobalSettings(filePath: string): Buffer {
  const buf = readRampleBin(filePath);
  // Example: settings block at offset 0x1A0, 32 bytes
  return buf.slice(0x1a0, 0x1a0 + 32);
}

/**
 * Reads the entire rample.bin as an object with header, kitAssignments, and globalSettings.
 */
export function readRampleBinAll(filePath: string) {
  return {
    header: readRampleHeader(filePath),
    kitAssignments: readKitAssignments(filePath),
    globalSettings: readGlobalSettings(filePath),
    raw: readRampleBin(filePath),
  };
}

export interface ParsedRampleBin {
  header: {
    magic: string; // e.g. 'RAMP'
    version: number;
    reserved: number[];
  };
  kitAssignments: number[]; // 400 bytes, 4 banks x 100 slots
  globalSettings: number[]; // 32 bytes
  fileSize: number;
}

export function parseRampleBin(filePath: string): ParsedRampleBin {
  const buf = readRampleBin(filePath);
  // Header: first 16 bytes
  const magic = buf.slice(0, 4).toString("ascii");
  const version = buf[4];
  const reserved = Array.from(buf.slice(5, 16));
  // Kit assignments: 0x10 to 0x10+400
  const kitAssignments = Array.from(buf.slice(0x10, 0x10 + 400));
  // Global settings: 0x1A0 to 0x1A0+32
  const globalSettings = Array.from(buf.slice(0x1a0, 0x1a0 + 32));
  return {
    header: { magic, version, reserved },
    kitAssignments,
    globalSettings,
    fileSize: buf.length,
  };
}
