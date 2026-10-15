"use client";

import { languageName, type FeedbackDTO } from "@linguamatch/shared";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { MistakeQuiz } from "@/components/feedback/mistake-quiz";
import { FailedState, NoConsentState, PendingState, ShortCallState } from "@/components/feedback/report-states";
import { LogoMark, LogoWord } from "@/components/brand/logo-mark";
import { FullPageSpinner } from "@/components/site/header";
import { XpAwardBanner } from "@/components/xp/xp-award-banner";
import { api, ApiError } from "@/lib/api";
import { useRequireUser } from "@/lib/auth";
import { formatDuration } from "@/lib/utils";

export default function FeedbackPage() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const user = useRequireUser();
  const [feedback, setFeedback] = useState<FeedbackDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notReady, setNotReady] = useState(false);

  const load = useCallback(async () => {
    try {
      setFeedback((await api.feedback(conversationId)).feedback);
      setNotReady(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) setNotReady(true);
      else setError((err as Error).message);
    }
  }, [conversationId]);

  useEffect(() => {
    if (user) void load();
  }, [user, load]);

  useEffect(() => {
    if (!(notReady || feedback?.status === "pending")) return;
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [notReady, feedback?.status, load]);

  const retry = useCallback(async () => {
    try {
      await api.retryFeedback(conversationId);
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }, [conversationId, load]);

  if (!user) return <FullPageSpinner />;

  const ready = feedback?.status === "ready";
  const subtitle = feedback
    ? [
        formatDuration(feedback.conversation.durationSeconds),
        `in ${languageName(feedback.targetLanguage)}, ${feedback.level}`,
        feedback.conversation.topics.length > 0 ? `Topics: ${feedback.conversation.topics.join(", ")}.` : null,
      ]
        .filter(Boolean)
        .join(" ")
    : null;

  return (
    <div className="bg-paper text-ink min-h-dvh">
      <header className="border-hairline mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-3 border-b px-6 py-3.5">
        <Link href="/" className="text-ink flex items-center gap-3 no-underline">
          <LogoMark />
          <LogoWord className="text-xl" />
        </Link>
        <Link
          href="/"
          className="bg-brand-you inline-flex min-h-12 items-center rounded-[14px] px-5 font-bold text-white no-underline"
        >
          Find another partner
        </Link>
      </header>

      <main className="mx-auto flex max-w-[1240px] flex-col gap-7 px-6 pt-4 pb-18">
        <div className="flex flex-col gap-2">
          <h1 className="font-display m-0 text-[clamp(30px,4vw,44px)] font-bold tracking-[-0.02em]">
            {feedback ? `Your call with ${feedback.partnerName}` : "Your call"}
          </h1>
          {subtitle && <p className="text-dim m-0 text-[17px]">{subtitle}</p>}
        </div>

        <XpAwardBanner sessionId={conversationId} />

        {error && <p className="m-0 text-[#8C1A21]">{error}</p>}

        {(notReady || feedback?.status === "pending") && <PendingState />}
        {feedback?.status === "insufficient_data" && <ShortCallState message={feedback.statusMessage} />}
        {feedback?.status === "failed" && <FailedState message={feedback.statusMessage} onRetry={retry} />}
        {feedback?.status === "no_consent" && <NoConsentState />}

        {ready && feedback && (
          <>
            <div className="flex flex-wrap items-start gap-6">
              <ScoreCard feedback={feedback} />
              <MistakeCard feedback={feedback} />
            </div>
            <MistakeQuiz conversationId={conversationId} />
          </>
        )}
      </main>
    </div>
  );
}

function ScoreCard({ feedback: f }: { feedback: FeedbackDTO }) {
  const spoken = f.metrics?.speakingSeconds ?? 0;
  const total = f.conversation.durationSeconds || 1;
  const mine = Math.min(100, Math.round((spoken / total) * 100));

  return (
    <section
      aria-labelledby="scores"
      className="border-hairline flex min-w-0 flex-1 basis-85 flex-col gap-4.5 rounded-3xl border bg-white p-7"
    >
      <h2 id="scores" className="m-0 text-[22px] font-semibold">
        How you did
      </h2>
      {[
        { label: "Grammar", value: f.grammarScore },
        { label: "Vocabulary", value: f.vocabularyScore },
        { label: "Fluency", value: f.fluencyScore },
      ].map((row) => (
        <div key={row.label} className="flex flex-col gap-1.5">
          <div className="flex justify-between">
            <span className="font-semibold">{row.label}</span>
            <span className="tabular-nums">{row.value ?? "—"}</span>
          </div>
          <div aria-hidden="true" className="h-2.5 rounded-[5px] bg-[#EEF0F7]">
            <span
              className="bg-brand-you block h-full rounded-[5px]"
              style={{ width: `${row.value ?? 0}%` }}
            />
          </div>
        </div>
      ))}

      <div className="flex flex-col gap-1.5 pt-1">
        <span className="font-semibold">Talk time</span>
        <div aria-hidden="true" className="bg-brand-partner h-2.5 overflow-hidden rounded-[5px]">
          <span className="bg-brand-you block h-full border-r-[3px] border-white" style={{ width: `${mine}%` }} />
        </div>
        <span className="text-dim text-sm">You spoke {mine}% of the call.</span>
      </div>

      <p className="m-0 text-sm text-[#5B6085]">Pronunciation isn&apos;t scored yet.</p>
    </section>
  );
}

function MistakeCard({ feedback: f }: { feedback: FeedbackDTO }) {
  if (f.mistakes.length === 0) {
    return (
      <section className="border-hairline flex min-w-0 shrink basis-105 flex-col gap-3 rounded-3xl border bg-white p-7 grow-[1.4]">
        <h2 className="m-0 text-[22px] font-semibold">Your sentences, fixed</h2>
        <p className="text-dim m-0 leading-[1.55]">
          Nothing needed fixing in this call. {f.summary ?? ""}
        </p>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="mistakes"
      className="border-hairline flex min-w-0 shrink basis-105 flex-col gap-4 rounded-3xl border bg-white p-7 grow-[1.4]"
    >
      <h2 id="mistakes" className="m-0 text-[22px] font-semibold">
        Your sentences, fixed
      </h2>
      {f.mistakes.map((m, i) => (
        <div
          key={i}
          className={
            i < f.mistakes.length - 1
              ? "flex flex-col gap-1 border-b border-[#EEF0F7] pb-3.5"
              : "flex flex-col gap-1"
          }
        >
          <span className="text-[#5B6085] line-through">{m.original}</span>
          <span className="text-fix-ink font-semibold">{m.corrected}</span>
          <span className="text-dim text-sm">{m.explanation}</span>
        </div>
      ))}
    </section>
  );
}
