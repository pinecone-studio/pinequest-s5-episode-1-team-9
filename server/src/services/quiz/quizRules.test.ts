import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MIN_CATEGORY_MISTAKES,
  applyAnswer,
  dominantCategory,
  isComplete,
  newQuiz,
  scoreOf,
  withAnswer,
  type StoredQuizQuestion,
} from "./quizRules";

const question = (correctIndex: number, label: string): StoredQuizQuestion => ({
  prompt: `Pick the right form (${label})`,
  options: ["a", "b", "c"],
  correctIndex,
  explanation: `because ${label}`,
});

const quizOf = (...correct: number[]) =>
  newQuiz("grammar", correct.map((c, i) => question(c, `q${i}`)));

const times = (category: string, n: number) =>
  Array.from({ length: n }, () => ({ category: category as "grammar" }));

test("dominantCategory needs at least three in one category", () => {
  assert.equal(dominantCategory([]), null);
  assert.equal(dominantCategory(times("grammar", MIN_CATEGORY_MISTAKES - 1)), null);
  assert.deepEqual(dominantCategory(times("grammar", MIN_CATEGORY_MISTAKES)), {
    category: "grammar",
    count: 3,
  });
});

test("dominantCategory ignores categories under the threshold even when there are many mistakes", () => {
  const spread = [
    ...times("grammar", 2),
    ...times("vocabulary", 2),
    ...times("word_choice", 2),
    ...times("sentence_structure", 2),
  ];
  assert.equal(dominantCategory(spread), null);
});

test("dominantCategory picks the largest qualifying category", () => {
  const mistakes = [...times("grammar", 3), ...times("vocabulary", 5)];
  assert.deepEqual(dominantCategory(mistakes), { category: "vocabulary", count: 5 });
});

test("a new quiz starts unanswered, incomplete and unscored", () => {
  const quiz = quizOf(0, 1, 2);
  assert.deepEqual(quiz.answers, [null, null, null]);
  assert.equal(quiz.completedAt, null);
  assert.equal(quiz.awardedXp, null);
  assert.equal(isComplete(quiz), false);
  assert.equal(scoreOf(quiz), 0);
});

test("applyAnswer grades a fresh answer and reports the key", () => {
  const quiz = quizOf(1, 0, 2);
  assert.deepEqual(applyAnswer(quiz, 0, 1), {
    ok: true,
    locked: false,
    choice: 1,
    correct: true,
    correctIndex: 1,
    explanation: "because q0",
  });
  assert.deepEqual(applyAnswer(quiz, 0, 2), {
    ok: true,
    locked: false,
    choice: 2,
    correct: false,
    correctIndex: 1,
    explanation: "because q0",
  });
});

test("applyAnswer rejects an out-of-range question index", () => {
  const quiz = quizOf(0, 1);
  for (const bad of [-1, 2, 99, 1.5, "0", null, undefined, NaN]) {
    assert.deepEqual(applyAnswer(quiz, bad, 0), { ok: false, reason: "out_of_range" });
  }
});

test("applyAnswer rejects a choice outside the options", () => {
  const quiz = quizOf(0);
  for (const bad of [-1, 3, 99, 0.5, "1", null, undefined]) {
    assert.deepEqual(applyAnswer(quiz, 0, bad), { ok: false, reason: "invalid_choice" });
  }
});

test("an answered question is locked: a second answer returns the stored result unchanged", () => {
  const first = withAnswer(quizOf(1, 0), 0, 2);
  assert.equal(first.answers[0], 2);

  const retry = applyAnswer(first, 0, 1);
  assert.deepEqual(retry, {
    ok: true,
    locked: true,
    choice: 2,
    correct: false,
    correctIndex: 1,
    explanation: "because q0",
  });
});

test("a locked correct answer stays correct on a retry", () => {
  const answered = withAnswer(quizOf(1, 0), 0, 1);
  const retry = applyAnswer(answered, 0, 0);
  assert.equal(retry.ok && retry.locked, true);
  assert.equal(retry.ok && retry.correct, true);
  assert.equal(retry.ok && retry.choice, 1);
});

test("the lock holds even when the retry sends an invalid choice", () => {
  const answered = withAnswer(quizOf(1), 0, 0);
  const retry = applyAnswer(answered, 0, 99);
  assert.equal(retry.ok, true);
  assert.equal(retry.ok && retry.locked, true);
  assert.equal(retry.ok && retry.choice, 0);
});

test("locking one question leaves the others open", () => {
  const answered = withAnswer(quizOf(0, 1, 2), 1, 1);
  const locked = applyAnswer(answered, 1, 0);
  assert.equal(locked.ok && locked.locked, true);
  const other = applyAnswer(answered, 2, 2);
  assert.equal(other.ok && other.locked, false);
});

test("withAnswer does not mutate the quiz it is given", () => {
  const quiz = quizOf(0, 1);
  const next = withAnswer(quiz, 0, 0);
  assert.deepEqual(quiz.answers, [null, null]);
  assert.deepEqual(next.answers, [0, null]);
});

test("completion is reached only when every question is answered, and stamps once", () => {
  let quiz = quizOf(0, 1, 2);
  quiz = withAnswer(quiz, 0, 0);
  assert.equal(isComplete(quiz), false);
  quiz = withAnswer(quiz, 1, 1);
  assert.equal(isComplete(quiz), false);
  quiz = withAnswer(quiz, 2, 0);
  assert.equal(isComplete(quiz), true);
  assert.ok(quiz.completedAt);

  const stamp = quiz.completedAt;
  const again = withAnswer(quiz, 0, 0);
  assert.equal(again.completedAt, stamp);
});

test("scoreOf counts only exact matches", () => {
  let quiz = quizOf(0, 1, 2);
  quiz = withAnswer(quiz, 0, 0);
  quiz = withAnswer(quiz, 1, 2);
  quiz = withAnswer(quiz, 2, 2);
  assert.equal(scoreOf(quiz), 2);
});
