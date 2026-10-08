import { alignTranscript } from "@/lib/speech/align";
import type { SpeechTranscript } from "@/lib/speech/types";

export type ChimegeTranscript = {
  done: boolean;
  text: string;
  duration: number | null;
};

export function parseChimegeBody(body: string, contentType: string): ChimegeTranscript | { pending: true } | null {
  const trimmed = body.trim();
  if (!trimmed) return null;
  const looksJson = contentType.includes("json") || trimmed.startsWith("{") || trimmed.startsWith("[");
  if (!looksJson) {
    return { done: true, text: trimmed, duration: null };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return { done: true, text: trimmed, duration: null };
  }
  const record = Array.isArray(parsed) ? parsed[0] : parsed;
  if (!record || typeof record !== "object") return null;
  const row = record as { done?: boolean; transcription?: string; text?: string; duration?: number };
  if (row.done === false) return { pending: true };
  const text = row.transcription ?? row.text;
  if (!text) return null;
  return {
    done: true,
    text,
    duration: typeof row.duration === "number" ? row.duration : null,
  };
}

export function transcriptFromText(text: string, duration: number): SpeechTranscript {
  const segments = alignTranscript(text, duration);
  return {
    language: "mn",
    text: text.trim(),
    words: [],
    segments,
  };
}
