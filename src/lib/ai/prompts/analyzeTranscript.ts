import type { TimedSegment } from "@/lib/speech/types";

export function buildAnalyzePrompt(segments: TimedSegment[]): string {
  const transcript = JSON.stringify(
    segments.map((segment) => ({
      startTime: segment.start,
      endTime: segment.end,
      text: segment.text,
    })),
  );

  return `You are an AI video editor specialized in Mongolian spoken content.

The transcript below is spoken Mongolian, not formal writing. Expect filler words, incomplete sentences, names, place names, and mixed Mongolian/English.

The human speaker stays the main subject. Visuals support the idea. They must not cover the speaker's face or change on every sentence.

Rules:
- Not every segment needs a visual. Use NONE when the speaker should stay clear.
- Prefer a visual only for a distinct important idea.
- Keep overlay text short, usually 2–5 words.
- Write keywords and visual descriptions in English so a stock library can search them.
- Overlay text may be Mongolian.
- B-roll must match the spoken meaning.
- Avoid repeating the same kind of visual.
- Every visual needs a reason that quotes the idea being spoken.
- Keep startTime and endTime inside the given transcript times. Do not invent time outside the audio.

Return JSON only:
{
  "segments": [
    {
      "startTime": 0,
      "endTime": 4,
      "text": "spoken line",
      "topic": "short english topic",
      "keywords": ["english", "search", "terms"],
      "importance": 0.8,
      "reason": "Why this visual belongs with this sentence.",
      "visualRecommendation": {
        "type": "NONE | IMAGE | BROLL | GRAPHIC | TEXT | CHART | HIGHLIGHT | ZOOM",
        "description": "English description of the picture, or empty when type is NONE",
        "duration": 4,
        "position": "left | right | bottom | background"
      },
      "overlayText": "SHORT LINE"
    }
  ]
}

Transcript:
${transcript}`;
}
