import { mn } from "@/lib/i18n/mn";

export const MAX_UPLOAD_BYTES = 80 * 1024 * 1024;

export const messages = {
  transcribe: mn.errors.transcribe,
  analyze: mn.errors.analyze,
  render: mn.errors.render,
  ffmpegMissing: mn.errors.ffmpeg,
  chimegeMissing: mn.errors.chimege,
  geminiMissing: mn.errors.gemini,
  demo: mn.errors.demo,
  generic: mn.errors.processing,
} as const;

export class PipelineError extends Error {
  constructor(
    readonly code: string,
    readonly userMessage: string,
  ) {
    super(userMessage);
  }
}

export function demoModeBlock(): string | null {
  if (process.env.NEXT_PUBLIC_DEMO_MODE === "false" || process.env.DEMO_MODE === "false") return null;
  return messages.demo;
}

export function stageStep(stage: string): number {
  switch (stage) {
    case "EXTRACTING_AUDIO":
      return 1;
    case "TRANSCRIBING":
      return 2;
    case "ANALYZING":
      return 3;
    case "FINDING_VISUALS":
      return 4;
    case "BUILDING_TIMELINE":
    case "RENDERING":
      return 5;
    default:
      return 0;
  }
}
