import { expect, test } from "@playwright/test";
import { _electron as electron } from "playwright";

import {
  cleanupE2EFixture,
  type E2ETestEnvironment,
  extractE2EFixture,
} from "../utils/e2e-fixture-extractor";

test.describe("Debug Navigation Logic", () => {
  let electronApp: any;
  let window: any;
  let testEnv: E2ETestEnvironment;

  test.beforeEach(async () => {
    testEnv = await extractE2EFixture();

    electronApp = await electron.launch({
      args: ["dist/electron/main/index.js"],
      env: {
        ...process.env,
        ...testEnv.environment,
      },
      timeout: 30000,
    });

    window = await electronApp.firstWindow();
    await window.waitForLoadState("domcontentloaded");

    // Wait for app to initialize
    await window.waitForSelector('[data-testid="kits-view"]', {
      timeout: 10000,
    });

    // Wait for kit grid to load
    await window.waitForSelector('[data-testid="kit-grid"]', {
      timeout: 10000,
    });
  });

  test.afterEach(async () => {
    if (electronApp) {
      await electronApp.close();
    }
    if (testEnv) {
      await cleanupE2EFixture(testEnv);
    }
  });

  test("should debug the sample grouping and navigation state", async () => {
    // Test the sample grouping function
    const sampleGroupingResult = await window.evaluate(async () => {
      // First get the sample data
      const samplesResult = await (
        window as any
      ).electronAPI.getAllSamplesForKit("A0");
      console.log("Raw samples result:", samplesResult);

      if (!samplesResult.success) {
        return { error: "Failed to get samples", samples: samplesResult };
      }

      // Now test the grouping function manually
      const groupDbSamplesByVoice = (dbSamples: any[]) => {
        const voices = { 1: [], 2: [], 3: [], 4: [] };

        // First, sort samples by voice_number and slot_number to ensure proper ordering
        const sortedSamples = [...dbSamples].sort((a: any, b: any) => {
          if (a.voice_number !== b.voice_number) {
            return a.voice_number - b.voice_number;
          }
          return a.slot_number - b.slot_number;
        });

        // Group samples by voice, maintaining slot order
        sortedSamples.forEach((sample: any) => {
          const voiceNumber = sample.voice_number;
          if (voiceNumber >= 1 && voiceNumber <= 4) {
            // Create array with proper slot positions (12 slots per voice)
            if (!Array.isArray(voices[voiceNumber])) {
              voices[voiceNumber] = [];
            }
            // Database stores 0-11 slot indices directly
            const slotNumber = sample.slot_number;
            if (slotNumber >= 0 && slotNumber < 12) {
              voices[voiceNumber][slotNumber] = sample.filename;

              // If this is a stereo sample, also show it in the next voice
              if (sample.is_stereo && voiceNumber < 4) {
                const nextVoice = voiceNumber + 1;
                if (!Array.isArray(voices[nextVoice])) {
                  voices[nextVoice] = [];
                }
                voices[nextVoice][slotNumber] = sample.filename;
              }
            }
          }
        });

        // Fill empty slots with empty strings for consistent array length
        Object.keys(voices).forEach((v) => {
          const voice = voices[+v];
          for (let i = 0; i < 12; i++) {
            if (!voice[i]) {
              voice[i] = "";
            }
          }
          // Remove trailing empty slots
          while (voice.length > 0 && voice[voice.length - 1] === "") {
            voice.pop();
          }
        });

        return voices;
      };

      const grouped = groupDbSamplesByVoice(samplesResult.data);
      console.log("Grouped samples:", grouped);

      return {
        groupedSamples: grouped,
        hasVoices: Object.keys(grouped).length > 0,
        isTruthy: !!grouped,
        rawSamples: samplesResult.data,
        voice1Length: grouped[1]?.length || 0,
        voice2Length: grouped[2]?.length || 0,
      };
    });

    console.log("Sample grouping result:", sampleGroupingResult);

    // Now try to manually trigger the navigation by simulating what the React hook does
    const navigationTest = await window.evaluate(async () => {
      // Simulate what happens in useKitNavigation when a kit is selected
      const kitName = "A0";

      // Get samples for the kit
      const samplesResult = await (
        window as any
      ).electronAPI.getAllSamplesForKit(kitName);
      if (!samplesResult.success) {
        return { error: "Could not get samples for kit", kitName };
      }

      // Group them
      const groupDbSamplesByVoice = (dbSamples: any[]) => {
        const voices = { 1: [], 2: [], 3: [], 4: [] };
        const sortedSamples = [...dbSamples].sort((a: any, b: any) => {
          if (a.voice_number !== b.voice_number) {
            return a.voice_number - b.voice_number;
          }
          return a.slot_number - b.slot_number;
        });

        sortedSamples.forEach((sample: any) => {
          const voiceNumber = sample.voice_number;
          if (voiceNumber >= 1 && voiceNumber <= 4) {
            if (!Array.isArray(voices[voiceNumber])) {
              voices[voiceNumber] = [];
            }
            const slotNumber = sample.slot_number;
            if (slotNumber >= 0 && slotNumber < 12) {
              voices[voiceNumber][slotNumber] = sample.filename;
              if (sample.is_stereo && voiceNumber < 4) {
                const nextVoice = voiceNumber + 1;
                if (!Array.isArray(voices[nextVoice])) {
                  voices[nextVoice] = [];
                }
                voices[nextVoice][slotNumber] = sample.filename;
              }
            }
          }
        });

        Object.keys(voices).forEach((v) => {
          const voice = voices[+v];
          for (let i = 0; i < 12; i++) {
            if (!voice[i]) {
              voice[i] = "";
            }
          }
          while (voice.length > 0 && voice[voice.length - 1] === "") {
            voice.pop();
          }
        });

        return voices;
      };

      const voiceSamples = groupDbSamplesByVoice(samplesResult.data);

      // Test the condition that KitsView.tsx uses for rendering
      const selectedKit = kitName;
      const selectedKitSamples = voiceSamples;

      const shouldShowKitDetails = !!(selectedKit && selectedKitSamples);

      return {
        condition1: !!selectedKit,
        condition2: !!selectedKitSamples,
        samplesKeys: Object.keys(selectedKitSamples || {}),
        samplesType: typeof selectedKitSamples,
        selectedKit,
        selectedKitSamples,
        shouldShowKitDetails,
        voice1HasSamples: selectedKitSamples?.[1]?.length > 0,
        voice2HasSamples: selectedKitSamples?.[2]?.length > 0,
      };
    });

    console.log("Navigation test result:", navigationTest);

    // Verify our expectations
    expect(navigationTest.shouldShowKitDetails).toBe(true);
    expect(navigationTest.selectedKit).toBe("A0");
    expect(navigationTest.selectedKitSamples).toBeTruthy();
  });
});
