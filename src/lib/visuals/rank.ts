import type { VisualCandidate } from "@/lib/visuals/types";

export function chooseVisual(
  candidates: VisualCandidate[],
  query: { keywords: string[]; description: string; duration?: number },
  used: Set<string>,
): VisualCandidate | null {
  const ranked = candidates
    .filter((candidate) => !used.has(candidate.id))
    .map((candidate) => ({ candidate, score: scoreCandidate(candidate, query) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);
  return ranked[0]?.candidate ?? null;
}

export function scoreCandidate(
  candidate: VisualCandidate,
  query: { keywords: string[]; description: string; duration?: number },
): number {
  const haystack = `${candidate.title} ${candidate.url}`.toLowerCase();
  const terms = [...query.keywords, ...query.description.split(/\s+/)]
    .map((term) => term.toLowerCase().replace(/[^a-z0-9]/g, ""))
    .filter((term) => term.length > 3);
  const hits = new Set(terms.filter((term) => haystack.includes(term)));
  if (hits.size === 0) return 0;
  let score = hits.size * 2;
  if (candidate.height > candidate.width) score += 1;
  if (query.duration && candidate.duration) {
    const gap = Math.abs(candidate.duration - query.duration);
    if (gap < 4) score += 1;
  }
  return score;
}
