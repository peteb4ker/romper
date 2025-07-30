// kitTypes.ts
// Central location for all UI TypeScript interfaces/types for kits

import type { KitWithRelations } from "../../../shared/db/schema";

export interface KitSamplePlanSlot {
  source: string;
  target: string;
  voice: number; // 1-4
  voiceType?: string;
  meta?: Record<string, any>;
}

export interface SampleData {
  filename: string;
  source_path: string;
  is_stereo?: boolean;
  [key: string]: any;
}

export interface VoiceSamples {
  [voice: number]: string[];
}

export interface KitDetailsProps {
  kitName: string;
  onBack: (scrollToKit?: string) => void;
  kits?: KitWithRelations[];
  kitIndex?: number;
  onNextKit?: () => void;
  onPrevKit?: () => void;
  samples?: VoiceSamples | null;
  onRequestSamplesReload?: () => void;
}
