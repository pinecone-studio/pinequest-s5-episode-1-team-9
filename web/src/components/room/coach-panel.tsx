"use client";

import type { Topic } from "@linguamatch/shared";
import { CircleStop, Drama, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { RoleplayCard } from "@/components/room/roleplay-card";
import { Button } from "@/components/ui/button";
import type { Roleplay } from "@/hooks/useRoleplay";
import type { TalkBalanceState } from "@/hooks/useTalkBalance";
import type { SpeechStatus } from "@/hooks/useSpeechRecognition";
import { cn } from "@/lib/utils";

export function CoachPanel({
  topic,
  loading,
  error,
  onNewTopic,
  speech,
  roleplay,
  talk,
}: {
  topic: Topic | null;
  loading: boolean;
  error: string | null;
  onNewTopic: () => void;
  speech: { status: SpeechStatus | "off"; muted: boolean };
  roleplay?: Roleplay;
  talk?: TalkBalanceState;
}) {
  const inRoleplay = Boolean(roleplay?.card);
  return (
    <aside className="flex h-full flex-col gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-neutral-100">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-indigo-300">
          <Sparkles className="size-4" /> AI Conversation Coach
        </div>
        <ListeningIndicator {...speech} />
      </div>

      <div className="flex-1">
        {roleplay?.card ? (
          <RoleplayCard card={roleplay.card} />
        ) : roleplay?.loading ? (
          <div className="mt-4 flex items-center gap-2 text-sm text-neutral-400">
            <Loader2 className="size-4 animate-spin" /> Setting up your role-play…
          </div>
        ) : (
        <>
        <div className="text-xs tracking-wide text-neutral-400 uppercase">Today&apos;s topic</div>
        {topic ? (
          <div className={cn("mt-2 transition-opacity", loading && "opacity-50")}>
            <h2 className="text-xl leading-snug font-semibold">{topic.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-neutral-300">{topic.description}</p>
            <ul className="mt-4 space-y-2.5">
              {topic.questions.map((q) => (
                <li key={q} className="rounded-lg bg-white/5 px-3 py-2 text-sm leading-relaxed text-neutral-200">
                  {q}
                </li>
              ))}
            </ul>
          </div>
        ) : loading ? (
          <div className="mt-4 flex items-center gap-2 text-sm text-neutral-400">
            <Loader2 className="size-4 animate-spin" /> Choosing a topic for your level…
          </div>
        ) : (
          <p className="mt-3 text-sm text-neutral-400">
            {error ?? "Introduce yourselves! A topic will appear here."}
          </p>
        )}
        {topic && error && <p className="mt-3 text-xs text-amber-300">{error}</p>}
        </>
        )}
        {roleplay?.error && <p className="mt-3 text-xs text-amber-300">{roleplay.error}</p>}
      </div>

      {talk && (
        <div>
          <div className="flex items-center justify-between text-[11px] text-neutral-400">
            <span>You {talk.balance.minePct}%</span>
            <span>Partner {talk.balance.partnerPct}%</span>
          </div>
          <div
            className="mt-1 flex h-1.5 overflow-hidden rounded-full bg-white/10"
            role="img"
            aria-label={`You spoke ${talk.balance.minePct} percent, your partner ${talk.balance.partnerPct} percent`}
          >
            <div className="bg-indigo-400 transition-all duration-700" style={{ width: `${talk.balance.minePct}%` }} />
            <div className="bg-emerald-400/70 transition-all duration-700" style={{ width: `${talk.balance.partnerPct}%` }} />
          </div>
          {talk.tip && (
            <button
              type="button"
              onClick={talk.dismissTip}
              className="mt-2 w-full rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-left text-xs leading-relaxed text-amber-100"
            >
              {talk.tip.text}
            </button>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <Button
          variant="secondary"
          className="flex-1 bg-white/10 text-white hover:bg-white/15"
          onClick={onNewTopic}
          disabled={loading || inRoleplay}
        >
          {loading ? <Loader2 className="animate-spin" /> : <RefreshCw />} New topic
        </Button>
        {roleplay && (
          <Button
            variant="secondary"
            className="flex-1 bg-white/10 text-white hover:bg-white/15"
            onClick={inRoleplay ? roleplay.end : roleplay.start}
            disabled={roleplay.loading}
          >
            {roleplay.loading ? <Loader2 className="animate-spin" /> : inRoleplay ? <CircleStop /> : <Drama />}
            {inRoleplay ? "End role-play" : "Role-play"}
          </Button>
        )}
      </div>
      <p className="text-[11px] leading-relaxed text-neutral-500">
        The coach won&apos;t interrupt you. Detailed corrections arrive in your report after the call.
      </p>
    </aside>
  );
}

function ListeningIndicator({ status, muted }: { status: SpeechStatus | "off"; muted: boolean }) {
  const map: Record<string, { text: string; tone: string; pulse?: boolean }> = {
    listening: { text: "Listening…", tone: "bg-emerald-400", pulse: true },
    idle: { text: "Starting…", tone: "bg-neutral-400" },
    off: { text: "Transcription off", tone: "bg-neutral-500" },
    denied: { text: "Mic blocked for transcription", tone: "bg-red-400" },
    unsupported: { text: "No speech-to-text in this browser", tone: "bg-amber-400" },
    error: { text: "Transcription error", tone: "bg-red-400" },
  };
  const s = muted && status === "listening" ? { text: "Paused (muted)", tone: "bg-neutral-400" } : map[status]!;
  return (
    <span className="flex items-center gap-1.5 text-[11px] text-neutral-400" title={status === "unsupported" ? "Use Chrome or Edge to get a feedback report." : undefined}>
      <span className="relative flex size-2">
        {"pulse" in s && s.pulse && <span className={cn("animate-pulse-ring absolute inline-flex size-full rounded-full", s.tone)} />}
        <span className={cn("relative inline-flex size-2 rounded-full", s.tone)} />
      </span>
      {s.text}
    </span>
  );
}
