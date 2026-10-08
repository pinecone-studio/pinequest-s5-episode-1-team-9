export type TranscriptWord = {
  text: string;
  start: number;
  end: number;
};

export type TimedSegment = {
  start: number;
  end: number;
  text: string;
};

export type TimingSource = "estimated" | "provider";

export type SpeechTranscript = {
  language: "mn";
  text: string;
  words: TranscriptWord[];
  segments: TimedSegment[];
  /** Segment boundaries are estimated unless the provider returned its own timestamps. */
  timing: TimingSource;
};

export interface SpeechProvider {
  transcribe(audio: Uint8Array): Promise<SpeechTranscript>;
}

export interface SpeechToTextProvider {
  transcribe(audio: Uint8Array, durationHint: number): Promise<SpeechTranscript>;
}
