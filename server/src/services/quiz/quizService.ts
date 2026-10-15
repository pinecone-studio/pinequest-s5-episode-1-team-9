import type { CefrLevel, QuizAnswerResultDTO, QuizDTO } from "@linguamatch/shared";
import { and, asc, eq } from "drizzle-orm";
import { db } from "../../db/client";
import { feedbackReports, mistakes } from "../../db/schema";
import { HttpError } from "../../utils/http";
import { awardQuizXp } from "../xp/quizXp";
import { generateQuiz, isQuizAiAvailable } from "./aiQuiz";
import {
  applyAnswer,
  dominantCategory,
  isComplete,
  newQuiz,
  scoreOf,
  withAnswer,
  type StoredQuiz,
} from "./quizRules";

const generating = new Set<string>();

async function loadReport(sessionId: string, userId: string) {
  const [report] = await db
    .select({
      id: feedbackReports.id,
      status: feedbackReports.status,
      level: feedbackReports.level,
      targetLanguage: feedbackReports.targetLanguage,
      quizJson: feedbackReports.quizJson,
    })
    .from(feedbackReports)
    .where(and(eq(feedbackReports.sessionId, sessionId), eq(feedbackReports.userId, userId)));
  return report ?? null;
}

function toDTO(quiz: StoredQuiz): QuizDTO {
  const answered = quiz.questions.flatMap((q, index) => {
    const choice = quiz.answers[index];
    if (choice === null || choice === undefined) return [];
    return [
      {
        index,
        choice,
        correct: choice === q.correctIndex,
        correctIndex: q.correctIndex,
        explanation: q.explanation,
      },
    ];
  });
  const complete = isComplete(quiz);
  return {
    category: quiz.category,
    questions: quiz.questions.map((q) => ({ prompt: q.prompt, options: q.options })),
    answered,
    completed: complete,
    score: complete ? scoreOf(quiz) : null,
    total: quiz.questions.length,
    awardedXp: quiz.awardedXp,
  };
}

async function save(reportId: string, quiz: StoredQuiz) {
  await db.update(feedbackReports).set({ quizJson: quiz }).where(eq(feedbackReports.id, reportId));
}

export async function getQuiz(sessionId: string, userId: string): Promise<QuizDTO | null> {
  const report = await loadReport(sessionId, userId);
  if (!report || report.status !== "ready") return null;

  const stored = report.quizJson as StoredQuiz | null;
  if (stored) return toDTO(stored);
  if (!isQuizAiAvailable()) return null;

  const rows = await db
    .select({ category: mistakes.category, original: mistakes.original, fixed: mistakes.fixed, reason: mistakes.reason })
    .from(mistakes)
    .where(and(eq(mistakes.sessionId, sessionId), eq(mistakes.userId, userId)))
    .orderBy(asc(mistakes.position));

  const target = dominantCategory(rows);
  if (!target) return null;

  const key = `${sessionId}:${userId}`;
  if (generating.has(key)) return null;
  generating.add(key);
  try {
    const questions = await generateQuiz({
      targetLanguage: report.targetLanguage,
      level: report.level as CefrLevel,
      category: target.category,
      mistakes: rows.filter((r) => r.category === target.category),
    });
    if (questions.length === 0) return null;

    const fresh = newQuiz(target.category, questions);
    await save(report.id, fresh);
    return toDTO(fresh);
  } finally {
    generating.delete(key);
  }
}

export async function answerQuiz(
  sessionId: string,
  userId: string,
  index: unknown,
  choice: unknown,
): Promise<QuizAnswerResultDTO> {
  const report = await loadReport(sessionId, userId);
  const stored = report?.quizJson as StoredQuiz | null | undefined;
  if (!report || !stored) throw new HttpError(404, "No quiz for this conversation");

  const outcome = applyAnswer(stored, index, choice);
  if (!outcome.ok) throw new HttpError(400, "That answer doesn't match the quiz");

  const result = {
    index: index as number,
    choice: outcome.choice,
    correct: outcome.correct,
    correctIndex: outcome.correctIndex,
    explanation: outcome.explanation,
  };

  if (outcome.locked) {
    const complete = isComplete(stored);
    return {
      result,
      locked: true,
      completed: complete,
      score: complete ? scoreOf(stored) : null,
      total: stored.questions.length,
      xp: null,
    };
  }

  let next = withAnswer(stored, index as number, outcome.choice);
  const complete = isComplete(next);
  let xp: QuizAnswerResultDTO["xp"] = null;

  if (complete && next.awardedXp === null) {
    const award = await awardQuizXp(userId, sessionId);
    if (award) {
      xp = award;
      next = { ...next, awardedXp: award.xpGained };
    }
  }
  await save(report.id, next);

  return {
    result,
    locked: false,
    completed: complete,
    score: complete ? scoreOf(next) : null,
    total: next.questions.length,
    xp,
  };
}
