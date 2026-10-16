import { applyDailyCap, levelForXp, localDate } from "@linguamatch/shared";
import { eq, sql } from "drizzle-orm";
import { db } from "../../db/client";
import { users, xpEvents } from "../../db/schema";
import { QUIZ_XP } from "../quiz/quizRules";
import { xpEarnedToday } from "./xpService";

export interface QuizAward {
  xpGained: number;
  totalXp: number;
  xpLevel: number;
  cappedByDailyLimit: boolean;
}

export async function awardQuizXp(userId: string, sessionId: string): Promise<QuizAward | null> {
  const earned = await xpEarnedToday(userId, localDate());
  const amount = applyDailyCap(QUIZ_XP, earned);

  const inserted = await db
    .insert(xpEvents)
    .values({ userId, sessionId, amount, reason: "quiz" })
    .onConflictDoNothing()
    .returning({ amount: xpEvents.amount });
  if (inserted.length === 0) return null;

  const [row] = await db
    .update(users)
    .set({ xp: sql`${users.xp} + ${amount}` })
    .where(eq(users.id, userId))
    .returning({ xp: users.xp });
  if (!row) return null;

  const xpLevel = levelForXp(row.xp);
  await db.update(users).set({ xpLevel }).where(eq(users.id, userId));

  return { xpGained: amount, totalXp: row.xp, xpLevel, cappedByDailyLimit: amount < QUIZ_XP };
}
