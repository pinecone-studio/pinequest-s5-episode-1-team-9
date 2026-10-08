import type { Analysis } from "@/lib/ai/schemas/analysis";
import type { SpeechTranscript } from "@/lib/speech/types";

export interface VisualAdvisor {
  analyze(transcript: SpeechTranscript): Promise<Analysis>;
}
