import type { XpAward } from "@linguamatch/shared";
import { and, eq, gt, sql } from "drizzle-orm";
import { db } from "../../db/client";
import { users, xpEvents } from "../../db/schema";
import {
  STREAK_BONUS_XP,
  XP_TIMEZONE,
  applyDailyCap,
  displayStreak,
  levelForXp,
  levelProgress,
  localDate,
  newlyUnlocked,
  nextStreak,
  unlockedEmojis,
  xpForTalkTime,
} from "./levels";

export type { XpAward };

async function xpEarnedToday(userId: string, today: string): Promise<number> {
  const [row] = await db
    .select({ earned: sql<number>`coalesce(sum(${xpEvents.amount}), 0)::int` })
    .from(xpEvents)
    .where(
      and(
        eq(xpEvents.userId, userId),
        gt(xpEvents.amount, 0),
        // Same zone as localDate(), so the cap and the streak agree on where a day ends.
        sql`(${xpEvents.createdAt} at time zone ${XP_TIMEZONE})::date = ${today}::date`,
      ),
    );
  return Number(row?.earned ?? 0);
}

export async function awardXpForSession(params: {
  userId: string;
  sessionId: string;
  talkSeconds: number;
  now?: Date;
}): Promise<XpAward | null> {
  const { userId, sessionId, talkSeconds, now = new Date() } = params;

  const baseXp = xpForTalkTime(talkSeconds);
  if (baseXp === 0) return null;

  const [user] = await db
    .select({
      xp: users.xp,
      xpLevel: users.xpLevel,
      streakCount: users.streakCount,
      lastCallDate: users.lastCallDate,
    })
    .from(users)
    .where(eq(users.id, userId));
  if (!user) return null;

  const today = localDate(now);
  const earned = await xpEarnedToday(userId, today);

  const callXp = applyDailyCap(baseXp, earned);
  const streak = nextStreak(user.lastCallDate, user.streakCount, today);
  const streakBonus = streak.bonus ? applyDailyCap(STREAK_BONUS_XP, earned + callXp) : 0;

  const events: (typeof xpEvents.$inferInsert)[] = [{ userId, sessionId, amount: callXp, reason: "call" }];
  // A capped-out bonus is 0 XP, which is ledger noise rather than an award.
  if (streak.bonus && streakBonus > 0) events.push({ userId, sessionId, amount: streakBonus, reason: "streak" });

  const inserted = await db
    .insert(xpEvents)
    .values(events)
    .onConflictDoNothing({ target: [xpEvents.userId, xpEvents.sessionId, xpEvents.reason] })
    .returning({ reason: xpEvents.reason, amount: xpEvents.amount });

  if (!inserted.some((r) => r.reason === "call")) return null;

  const xpGained = inserted.reduce((s, r) => s + r.amount, 0);
  const totalXp = user.xp + xpGained;
  const xpLevel = levelForXp(totalXp);

  await db
    .update(users)
    .set({
      xp: sql`${users.xp} + ${xpGained}`,
      xpLevel,
      streakCount: streak.streak,
      lastCallDate: today,
    })
    .where(eq(users.id, userId));

  return {
    sessionId,
    xpGained,
    callXp,
    streakBonus,
    cappedByDailyLimit: callXp < baseXp,
    totalXp,
    xpLevel,
    leveledUp: xpLevel > user.xpLevel,
    newEmojis: newlyUnlocked(user.xpLevel, xpLevel),
    streakCount: streak.streak,
  };
}

export async function getXpSummary(userId: string) {
  const [user] = await db
    .select({ xp: users.xp, streakCount: users.streakCount, lastCallDate: users.lastCallDate })
    .from(users)
    .where(eq(users.id, userId));
  if (!user) return null;

  const p = levelProgress(user.xp);
  return {
    ...p,
    streakCount: displayStreak(user.lastCallDate, user.streakCount),
    unlockedEmojis: unlockedEmojis(p.level),
    earnedToday: await xpEarnedToday(userId, localDate()),
  };
}

export async function getSessionXp(userId: string, sessionId: string) {
  const rows = await db
    .select({ reason: xpEvents.reason, amount: xpEvents.amount })
    .from(xpEvents)
    .where(and(eq(xpEvents.userId, userId), eq(xpEvents.sessionId, sessionId)));

  const summary = await getXpSummary(userId);
  if (!summary) return null;

  const xpGained = rows.reduce((s, r) => s + r.amount, 0);
  const levelBefore = levelForXp(summary.xp - xpGained);
  return {
    xpGained,
    streakBonus: rows.find((r) => r.reason === "streak")?.amount ?? 0,
    leveledUp: summary.level > levelBefore,
    newEmojis: newlyUnlocked(levelBefore, summary.level),
    ...summary,
  };
}

export async function getXpLevel(userId: string): Promise<number> {
  const [row] = await db.select({ xpLevel: users.xpLevel }).from(users).where(eq(users.id, userId));
  return row?.xpLevel ?? 1;
}