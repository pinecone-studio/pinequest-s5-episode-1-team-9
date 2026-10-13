import type { ReportReason } from "@linguamatch/shared";
import type { ModerationCategory, ModerationFinding, ModerationSeverity } from "../ai/types";

/** `reports.details` is capped at 1000 characters by a CHECK constraint. */
export const MAX_DETAILS_LENGTH = 1000;

const RANK: Record<ModerationSeverity, number> = { low: 0, medium: 1, high: 2 };

/** True when `value` is at least as severe/confident as `min`. */
export function meetsLevel(value: ModerationSeverity, min: ModerationSeverity): boolean {
  return RANK[value] >= RANK[min];
}

/** AI categories map one-to-one onto the community-rules report reasons. */
export function categoryToReportReason(category: ModerationCategory): ReportReason {
  return category;
}

export function truncate(text: string, max = MAX_DETAILS_LENGTH): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

/**
 * The AI findings serious enough to act on. Both the model's own confidence and the severity of
 * the behavior must clear their thresholds; anything milder is left for human review to avoid
 * false positives on an automatic suspension.
 */
export function qualifyingFindings(
  findings: ModerationFinding[],
  minSeverity: ModerationSeverity,
  minConfidence: ModerationSeverity,
): ModerationFinding[] {
  return findings.filter((f) => meetsLevel(f.severity, minSeverity) && meetsLevel(f.confidence, minConfidence));
}

/** Human-readable evidence stored on the report; never leaves the moderation dashboard. */
export function composeReportDetails(finding: ModerationFinding): string {
  return truncate(
    `[AI ${finding.category}/${finding.severity}, ${finding.confidence} confidence] ${finding.reason}\nQuote: "${finding.quote}"`,
  );
}
