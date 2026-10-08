import type { EditorSegment, Project, VisualPosition, VisualType } from "@/lib/ai/schemas/analysis";
import { projectSchema } from "@/lib/ai/schemas/analysis";

export type VideoStage =
  | "DRAFT"
  | "UPLOADING"
  | "EXTRACTING_AUDIO"
  | "TRANSCRIBING"
  | "ANALYZING"
  | "FINDING_VISUALS"
  | "BUILDING_TIMELINE"
  | "RENDERING"
  | "PROCESSING"
  | "READY"
  | "FAILED";

export type VideoRecord = {
  id: string;
  filename: string;
  title: string;
  duration: number;
  status: VideoStage;
  errorMessage: string | null;
  originalKey: string;
  originalUrl: string;
  audioKey: string | null;
  processedKey: string | null;
  processedUrl: string | null;
  createdAt: string;
  fullText: string;
  segments: EditorSegment[];
};

export type CreateVideo = {
  id: string;
  filename: string;
  title: string;
  duration: number;
  originalKey: string;
  originalUrl: string;
};

export interface VideoRepository {
  create(input: CreateVideo): Promise<VideoRecord>;
  update(id: string, patch: Partial<VideoRecord>): Promise<VideoRecord>;
  get(id: string): Promise<VideoRecord | null>;
  list(): Promise<VideoRecord[]>;
}

export function toProject(record: VideoRecord): Project | null {
  if (record.segments.length === 0 || record.duration <= 0) return null;
  const parsed = projectSchema.safeParse({
    id: record.id,
    title: record.title,
    filename: record.filename,
    duration: record.duration,
    createdAt: record.createdAt,
    status: record.status === "READY" ? "READY" : record.status === "FAILED" ? "DRAFT" : "PROCESSING",
    segments: record.segments.map((segment) => ({
      ...segment,
      topic: segment.topic || "speech",
      visualRecommendation: {
        type: segment.visualRecommendation.type as VisualType,
        description: segment.visualRecommendation.description,
        duration: segment.visualRecommendation.duration,
        position: (segment.visualRecommendation.position || "right") as VisualPosition,
      },
    })),
  });
  return parsed.success ? parsed.data : null;
}
