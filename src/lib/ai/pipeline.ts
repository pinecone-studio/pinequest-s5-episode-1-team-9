export const PIPELINE = [
  "extract-audio",
  "transcribe",
  "segment",
  "analyze",
  "recommend-visuals",
  "place-timeline",
  "render",
] as const;

export type PipelineStep = (typeof PIPELINE)[number];
