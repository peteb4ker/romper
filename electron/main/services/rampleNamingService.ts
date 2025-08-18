import type { Sample } from "@romper/shared/db/schema.js";

import * as path from "path";

/**
 * Service for generating Squarp Rample-compliant file and directory names
 * Implements the official Rample naming convention for SD card sync operations
 */
export class RampleNamingService {
  /**
   * Generate the kit directory path on SD card
   * Format: {sdCardRoot}/{kitName}
   * kitName should already be in correct format (A0, B1, etc.)
   */
  generateKitPath(sdCardRoot: string, kitName: string): string {
    this.validateKitName(kitName);
    return path.join(sdCardRoot, kitName);
  }

  /**
   * Generate the complete destination path for a sample on SD card
   * Format: {sdCardRoot}/{kitName}/{voiceNumber}sample{slotNumber}.wav
   */
  generateSampleDestinationPath(
    sdCardRoot: string,
    kitName: string,
    voiceNumber: number,
    slotNumber: number,
  ): string {
    const kitPath = this.generateKitPath(sdCardRoot, kitName);
    const filename = this.generateSampleFilename(voiceNumber, slotNumber);
    return path.join(kitPath, filename);
  }

  /**
   * Generate a Rample-compliant sample filename
   * Format: {voiceNumber}sample{slotNumber}.wav
   * Examples: 1sample1.wav, 2sample1.wav, 1sample2.wav
   */
  generateSampleFilename(voiceNumber: number, slotNumber: number): string {
    this.validateVoiceNumber(voiceNumber);
    this.validateSlotNumber(slotNumber);

    // Use slotNumber + 1 to convert from 0-based DB storage to 1-based slot numbering required by Rample hardware
    const displaySlotNumber = slotNumber + 1;
    return `${voiceNumber}sample${displaySlotNumber}.wav`;
  }

  /**
   * Transform a sample object to its Rample-compliant destination path
   */
  transformSampleToDestinationPath(sample: Sample, sdCardRoot: string): string {
    return this.generateSampleDestinationPath(
      sdCardRoot,
      sample.kit_name,
      sample.voice_number,
      sample.slot_number,
    );
  }

  /**
   * Transform a sample object to both its Rample-compliant destination path and filename
   * Returns both values to avoid coupling between path generation and filename extraction
   */
  transformSampleToPathAndFilename(
    sample: Sample,
    sdCardRoot: string,
  ): { destinationPath: string; filename: string } {
    const filename = this.generateSampleFilename(
      sample.voice_number,
      sample.slot_number,
    );
    const destinationPath = this.generateSampleDestinationPath(
      sdCardRoot,
      sample.kit_name,
      sample.voice_number,
      sample.slot_number,
    );
    return { destinationPath, filename };
  }

  /**
   * Validate if a path follows Rample naming convention
   */
  validateRampleCompliance(filePath: string): {
    issues: string[];
    isValid: boolean;
  } {
    const issues: string[] = [];
    const filename = path.basename(filePath);
    const kitDir = path.basename(path.dirname(filePath));

    // Validate kit directory name (should be like A0, B1, Z99)
    if (!this.isValidKitName(kitDir)) {
      issues.push(
        `Kit directory "${kitDir}" does not follow format {BankLetter}{KitNumber}`,
      );
    }

    // Validate sample filename (should start with voice number 1-4)
    if (!this.isValidSampleFilename(filename)) {
      issues.push(
        `Sample filename "${filename}" does not start with voice number (1-4)`,
      );
    }

    // Validate file extension
    if (!filename.toLowerCase().endsWith(".wav")) {
      issues.push(`Sample filename "${filename}" is not a .wav file`);
    }

    return {
      issues,
      isValid: issues.length === 0,
    };
  }

  /**
   * Check if kit name follows Rample convention (A0-Z99)
   */
  private isValidKitName(kitName: string): boolean {
    const kitNameRegex = /^[A-Z]\d{1,2}$/;
    return kitNameRegex.test(kitName);
  }

  /**
   * Check if filename starts with valid voice number (1-4)
   */
  private isValidSampleFilename(filename: string): boolean {
    const voiceNumberRegex = /^[1-4]/;
    return voiceNumberRegex.test(filename);
  }

  /**
   * Validate kit name follows Rample convention
   */
  private validateKitName(kitName: string): void {
    if (!this.isValidKitName(kitName)) {
      throw new Error(
        `Invalid kit name: ${kitName}. Must follow format {BankLetter}{KitNumber} (e.g., A0, B1, Z99).`,
      );
    }
  }

  /**
   * Validate slot number is within Rample limits (0-11, 0-based in DB)
   */
  private validateSlotNumber(slotNumber: number): void {
    if (slotNumber < 0 || slotNumber > 11) {
      throw new Error(
        `Invalid slot number: ${slotNumber}. Must be 0-11 for Rample compatibility.`,
      );
    }
  }

  /**
   * Validate voice number is within Rample limits (1-4)
   */
  private validateVoiceNumber(voiceNumber: number): void {
    if (voiceNumber < 1 || voiceNumber > 4) {
      throw new Error(
        `Invalid voice number: ${voiceNumber}. Must be 1-4 for Rample compatibility.`,
      );
    }
  }
}

export const rampleNamingService = new RampleNamingService();
