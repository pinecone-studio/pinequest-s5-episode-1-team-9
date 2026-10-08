import { alignTranscript } from "@/lib/speech/align";
import type { SpeechTranscript } from "@/lib/speech/types";

/** Maps provider text onto Ayan segments. Word timestamps are left empty; caption times are estimated from duration. */
export function transcriptFromText(text: string, duration: number): SpeechTranscript {
  return {
    language: "mn",
    text: text.trim(),
    words: [],
    segments: alignTranscript(text, duration),
    timing: "estimated",
  };
}
