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

export type SpeechTranscript = {
  language: "mn";
  text: string;
  words: TranscriptWord[];
  segments: TimedSegment[];
};

export interface SpeechProvider {
  transcribe(audio: Uint8Array): Promise<SpeechTranscript>;
}

export interface SpeechToTextProvider {
  transcribe(audio: Uint8Array, durationHint: number): Promise<SpeechTranscript>;
}
