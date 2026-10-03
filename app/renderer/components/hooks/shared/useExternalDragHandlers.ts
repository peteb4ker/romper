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
    processAssignment: (
      filePath: string,
      formatValidation: unknown,
      allSamples: unknown[],
      droppedSlotNumber: number,
      explicitSlot?: number,
    ) => Promise<boolean>;
  };
  samples: string[];
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
    async (e: React.DragEvent, slotNumber: number) => {
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
      let addedCount = 0;
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

          await sampleProcessing.processAssignment(
            filePath,
            check.validation,
            allSamples,
            slotNumber,
            targetSlot,
          );

          occupiedSlots.add(targetSlot);
          addedCount++;
        }
      } catch (error) {
        log.error("Error handling drop:", error);
        reject(current, "checkFailed");
      } finally {
        reportRejections(rejections);
      }

      if (addedCount > 0 && onBatchDropComplete) {
        onBatchDropComplete();
      }
    },
    [
      isEditable,
      onBatchDropComplete,
      fileValidation,
      reportRejections,
      sampleProcessing,
      samples,
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
