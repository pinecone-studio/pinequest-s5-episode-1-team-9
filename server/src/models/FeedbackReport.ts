import { and, eq } from "drizzle-orm";
import { db, isUuid } from "../db/client";
import { feedbackReports } from "../db/schema";

export type FeedbackReport = typeof feedbackReports.$inferSelect;
export type FeedbackReportPatch = Partial<
  Omit<typeof feedbackReports.$inferInsert, "id" | "sessionId" | "userId" | "createdAt" | "updatedAt">
>;

export async function findFeedback(sessionId: string, userId: string): Promise<FeedbackReport | null> {
  if (!isUuid(sessionId)) return null;
  const [feedback] = await db
    .select()
    .from(feedbackReports)
    .where(and(eq(feedbackReports.sessionId, sessionId), eq(feedbackReports.userId, userId)));
  return feedback ?? null;
}

export async function updateFeedback(id: string, patch: FeedbackReportPatch): Promise<void> {
  await db.update(feedbackReports).set(patch).where(eq(feedbackReports.id, id));
}
