import { CHAT_MAX_CHARS } from "@linguamatch/shared";

export const CHAT_RATE_MS = 1000;
export const ASSIST_RATE_MS = 3000;
export const SUGGEST_RATE_MS = 60_000;

export type ChatRejection = "empty" | "too_long" | "rate_limited";

export function validateMessage(
  raw: unknown,
  lastSentAt: number | undefined,
  now: number,
): { ok: true; text: string } | { ok: false; reason: ChatRejection } {
  if (typeof raw !== "string") return { ok: false, reason: "empty" };
  const text = raw.replace(/\s+/g, " ").trim();
  if (!text) return { ok: false, reason: "empty" };
  if (text.length > CHAT_MAX_CHARS) return { ok: false, reason: "too_long" };
  if (lastSentAt !== undefined && now - lastSentAt < CHAT_RATE_MS) return { ok: false, reason: "rate_limited" };
  return { ok: true, text };
}

export function allowedNow(lastAt: number | undefined, now: number, windowMs: number): boolean {
  return lastAt === undefined || now - lastAt >= windowMs;
}

export function normalizeForMatch(value: string): string {
  return value
    .toLocaleLowerCase()
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function wordsUsedIn(text: string, issued: readonly string[]): string[] {
  const haystack = ` ${normalizeForMatch(text)} `;
  const hits: string[] = [];
  for (const word of issued) {
    const needle = normalizeForMatch(word);
    if (needle && haystack.includes(` ${needle} `)) hits.push(word);
  }
  return hits;
}
