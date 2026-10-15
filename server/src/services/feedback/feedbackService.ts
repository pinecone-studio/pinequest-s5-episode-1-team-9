import type { FeedbackDTO, FluencyMetrics, Mistake } from "@linguamatch/shared";
import { and, asc, eq, inArray, isNull, lt, sql } from "drizzle-orm";
import { env } from "../../config/env";
import { db } from "../../db/client";
import { feedbackReports, mistakes, sessions, transcriptLines, users } from "../../db/schema";
import { updateFeedback, type FeedbackReport, type FeedbackReportPatch } from "../../models/FeedbackReport";
import { findSession, participantsOf, sessionDurationSeconds, type Participant, type Session } from "../../models/Session";
import { AIResponseError, getAI, isAIConfigured } from "../ai";
import { pronunciationCapability } from "../speech";
import { computeFluencyMetrics, hasEnoughSpeech } from "./metrics";

const inFlight = new Set<string>();

type Line = typeof transcriptLines.$inferSelect;

/**
 * Creates one feedback report per participant and fills each in. Runs in the background
 * after a session ends; the feedback page polls until status leaves "pending".
 */
export async function generateConversationFeedback(sessionId: string): Promise<void> {
  if (inFlight.has(sessionId)) return;
  inFlight.add(sessionId);
  try {
    const session = await findSession(sessionId);
    if (!session || session.status !== "ended" || !session.startedAt) return;
    const transcript = await db
      .select()
      .from(transcriptLines)
      .where(eq(transcriptLines.sessionId, sessionId))
      .orderBy(transcriptLines.spokenAt, transcriptLines.id);

    const results = await Promise.all(participantsOf(session).map((p) => generateForParticipant(session, transcript, p)));

    // Transcripts exist only to produce feedback. Drop them once every report is settled,
    // unless every participant opted in to keeping them.
    if (results.every((status) => status !== "failed")) await maybePurgeTranscript(session);
  } finally {
    inFlight.delete(sessionId);
  }
}

async function generateForParticipant(session: Session, transcript: Line[], participant: Participant) {
  const { userId } = participant;
  await db
    .insert(feedbackReports)
    .values({ sessionId: session.id, userId, targetLanguage: session.lang, level: participant.level })
    .onConflictDoNothing();
  const [feedback] = await db
    .select()
    .from(feedbackReports)
    .where(and(eq(feedbackReports.sessionId, session.id), eq(feedbackReports.userId, userId)));
  if (!feedback) throw new Error(`Feedback report for ${session.id}/${userId} is missing`);
  if (feedback.status === "ready" || feedback.status === "insufficient_data" || feedback.status === "no_consent") {
    return feedback.status;
  }

  const finish = async (status: FeedbackReport["status"], statusMessage: string | null, patch: FeedbackReportPatch = {}) => {
    await updateFeedback(feedback.id, { ...patch, status, statusMessage });
    return status;
  };

  if (!participant.transcriptionConsent) {
    return finish(
      "no_consent",
      "You hadn't enabled speech transcription, so nothing you said was captured or analyzed. Turn it on in Settings to get feedback next time.",
    );
  }

  const lines = transcript.filter((s) => s.userId === userId);
  const metrics = computeFluencyMetrics(
    session.lang,
    lines.map((l) => ({ text: l.text, startedAt: l.spokenAt, endedAt: l.endedAt, confidence: l.confidence })),
  );

  if (!hasEnoughSpeech(metrics)) {
    return finish(
      "insufficient_data",
      lines.length === 0
        ? "No speech was transcribed for you. Your browser may not support speech recognition, or the microphone was muted."
        : `Only ${metrics.wordCount} ${metrics.unit} were transcribed — not enough for a reliable report. Try a longer conversation.`,
      { metrics },
    );
  }

  if (!isAIConfigured()) {
    return finish("failed", "AI feedback is not configured on this server (missing ANTHROPIC_API_KEY).", { metrics });
  }

  try {
    const [profile] = await db.select({ nativeLang: users.nativeLang }).from(users).where(eq(users.id, userId));
    const analysis = await getAI().analyzeConversation({
      targetLanguage: session.lang,
      nativeLanguage: profile?.nativeLang ?? null,
      level: participant.level,
      topics: session.topics.map((t) => t.title).filter(Boolean),
      utterances: lines.map((s) => ({
        text: s.text,
        offsetSeconds: (s.spokenAt.getTime() - session.startedAt!.getTime()) / 1000,
        confidence: s.confidence,
      })),
      metrics,
    });

    const scores = [analysis.grammarScore, analysis.vocabularyScore, analysis.fluencyScore];
    const overall = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);

    await db.transaction(async (tx) => {
      await tx
        .update(feedbackReports)
        .set({
          status: "ready",
          statusMessage: null,
          metrics,
          estimatedPerformance: analysis.estimatedPerformance,
          grammar: analysis.grammarScore,
          vocabulary: analysis.vocabularyScore,
          fluency: analysis.fluencyScore,
          pronunciationScore: null,
          overallScore: overall,
          summary: analysis.summary,
          summaryJson: {
            pronunciationNote: pronunciationNote(pronunciationCapability().note, metrics),
            vocabularySuggestions: analysis.vocabularySuggestions,
            fluencyNotes: analysis.fluencyNotes,
            strengths: analysis.strengths,
            weaknesses: analysis.weaknesses,
            exercises: analysis.exercises,
          },
          aiModel: `${env.AI_PROVIDER}:${env.ANTHROPIC_MODEL}`,
          generatedAt: new Date(),
        })
        .where(eq(feedbackReports.id, feedback.id));
      // A retried report replaces the mistakes of the failed attempt.
      await tx.delete(mistakes).where(and(eq(mistakes.sessionId, session.id), eq(mistakes.userId, userId)));
      if (analysis.mistakes.length) {
        await tx.insert(mistakes).values(
          analysis.mistakes.map((m, position) => ({
            sessionId: session.id,
            userId,
            transcriptLineId: lineContaining(lines, m.original)?.id ?? null,
            category: m.category,
            original: m.original,
            fixed: m.corrected,
            reason: m.explanation,
            position,
          })),
        );
      }
    });

    const language = session.lang;
    await db
      .update(users)
      .set({
        targetLanguages: sql`(
          select jsonb_agg(
            case when e.elem->>'language' = ${language}
              then e.elem || jsonb_build_object('estimatedPerformance', ${analysis.estimatedPerformance}::text)
              else e.elem end
            order by e.ord)
          from jsonb_array_elements(${users.targetLanguages}) with ordinality as e(elem, ord)
        )`,
      })
      .where(and(eq(users.id, userId), sql`${users.targetLanguages} @> ${JSON.stringify([{ language }])}::jsonb`));
    return "ready" as const;
  } catch (err) {
    console.error(`[feedback] Analysis failed for session ${session.id}:`, err);
    const message =
      err instanceof AIResponseError ? err.message : "The AI service was unavailable. You can retry from this page.";
    return finish("failed", message, { metrics });
  }
}

/** The utterance a quoted mistake came from, so it can be shown in context while the transcript exists. */
function lineContaining(lines: Line[], quote: string): Line | undefined {
  const needle = quote.trim().toLowerCase();
  return needle ? lines.find((l) => l.text.toLowerCase().includes(needle)) : undefined;
}

function pronunciationNote(base: string, metrics: FluencyMetrics): string {
  if (!metrics.lowConfidenceUtterances.length) return base;
  return `${base} The recognizer was unsure about ${metrics.lowConfidenceUtterances.length} of your phrases, which sometimes (not always) points to unclear pronunciation.`;
}

async function maybePurgeTranscript(session: Session) {
  const people = await db
    .select({ retainTranscripts: users.retainTranscripts })
    .from(users)
    .where(inArray(users.id, [session.userA, session.userB]));
  const everyoneRetains = people.length === 2 && people.every((u) => u.retainTranscripts);
  if (everyoneRetains) return;
  await db.transaction(async (tx) => {
    await tx.delete(transcriptLines).where(eq(transcriptLines.sessionId, session.id));
    await tx.update(sessions).set({ transcriptPurgedAt: new Date() }).where(eq(sessions.id, session.id));
  });
}

/** Safety net: purge transcripts of sessions that ended over a day ago (e.g. failed feedback never retried). */
export async function purgeStaleTranscripts(): Promise<void> {
  const cutoff = new Date(Date.now() - 24 * 3600 * 1000);
  const stale = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.status, "ended"), lt(sessions.endedAt, cutoff), isNull(sessions.transcriptPurgedAt)));
  for (const session of stale) await maybePurgeTranscript(session);
}

export async function toFeedbackDTO(feedback: FeedbackReport): Promise<FeedbackDTO> {
  const [[session], rows] = await Promise.all([
    db
      .select({
        startedAt: sessions.startedAt,
        endedAt: sessions.endedAt,
        topics: sessions.topics,
        createdAt: sessions.createdAt,
        userA: sessions.userA,
        userB: sessions.userB,
        userALevel: sessions.userALevel,
        userBLevel: sessions.userBLevel,
      })
      .from(sessions)
      .where(eq(sessions.id, feedback.sessionId)),
    db
      .select()
      .from(mistakes)
      .where(and(eq(mistakes.sessionId, feedback.sessionId), eq(mistakes.userId, feedback.userId)))
      .orderBy(asc(mistakes.position)),
  ]);
  const partnerId = session ? (session.userA === feedback.userId ? session.userB : session.userA) : null;
  const [partner] = partnerId
    ? await db.select({ name: users.name, deletedAt: users.deletedAt }).from(users).where(eq(users.id, partnerId))
    : [];

  const details = feedback.summaryJson;
  return {
    id: feedback.id,
    conversationId: feedback.sessionId,
    partnerName: !partner || partner.deletedAt ? "Your partner" : partner.name,
    partnerLevel: ((session && (session.userA === feedback.userId ? session.userBLevel : session.userALevel)) ??
      feedback.level) as FeedbackDTO["partnerLevel"],
    status: feedback.status,
    statusMessage: feedback.statusMessage,
    targetLanguage: feedback.targetLanguage,
    level: feedback.level as FeedbackDTO["level"],
    estimatedPerformance: feedback.estimatedPerformance,
    grammarScore: feedback.grammar,
    vocabularyScore: feedback.vocabulary,
    fluencyScore: feedback.fluency,
    pronunciationScore: feedback.pronunciationScore,
    pronunciationNote: details?.pronunciationNote ?? null,
    overallScore: feedback.overallScore,
    summary: feedback.summary,
    mistakes: rows.map(
      (m): Mistake => ({ category: m.category, original: m.original, corrected: m.fixed, explanation: m.reason }),
    ),
    vocabularySuggestions: details?.vocabularySuggestions ?? [],
    fluencyNotes: details?.fluencyNotes ?? [],
    strengths: details?.strengths ?? [],
    weaknesses: details?.weaknesses ?? [],
    exercises: details?.exercises ?? [],
    metrics: feedback.metrics,
    conversation: {
      startTime: (session?.startedAt ?? session?.createdAt ?? feedback.createdAt).toISOString(),
      endTime: session?.endedAt?.toISOString() ?? null,
      durationSeconds: session ? sessionDurationSeconds(session) : 0,
      topics: session?.topics.map((t) => t.title).filter(Boolean) ?? [],
    },
    createdAt: feedback.createdAt.toISOString(),
  };
}
