import { z } from "zod";
import { mn } from "@/lib/i18n/mn";

export const visualTypes = [
  "NONE",
  "IMAGE",
  "BROLL",
  "GRAPHIC",
  "TEXT",
  "CHART",
  "HIGHLIGHT",
  "ZOOM",
] as const;

export const visualPositions = ["left", "right", "bottom", "background"] as const;

export const visualRecommendationSchema = z.object({
  type: z.enum(visualTypes),
  description: z.string(),
  duration: z.number().nonnegative(),
  position: z.enum(visualPositions),
});

const segmentFields = {
  startTime: z.number().nonnegative(),
  endTime: z.number().positive(),
  text: z.string().min(1),
  topic: z.string().min(1),
  keywords: z.array(z.string()),
  importance: z.number().min(0).max(1),
  visualRecommendation: visualRecommendationSchema,
  overlayText: z.string(),
  reason: z.string().optional(),
};

function timing<T extends { startTime: number; endTime: number }>(schema: z.ZodType<T>) {
  return schema.refine((segment) => segment.endTime > segment.startTime, {
    message: "Segment end must be after the start",
  });
}

export const analysisSegmentSchema = timing(z.object(segmentFields));

export const analysisSchema = z.object({
  segments: z.array(analysisSegmentSchema),
});

export const editorSegmentSchema = timing(
  z.object({
    ...segmentFields,
    id: z.string().min(1),
    scale: z.number().positive(),
    opacity: z.number().min(0).max(1),
    imageUrl: z.string().optional(),
  }),
);

export const projectSchema = z.object({
  id: z.string(),
  title: z.string(),
  filename: z.string(),
  duration: z.number().positive(),
  createdAt: z.string(),
  status: z.enum(["READY", "DRAFT", "PROCESSING"]),
  segments: z.array(editorSegmentSchema),
});

export type VisualType = z.infer<typeof visualRecommendationSchema>["type"];
export type VisualPosition = z.infer<typeof visualRecommendationSchema>["position"];
export type Analysis = z.infer<typeof analysisSchema>;
export type EditorSegment = z.infer<typeof editorSegmentSchema>;
export type Project = z.infer<typeof projectSchema>;

export function parseAnalysis(input: unknown):
  | { ok: true; data: Analysis }
  | { ok: false; error: string } {
  const result = analysisSchema.safeParse(input);
  if (!result.success) {
    return {
      ok: false,
      error: mn.errors.analysisRead,
    };
  }
  return { ok: true, data: result.data };
}

export const VISUAL_LABEL: Record<VisualType, string> = mn.visuals;
