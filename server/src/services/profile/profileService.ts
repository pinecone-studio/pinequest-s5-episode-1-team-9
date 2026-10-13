import type { ProfileStats } from "@linguamatch/shared";
import { and, asc, desc, eq, isNotNull } from "drizzle-orm";
import { db } from "../../db/client";
import { feedbackReports, sessions } from "../../db/schema";
import { involvesUser, sessionDurationSeconds } from "../../models/Session";
import type { User } from "../../models/User";

type TrendMetric = ProfileStats["languages"][number]["trend"][number]["metric"];
const METRIC_FIELDS: [TrendMetric, "fluency" | "grammar" | "vocabulary" | "overallScore"][] = [
  ["fluency", "fluency"],
  ["grammar", "grammar"],
  ["vocabulary", "vocabulary"],
  ["overall", "overallScore"],
];

const avg = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) / xs.length);

/** Everything is derived from sessions and feedback, so there are no counters to drift. */
export async function buildProfileStats(user: User): Promise<ProfileStats> {
  const [completed, feedback] = await Promise.all([
    // A session counts once both people were in the room (started_at is set).
    db
      .select({
        id: sessions.id,
        targetLanguage: sessions.lang,
        startedAt: sessions.startedAt,
        endedAt: sessions.endedAt,
      })
      .from(sessions)
      .where(and(eq(sessions.status, "ended"), isNotNull(sessions.startedAt), involvesUser(user.id)))
      .orderBy(desc(sessions.startedAt)),
    db.select().from(feedbackReports).where(eq(feedbackReports.userId, user.id)).orderBy(asc(feedbackReports.createdAt)),
  ]);
  const feedbackBySession = new Map(feedback.map((f) => [f.sessionId, f]));
  const scored = feedback.flatMap((f) => (f.status === "ready" && f.overallScore !== null ? [f.overallScore] : []));

  const languages = user.targetLanguages.map((t) => {
    const convs = completed.filter((c) => c.targetLanguage === t.language);
    const ready = feedback.filter((f) => f.targetLanguage === t.language && f.status === "ready");
    // Compare the average of the first few reports with the latest few, once there are at least two.
    const window = Math.min(3, Math.floor(ready.length / 2));
    const trend =
      window > 0
        ? METRIC_FIELDS.flatMap(([metric, field]) => {
            const values = ready.map((f) => f[field]).filter((v): v is number => typeof v === "number");
            if (values.length < 2) return [];
            return [{ metric, first: avg(values.slice(0, window)), latest: avg(values.slice(-window)) }];
          })
        : [];
    return {
      language: t.language,
      level: t.level,
      estimatedPerformance: t.estimatedPerformance ?? null,
      conversations: convs.length,
      practiceSeconds: convs.reduce((sum, c) => sum + sessionDurationSeconds(c), 0),
      trend,
    };
  });

  return {
    username: user.name,
    nativeLanguage: user.nativeLang,
    memberSince: user.createdAt.toISOString(),
    totals: {
      conversations: completed.length,
      practiceSeconds: completed.reduce((sum, c) => sum + sessionDurationSeconds(c), 0),
      averageScore: scored.length ? avg(scored) : null,
    },
    languages,
    recent: completed.slice(0, 10).map((c) => {
      const f = feedbackBySession.get(c.id);
      return {
        conversationId: c.id,
        targetLanguage: c.targetLanguage,
        endedAt: c.endedAt?.toISOString() ?? null,
        durationSeconds: sessionDurationSeconds(c),
        overallScore: f?.overallScore ?? null,
        status: f?.status ?? "pending",
      };
    }),
  };
}
