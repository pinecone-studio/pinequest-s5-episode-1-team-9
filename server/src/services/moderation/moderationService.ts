import type { ReportReason } from "@linguamatch/shared";
import { and, countDistinct, desc, eq, gt, gte, isNull, lte, or } from "drizzle-orm";
import { env } from "../../config/env";
import { db, isUniqueViolation } from "../../db/client";
import { bans, reports, userBlocks } from "../../db/schema";
import { findSession, partnerIdOf } from "../../models/Session";
import { HttpError } from "../../utils/http";
import { endSession } from "../rooms/roomService";

const SUSPENSION_HOURS = 24;

/**
 * Reports and blocks are addressed by session, never by user id, so the client
 * never learns a stranger's account identifier.
 */
async function partnerIn(sessionId: string, userId: string) {
  const session = await findSession(sessionId);
  const partnerId = session && partnerIdOf(session, userId);
  if (!session || !partnerId) throw new HttpError(404, "Conversation not found");
  return { session, partnerId };
}

async function block(userId: string, blockedId: string, sessionId: string) {
  await db.insert(userBlocks).values({ blockerId: userId, blockedId, sessionId }).onConflictDoNothing();
}

export async function blockPartner(userId: string, sessionId: string) {
  const { session, partnerId } = await partnerIn(sessionId, userId);
  await block(userId, partnerId, sessionId);
  if (session.status !== "ended") await endSession(sessionId, userId, "blocked");
}

export async function reportPartner(userId: string, sessionId: string, reason: ReportReason, details: string) {
  const { session, partnerId } = await partnerIn(sessionId, userId);
  let reportId: number;
  try {
    const [report] = await db
      .insert(reports)
      .values({ reporterId: userId, reportedUserId: partnerId, sessionId, reason, details })
      .returning({ id: reports.id });
    reportId = report!.id;
  } catch (err) {
    if (isUniqueViolation(err)) throw new HttpError(409, "You already reported this conversation");
    throw err;
  }
  // Reporting always blocks too: you should never be matched with someone you reported.
  await block(userId, partnerId, sessionId);
  if (session.status !== "ended") await endSession(sessionId, userId, "reported");
  await applyAutomaticModeration(partnerId, reportId);
}

/** The ban currently in force for a user, if any. */
export async function findActiveBan(userId: string) {
  const now = new Date();
  const [ban] = await db
    .select()
    .from(bans)
    .where(
      and(
        eq(bans.userId, userId),
        isNull(bans.revokedAt),
        lte(bans.startsAt, now),
        or(isNull(bans.expiresAt), gt(bans.expiresAt, now)),
      ),
    )
    .orderBy(desc(bans.createdAt))
    .limit(1);
  return ban ?? null;
}

/** Temporarily suspends users who are reported by several different people within a day. */
async function applyAutomaticModeration(userId: string, reportId: number) {
  const since = new Date(Date.now() - 24 * 3600 * 1000);
  const [row] = await db
    .select({ reporters: countDistinct(reports.reporterId) })
    .from(reports)
    .where(and(eq(reports.reportedUserId, userId), gte(reports.createdAt, since)));
  const reporters = row?.reporters ?? 0;
  if (reporters < env.MODERATION_AUTO_SUSPEND_REPORTS) return;
  if (await findActiveBan(userId)) return;
  await db.insert(bans).values({
    userId,
    source: "automatic",
    reason: `Automatically suspended after ${reporters} reports in 24 hours, pending review`,
    reportId,
    expiresAt: new Date(Date.now() + SUSPENSION_HOURS * 3600 * 1000),
  });
  console.warn(`[moderation] User ${userId} auto-suspended after ${reporters} reports`);
}

/** Everyone the user blocked or was blocked by, for the matchmaker. */
export async function blockedUserIds(userId: string): Promise<Set<string>> {
  const rows = await db
    .select()
    .from(userBlocks)
    .where(or(eq(userBlocks.blockerId, userId), eq(userBlocks.blockedId, userId)));
  return new Set(rows.map((b) => (b.blockerId === userId ? b.blockedId : b.blockerId)));
}

export async function unblockUser(userId: string, blockedId: string) {
  await db.delete(userBlocks).where(and(eq(userBlocks.blockerId, userId), eq(userBlocks.blockedId, blockedId)));
}
