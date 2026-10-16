import { MISTAKE_CATEGORIES } from "../../db/schema";

export type MistakeCategory = (typeof MISTAKE_CATEGORIES)[number];

export const QUIZ_XP = 10;
export const MIN_CATEGORY_MISTAKES = 3;
export const MIN_QUESTIONS = 3;
export const MAX_QUESTIONS = 5;

export interface StoredQuizQuestion {
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface StoredQuiz {
  category: MistakeCategory;
  questions: StoredQuizQuestion[];
  answers: (number | null)[];
  completedAt: string | null;
  awardedXp: number | null;
}

export function dominantCategory(
  mistakes: readonly { category: MistakeCategory }[],
): { category: MistakeCategory; count: number } | null {
  const counts = new Map<MistakeCategory, number>();
  for (const m of mistakes) counts.set(m.category, (counts.get(m.category) ?? 0) + 1);

  let best: { category: MistakeCategory; count: number } | null = null;
  for (const category of MISTAKE_CATEGORIES) {
    const count = counts.get(category) ?? 0;
    if (count < MIN_CATEGORY_MISTAKES) continue;
    if (!best || count > best.count) best = { category, count };
  }
  return best;
}

export function newQuiz(category: MistakeCategory, questions: StoredQuizQuestion[]): StoredQuiz {
  return {
    category,
    questions,
    answers: questions.map(() => null),
    completedAt: null,
    awardedXp: null,
  };
}

export type AnswerOutcome =
  | { ok: false; reason: "out_of_range" | "invalid_choice" }
  | { ok: true; locked: boolean; choice: number; correct: boolean; correctIndex: number; explanation: string };

export function applyAnswer(quiz: StoredQuiz, index: unknown, choice: unknown): AnswerOutcome {
  if (!Number.isInteger(index) || (index as number) < 0 || (index as number) >= quiz.questions.length) {
    return { ok: false, reason: "out_of_range" };
  }
  const i = index as number;
  const question = quiz.questions[i]!;

  const stored = quiz.answers[i];
  if (stored !== null && stored !== undefined) {
    return {
      ok: true,
      locked: true,
      choice: stored,
      correct: stored === question.correctIndex,
      correctIndex: question.correctIndex,
      explanation: question.explanation,
    };
  }

  if (!Number.isInteger(choice) || (choice as number) < 0 || (choice as number) >= question.options.length) {
    return { ok: false, reason: "invalid_choice" };
  }
  const c = choice as number;
  return {
    ok: true,
    locked: false,
    choice: c,
    correct: c === question.correctIndex,
    correctIndex: question.correctIndex,
    explanation: question.explanation,
  };
}

export function withAnswer(quiz: StoredQuiz, index: number, choice: number): StoredQuiz {
  const answers = [...quiz.answers];
  answers[index] = choice;
  const next: StoredQuiz = { ...quiz, answers };
  if (isComplete(next) && next.completedAt === null) next.completedAt = new Date().toISOString();
  return next;
}

export function isComplete(quiz: StoredQuiz): boolean {
  return quiz.questions.length > 0 && quiz.answers.every((a) => a !== null && a !== undefined);
}

export function scoreOf(quiz: StoredQuiz): number {
  let score = 0;
  quiz.questions.forEach((q, i) => {
    if (quiz.answers[i] === q.correctIndex) score += 1;
  });
  return score;
}
