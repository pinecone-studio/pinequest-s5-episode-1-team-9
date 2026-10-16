"use client";

import type { QuizAnsweredDTO, QuizDTO } from "@linguamatch/shared";
import { Check, X } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

const CATEGORY_BLURB: Record<string, string> = {
  grammar: "grammar slips",
  vocabulary: "word choices",
  word_choice: "word choices",
  sentence_structure: "sentence shapes",
};

export function MistakeQuiz({ conversationId }: { conversationId: string }) {
  const [quiz, setQuiz] = useState<QuizDTO | null>(null);
  const [answered, setAnswered] = useState<QuizAnsweredDTO[]>([]);
  const [score, setScore] = useState<number | null>(null);
  const [xpGained, setXpGained] = useState<number | null>(null);
  const [current, setCurrent] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .quiz(conversationId)
      .then((r) => {
        if (cancelled || !r.quiz) return;
        setQuiz(r.quiz);
        setAnswered(r.quiz.answered);
        setScore(r.quiz.score);
        setXpGained(r.quiz.awardedXp);
        setCurrent(Math.min(r.quiz.answered.length, Math.max(0, r.quiz.questions.length - 1)));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  if (!quiz) return null;

  const resultFor = (index: number) => answered.find((a) => a.index === index) ?? null;
  const question = quiz.questions[current];
  const result = resultFor(current);
  const done = answered.length === quiz.questions.length;

  const choose = async (choice: number) => {
    if (busy || result) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api.answerQuiz(conversationId, current, choice);
      setAnswered((prev) => (prev.some((a) => a.index === r.result.index) ? prev : [...prev, r.result]));
      setScore(r.score);
      if (r.xp) setXpGained(r.xp.xpGained);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      aria-labelledby="quiz"
      className="bg-brand-you-tint flex flex-wrap gap-7 rounded-3xl p-7"
    >
      <div className="flex min-w-0 flex-1 basis-65 flex-col gap-2.5">
        <h2 id="quiz" className="font-display m-0 text-2xl leading-[1.25] font-bold">
          Practice your mistakes
        </h2>
        <p className="m-0 leading-[1.55] text-[#2F3566]">
          Four quick questions built from the {CATEGORY_BLURB[quiz.category] ?? quiz.category} in this call. Finish
          them for +10 XP.
        </p>
        {done ? (
          <span className="text-brand-you-deep font-semibold tabular-nums">
            {score}/{quiz.total} correct
            {xpGained !== null && xpGained > 0 ? ` · +${xpGained} XP` : ""}
          </span>
        ) : (
          <span className="text-brand-you-deep font-semibold">
            Question {current + 1} of {quiz.total}
          </span>
        )}
      </div>

      <div className="flex min-w-0 shrink basis-105 flex-col gap-3 rounded-[20px] bg-white p-6 grow-[1.6]">
        {done ? (
          <ol className="m-0 flex list-none flex-col gap-2.5 p-0">
            {quiz.questions.map((q, i) => {
              const r = resultFor(i);
              return (
                <li key={i} className="flex items-start gap-2 text-[15px]">
                  {r?.correct ? (
                    <Check aria-hidden="true" className="text-fix-ink mt-0.5 size-4.5 shrink-0" strokeWidth={2.6} />
                  ) : (
                    <X aria-hidden="true" className="mt-0.5 size-4.5 shrink-0 text-[#B4232B]" />
                  )}
                  <span>
                    {q.prompt}
                    {r && !r.correct && (
                      <strong className="text-fix-ink"> {q.options[r.correctIndex]}</strong>
                    )}
                  </span>
                </li>
              );
            })}
          </ol>
        ) : (
          question && (
            <>
              <p className="m-0 text-[19px] leading-[1.45] font-semibold">{question.prompt}</p>
              {question.options.map((option, i) => {
                const picked = result?.choice === i;
                const isAnswer = result && i === result.correctIndex;
                return (
                  <button
                    key={i}
                    type="button"
                    disabled={Boolean(result) || busy}
                    onClick={() => void choose(i)}
                    className={cn(
                      "flex min-h-13 items-center justify-between rounded-[14px] px-4 text-left text-[17px]",
                      isAnswer
                        ? "text-fix-ink border-fix border-2 bg-[#E7F6EE] font-bold"
                        : picked
                          ? "border-2 border-[#B4232B] bg-[#FBEAEA] font-bold text-[#8C1A21]"
                          : "border border-[#D6DAEA] bg-white font-medium",
                      !result && !busy && "hover:border-brand-you cursor-pointer",
                    )}
                  >
                    {option}
                    {isAnswer && <Check aria-hidden="true" className="size-5" strokeWidth={2.6} />}
                  </button>
                );
              })}
              {result && (
                <>
                  <p role="status" className={cn("m-0 font-semibold", result.correct ? "text-fix-ink" : "text-[#8C1A21]")}>
                    {result.correct ? "Right." : "Not quite."} {result.explanation}
                  </p>
                  {current + 1 < quiz.total && (
                    <button
                      type="button"
                      onClick={() => setCurrent((c) => c + 1)}
                      className="bg-brand-you min-h-12 self-end rounded-xl border-0 px-5 text-base font-bold text-white"
                    >
                      Next question
                    </button>
                  )}
                </>
              )}
            </>
          )
        )}
        {error && <p className="m-0 text-sm text-[#8C1A21]">{error}</p>}
      </div>
    </section>
  );
}
