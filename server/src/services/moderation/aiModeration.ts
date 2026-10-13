import { env } from "../../config/env";
import { db, isUniqueViolation } from "../../db/client";
import { bans, reports, users } from "../../db/schema";
import { findSession, type Session } from "../../models/Session";
import { getAI, isAIConfigured, type ModerationFinding, type ModerationUtterance } from "../ai";
import { endSession } from "../rooms/roomService";
import {
  clearModerationBuffer,
  drainModerationBuffer,
  moderationBacklog,
  sessionsWithModerationBacklog,
} from "./aiModerationQueue";
import { categoryToReportReason, composeReportDetails, qualifyingFindings } from "./aiModerationRules";
import { findActiveBan } from "./moderationService";

/**
 * Reserved account that owns every AI-generated report. It has no Clerk session and can never
 * sign in; it exists so reports keep a valid reporter_id and the dashboard can label the source.
 */
export const SYSTEM_MODERATOR_ID = "system_moderation";
const SYSTEM_MODERATOR_NAME = "LinguaMatch_AI";

/** Creates the moderation system account if it is missing. Safe to call on every startup. */
export async function ensureSystemModerator(): Promise<void> {
  await db
    .insert(users)
    .values({ id: SYSTEM_MODERATOR_ID, name: SYSTEM_MODERATOR_NAME, role: "moderator", isAdult: true })
    .onConflictDoNothing();
}

/**
 * Scans the pending utterances of every active conversation for abuse. Called on a timer; a
 * slow or failing AI provider never blocks the call itself (moderation is best-effort).
 */
export async function runAIModerationSweep(): Promise<void> {
  if (!env.AI_MODERATION_ENABLED || !isAIConfigured()) return;
  for (const sessionId of sessionsWithModerationBacklog()) {
    if (moderationBacklog(sessionId) < env.AI_MODERATION_MIN_SEGMENTS) continue;
    try {
      await moderateSession(sessionId);
    } catch (err) {
      console.error(`[moderation] AI scan failed for session ${sessionId}:`, err);
    }
  }
}

async function moderateSession(sessionId: string) {
  // Take the window before the network call so a slow model can't re-send or grow the buffer.
  const buffered = drainModerationBuffer(sessionId);
  if (buffered.length === 0) return;

  const session = await findSession(sessionId);
  if (!session || session.status !== "active" || !session.startedAt) return;
  if (session.userA === SYSTEM_MODERATOR_ID || session.userB === SYSTEM_MODERATOR_ID) return;

  const utterances = toUtterances(session, buffered);
  if (utterances.length === 0) return;

  const result = await getAI().moderateConversation({ targetLanguage: session.lang, utterances });
  const findings = qualifyingFindings(
    result.findings,
    env.AI_MODERATION_MIN_SEVERITY,
    env.AI_MODERATION_MIN_CONFIDENCE,
  );
  if (findings.length === 0) return;

  const offenders = new Set<string>();
  for (const finding of findings) {
    const reportedId = finding.speaker === "a" ? session.userA : session.userB;
    if (reportedId === SYSTEM_MODERATOR_ID) continue;
    offenders.add(reportedId);
    const reportId = await fileReport(sessionId, reportedId, finding);
    await suspendOffender(reportedId, finding, reportId);
  }

  if (offenders.size > 0) {
    console.warn(`[moderation] AI flagged ${offenders.size} participant(s) in session ${sessionId}; ending call`);
    await endSession(sessionId, null, "reported");
  }
}

function toUtterances(session: Session, buffered: { userId: string; text: string; spokenAt: Date }[]): ModerationUtterance[] {
  const startedAt = session.startedAt!.getTime();
  const utterances: ModerationUtterance[] = [];
  for (const item of buffered) {
    const speaker = item.userId === session.userA ? "a" : item.userId === session.userB ? "b" : null;
    if (!speaker) continue;
    utterances.push({
      speaker,
      text: item.text,
      offsetSeconds: Math.max(0, (item.spokenAt.getTime() - startedAt) / 1000),
    });
  }
  return utterances;
}

/** Inserts the report; returns its id, or null when this offender was already reported this call. */
async function fileReport(sessionId: string, reportedId: string, finding: ModerationFinding): Promise<number | null> {
  try {
    const [report] = await db
      .insert(reports)
      .values({
        reporterId: SYSTEM_MODERATOR_ID,
        reportedId,
        sessionId,
        reason: categoryToReportReason(finding.category),
        details: composeReportDetails(finding),
        aiFlag: true,
      })
      .onConflictDoNothing()
      .returning({ id: reports.id });
    return report?.id ?? null;
  } catch (err) {
    if (isUniqueViolation(err)) return null;
    throw err;
  }
}

/** Issues the automatic suspension unless the user is already banned. */
async function suspendOffender(userId: string, finding: ModerationFinding, reportId: number | null) {
  if (await findActiveBan(userId)) return;
  await db.insert(bans).values({
    userId,
    source: "automatic",
    reason: `AI moderation flagged ${finding.category} (${finding.severity} severity); suspended pending review`,
    reportId,
    createdBy: SYSTEM_MODERATOR_ID,
    endsAt: new Date(Date.now() + env.AI_MODERATION_SUSPEND_DAYS * 24 * 3600 * 1000),
  });
  console.warn(`[moderation] Auto-suspended ${userId} for ${env.AI_MODERATION_SUSPEND_DAYS} days (AI: ${finding.category})`);
}

let sweep: NodeJS.Timeout | null = null;

/** Starts the periodic scan. No-op (with a log) when moderation or the AI provider is disabled. */
export function startAIModerationSweep(): void {
  if (!env.AI_MODERATION_ENABLED) {
    console.log("[moderation] Real-time AI moderation disabled (AI_MODERATION_ENABLED=false)");
    return;
  }
  if (!isAIConfigured()) {
    console.warn("[moderation] Real-time AI moderation needs an AI provider key; not starting");
    return;
  }
  sweep ??= setInterval(() => void runAIModerationSweep(), env.AI_MODERATION_INTERVAL_SECONDS * 1000);
}

export function stopAIModerationSweep(): void {
  if (sweep) clearInterval(sweep);
  sweep = null;
}

export { clearModerationBuffer };
