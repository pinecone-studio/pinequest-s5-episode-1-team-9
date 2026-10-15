"use client";

import type { QuizAnsweredDTO, QuizDTO } from "@linguamatch/shared";
import { Check, Sparkles, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

const CATEGORY_LABEL: Record<string, string> = {
  grammar: "Grammar",
  vocabulary: "Vocabulary",
  word_choice: "Word choice",
  sentence_structure: "Sentence structure",
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
    <Card className="mt-6">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="text-primary size-4" /> Practice your mistakes
          </CardTitle>
          <Badge variant="secondary">{CATEGORY_LABEL[quiz.category] ?? quiz.category}</Badge>
        </div>
        <CardDescription>
          Built from the {CATEGORY_LABEL[quiz.category]?.toLowerCase() ?? quiz.category} slips in this conversation.
        </CardDescription>
      </CardHeader>

      <CardContent className="grid gap-4">
        {done ? (
          <div className="grid gap-3">
            <p className="text-lg font-semibold tabular-nums">
              {score}/{quiz.total} correct
            </p>
            {xpGained !== null && xpGained > 0 && <p className="text-primary text-sm">+{xpGained} XP earned</p>}
            <ol className="grid gap-2 text-sm">
              {quiz.questions.map((q, i) => {
                const r = resultFor(i);
                return (
                  <li key={i} className="flex items-start gap-2">
                    {r?.correct ? (
                      <Check className="text-success mt-0.5 size-4 shrink-0" />
                    ) : (
                      <X className="text-destructive mt-0.5 size-4 shrink-0" />
                    )}
                    <span>
                      {q.prompt}
                      {r && !r.correct && (
                        <span className="text-muted-foreground"> — {q.options[r.correctIndex]}</span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
        ) : (
          question && (
            <>
              <div className="text-muted-foreground text-xs tabular-nums">
                Question {current + 1} of {quiz.total}
              </div>
              <p className="font-medium">{question.prompt}</p>
              <div className="grid gap-2">
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
                        "rounded-lg border px-3 py-2 text-left text-sm transition",
                        !result && "hover:bg-muted/60",
                        isAnswer && "border-success/50 bg-success/10",
                        picked && !result?.correct && "border-destructive/50 bg-destructive/10",
                      )}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>

              {result && (
                <div className="grid gap-2">
                  <p className={cn("text-sm font-medium", result.correct ? "text-success" : "text-destructive")}>
                    {result.correct ? "Correct" : "Not quite"}
                  </p>
                  <p className="text-muted-foreground text-sm">{result.explanation}</p>
                  {current + 1 < quiz.total && (
                    <Button size="sm" className="justify-self-start" onClick={() => setCurrent((c) => c + 1)}>
                      Next question
                    </Button>
                  )}
                </div>
              )}
            </>
          )
        )}
        {error && <p className="text-destructive text-sm">{error}</p>}
      </CardContent>
    </Card>
  );
}
