import { useCallback, useState } from "react";

import { createLogger } from "../../../utils/logger";
import {
  type DropRejection,
  type DropRejectionReason,
  formatDropRejections,
} from "../../utils/dropRejections";
import { isVoiceAtSampleLimit } from "../../utils/kitOperations";
import { type DroppedFileCheck } from "./useFileValidation";

const log = createLogger("ExternalDrag");

/** A file a drop added, with its channel count when known */
export interface AddedDropFile {
  channels?: number;
  fileName: string;
}

/**
 * What a drop asks and says about stereo (#537, #574). The kit's voice
 * panels answer: they know which voices are linked.
 */
export interface StereoDropHandlers {
  /**
   * Called once the drop's files are added: asks Link or Keep mono for a
   * stereo sample on a mono voice that would be linked automatically, or
   * warns about a mono sample on a stereo pair
   */
  report: (voice: number, added: AddedDropFile[]) => Promise<void>;
}

export interface UseExternalDragHandlersOptions {
  // Processing hooks
  fileValidation: {
    getFilePathFromDrop: (file: File) => Promise<string>;
    validateDroppedFile: (filePath: string) => Promise<DroppedFileCheck>;
  };
  isEditable: boolean;
  onBatchDropComplete?: () => void;
  /** Tells the user which dropped files weren't added, and why */
  onMessage?: (text: string, type?: string, duration?: number) => void;
  sampleProcessing: {
    getCurrentKitSamples: () => Promise<null | unknown[]>;
    isDuplicateSample: (
      allSamples: unknown[],
      filePath: string,
    ) => Promise<boolean>;
    /** Adds a file to a slot; resolves true when it was added */
    processAssignment: (
      filePath: string,
      slotNumber: number,
    ) => Promise<boolean>;
  };
  samples: string[];
  /** Stereo questions and messages for the drop (#537) */
  stereoDrop?: StereoDropHandlers;
  /** The voice files are dropped on, for messages */
  voice: number;
}

/**
 * Hook for handling external file drag and drop operations
 * Extracted from useDragAndDrop to reduce complexity
 */
export function useExternalDragHandlers({
  fileValidation,
  isEditable,
  onBatchDropComplete,
  onMessage,
  sampleProcessing,
  samples,
  stereoDrop,
  voice,
}: UseExternalDragHandlersOptions) {
  const [dragOverSlot, setDragOverSlot] = useState<null | number>(null);
  const [dropZone, setDropZone] = useState<{
    mode: "append" | "blocked" | "insert";
    slot: number;
  } | null>(null);

  // External file drag handlers
  const handleDragOver = useCallback(
    (e: React.DragEvent, slotNumber: number) => {
      if (!isEditable) return;

      const items = Array.from(e.dataTransfer.items);
      const fileItems = items.filter((item) => item.kind === "file");
      const hasFiles = fileItems.length > 0;

      if (hasFiles) {
        e.preventDefault();
        e.stopPropagation();

        // Check if target voice can accept external drops (12-sample limit)
        if (isVoiceAtSampleLimit(samples)) {
          // Show "voice full" feedback
          setDragOverSlot(slotNumber);
          setDropZone({ mode: "blocked", slot: slotNumber });
          return;
        }

        // Dropped files always go after the last sample (RE-74), wherever
        // the pointer is, so highlight that slot rather than promise an
        // insert. Reordering is a drag within the kit.
        const appendSlot = samples.filter(Boolean).length;

        setDragOverSlot(appendSlot);
        setDropZone({ mode: "append", slot: appendSlot });
      }
    },
    [isEditable, samples],
  );

  const handleDragLeave = useCallback(() => {
    setDragOverSlot(null);
    setDropZone(null);
  }, []);

  // One message for every file the drop didn't add (RE-40)
  const reportRejections = useCallback(
    (rejections: DropRejection[]) => {
      const message = formatDropRejections(rejections, voice);
      if (message) onMessage?.(message.text, message.type);
    },
    [onMessage, voice],
  );

  const handleDrop = useCallback(
    async (
      e: React.DragEvent,
      slotNumber: number,
    ) => /* NOSONAR - S3776 accepted: each dropped file's checks share the batch's slots and rejections */ {
      e.preventDefault();
      e.stopPropagation();

      if (!isEditable) return;

      setDragOverSlot(null);
      setDropZone(null);

      const files = Array.from(e.dataTransfer.files);
      if (files.length === 0) return;

      const rejections: DropRejection[] = [];
      const reject = (from: number, reason: DropRejectionReason) => {
        for (const file of files.slice(from)) {
          rejections.push({ fileName: file.name, reason });
        }
      };

      // Check if drop is blocked due to 12-sample limit
      if (isVoiceAtSampleLimit(samples)) {
        log.debug("Drop blocked: voice already has 12 samples");
        reject(0, "full");
        reportRejections(rejections);
        return;
      }

      // The file being handled, so a failure can name it and the rest
      let current = 0;
      const added: AddedDropFile[] = [];
      try {
        const allSamples = await sampleProcessing.getCurrentKitSamples();
        if (!allSamples) {
          reject(0, "checkFailed");
          return;
        }

        // Track occupied slots during this batch to avoid stale state
        const occupiedSlots = new Set<number>();
        samples.forEach((s, i) => {
          if (s) occupiedSlots.add(i);
        });

        const { processAssignment } = sampleProcessing;
        for (; current < files.length; current++) {
          const file = files[current];
          const filePath = await fileValidation.getFilePathFromDrop(file);
          log.debug("Processing dropped file:", filePath);

          const isDuplicate = await sampleProcessing.isDuplicateSample(
            allSamples,
            filePath,
          );
          if (isDuplicate) {
            rejections.push({ fileName: file.name, reason: "duplicate" });
            continue;
          }

          const check = await fileValidation.validateDroppedFile(filePath);
          if ("rejection" in check) {
            rejections.push({ fileName: file.name, reason: check.rejection });
            continue;
          }

          // Find next available slot, starting from the drop target
          let targetSlot = -1;
          for (let i = 0; i < 12; i++) {
            const candidate = (slotNumber + i) % 12;
            if (!occupiedSlots.has(candidate)) {
              targetSlot = candidate;
              break;
            }
          }

          if (targetSlot < 0) {
            log.debug("No available slots remaining in this voice");
            reject(current, "full");
            break;
          }

          // Adds run one at a time: the next file's slot depends on whether
          // this one was added. NOSONAR suppresses S9382 for that reason.
          const wasAdded = await processAssignment(filePath, targetSlot); // NOSONAR
          // A refused add has told the user why; count only real
          // additions, so the slot stays free for the next file (#542)
          if (!wasAdded) continue;

          occupiedSlots.add(targetSlot);
          added.push({
            channels: check.validation.metadata?.channels,
            fileName: file.name,
          });
        }
      } catch (error) {
        log.error("Error handling drop:", error);
        reject(current, "checkFailed");
      } finally {
        reportRejections(rejections);
      }

      if (added.length > 0) {
        try {
          await stereoDrop?.report(voice, added);
        } catch (error) {
          log.error("Error reporting a stereo drop:", error);
        }
      }

      if (added.length > 0) {
        onBatchDropComplete?.();
      }
    },
    [
      isEditable,
      onBatchDropComplete,
      fileValidation,
      reportRejections,
      sampleProcessing,
      samples,
      stereoDrop,
      voice,
    ],
  );

  return {
    dragOverSlot,
    dropZone,
    handleDragLeave,
    handleDragOver,
    handleDrop,
  };
}
