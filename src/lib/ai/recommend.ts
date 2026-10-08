import type { Analysis } from "@/lib/ai/schemas/analysis";
import type { TimedSegment } from "@/lib/speech/types";

export interface VisualRecommendationModel {
  recommend(segments: TimedSegment[]): Promise<Analysis>;
}
