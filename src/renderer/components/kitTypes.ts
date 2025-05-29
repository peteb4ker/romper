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
  plan?: KitSamplePlanSlot[];
}

export interface RampleLabels {
  kits: Record<string, RampleKitLabel>;
}

export interface VoiceSamples {
  [voice: number]: string[];
}

export interface KitDetailsProps {
  kitName: string;
  sdCardPath: string;
  onBack: (scrollToKit?: string) => void;
  kits?: string[];
  kitIndex?: number;
  onNextKit?: () => void;
  onPrevKit?: () => void;
  samples?: VoiceSamples | null;
  onRequestSamplesReload?: () => void;
}
