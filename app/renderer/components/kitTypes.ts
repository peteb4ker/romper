// kitTypes.ts
// Central location for all UI TypeScript interfaces/types for kits

export interface KitSamplePlanSlot {
  source: string;
  target: string;
  voice: number; // 1-4
  voiceType?: string;
  meta?: Record<string, any>;
}

export interface RampleKitLabel {
  label: string;
  description?: string;
  tags?: string[];
  voiceNames?: { [voice: number]: string | null };
  stepPattern?: number[][] | null; // [voice][step] 4x16 velocity array (0-127)
}

export interface RampleLabels {
  kits: Record<string, RampleKitLabel>;
}

export interface VoiceSamples {
  [voice: number]: string[];
}

export interface KitDetailsProps {
  kitName: string;
  localStorePath: string;
  onBack: (scrollToKit?: string) => void;
  kits?: string[];
  kitIndex?: number;
  onNextKit?: () => void;
  onPrevKit?: () => void;
  samples?: VoiceSamples | null;
  onRequestSamplesReload?: () => void;
}
