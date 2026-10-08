import type { Analysis, EditorSegment, VisualPosition, VisualType } from "@/lib/ai/schemas/analysis";
import { splitCaption } from "@/lib/speech/align";

const pictureTypes = new Set<VisualType>(["IMAGE", "BROLL", "GRAPHIC", "CHART"]);

export function segmentsFromAnalysis(analysis: Analysis, imageFor: (index: number) => string | undefined): EditorSegment[] {
  return analysis.segments.flatMap((segment, index) => {
    const chunks = splitCaption(segment.text, segment.startTime, segment.endTime);
    const pieces = chunks.length > 0 ? chunks : [{ start: segment.startTime, end: segment.endTime, text: segment.text }];
    const imageUrl = imageFor(index);
    const visualType = pictureTypes.has(segment.visualRecommendation.type) && !imageUrl ? "TEXT" : segment.visualRecommendation.type;
    return pieces.map((piece, pieceIndex) => ({
      id: `s${index}-c${pieceIndex}`,
      startTime: piece.start,
      endTime: piece.end,
      text: piece.text,
      topic: segment.topic,
      keywords: segment.keywords,
      importance: segment.importance,
      reason: segment.reason,
      imageUrl: pieceIndex === 0 ? imageUrl : undefined,
      visualRecommendation:
        pieceIndex === 0
          ? { ...segment.visualRecommendation, type: visualType as VisualType, position: segment.visualRecommendation.position as VisualPosition }
          : { type: "NONE" as const, description: "", duration: 0, position: "right" as const },
      overlayText: pieceIndex === 0 ? segment.overlayText : "",
      scale: 1,
      opacity: 1,
    }));
  });
}
