import type { TimedSegment } from "@/lib/speech/types";

const maxWords = 5;

export function splitCaption(text: string, start: number, end: number): TimedSegment[] {
  const cleaned = text.replace(/\s+/g, " ").trim();
  const span = Math.max(0.4, end - start);
  if (!cleaned) return [];
  const sentences = cleaned.split(/(?<=[.!?…])\s+/u).flatMap((sentence) => chunkWords(sentence, maxWords));
  const parts = sentences.length > 0 ? sentences : [cleaned];
  const weights = parts.map((part) => Math.max(1, part.length));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let cursor = start;
  return parts.map((part, index) => {
    const share = span * (weights[index] / total);
    const partStart = cursor;
    const partEnd = index === parts.length - 1 ? start + span : cursor + share;
    cursor = partEnd;
    return {
      start: roundTime(partStart),
      end: roundTime(Math.max(partStart + 0.3, partEnd)),
      text: part.trim(),
    };
  });
}

export function alignTranscript(text: string, duration: number): TimedSegment[] {
  const safeDuration = duration > 0 ? duration : Math.max(4, text.trim().split(/\s+/).length * 0.45);
  return splitCaption(text, 0, safeDuration);
}

function chunkWords(sentence: string, limit: number): string[] {
  const words = sentence.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const chunks: string[] = [];
  for (let index = 0; index < words.length; index += limit) {
    chunks.push(words.slice(index, index + limit).join(" "));
  }
  return chunks;
}

function roundTime(value: number): number {
  return Math.round(value * 1000) / 1000;
}
