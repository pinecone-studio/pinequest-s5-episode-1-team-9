"use client";

import type { Topic } from "@linguamatch/shared";
import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { RoleplayCard } from "@/components/room/roleplay-card";
import type { Roleplay } from "@/hooks/useRoleplay";
import type { TalkBalanceState } from "@/hooks/useTalkBalance";

export function CoachPanel({
  topic,
  loading,
  error,
  onNewTopic,
  roleplay,
  talk,
  partnerName,
  transcript,
}: {
  topic: Topic | null;
  loading: boolean;
  error: string | null;
  onNewTopic: () => void;
  roleplay: Roleplay;
  talk: TalkBalanceState;
  partnerName: string;
  transcript: ReactNode;
}) {
  const card = roleplay.card;

  return (
    <aside
      aria-label="Coach"
      className="bg-panel flex min-w-0 max-w-full flex-1 basis-80 flex-col gap-5 rounded-[22px] p-5.5"
    >
      {card ? (
        <RoleplayCard card={card} />
      ) : roleplay.loading ? (
        <div className="text-dim-dark flex items-center gap-2 text-[15px]">
          <Loader2 aria-hidden="true" className="size-4 animate-spin" /> Setting up your role-play…
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          <span className="text-dim-dark text-sm">Topic</span>
          {topic ? (
            <>
              <h2 className="font-display m-0 text-[22px] leading-[1.25] font-bold text-white">{topic.title}</h2>
              <ul className="m-0 flex list-disc flex-col gap-2 pl-4.5 leading-[1.45] text-[#D7DAF2]">
                {topic.questions.map((q) => (
                  <li key={q}>{q}</li>
                ))}
              </ul>
            </>
          ) : loading ? (
            <div className="text-dim-dark flex items-center gap-2 text-[15px]">
              <Loader2 aria-hidden="true" className="size-4 animate-spin" /> Choosing a topic for your level…
            </div>
          ) : (
            <p className="text-dim-dark m-0 text-[15px]">
              {error ?? "Introduce yourselves! A topic will appear here."}
            </p>
          )}
          {topic && error && <p className="text-brand-partner-text m-0 text-sm">{error}</p>}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {card ? (
          <button
            type="button"
            onClick={roleplay.end}
            className="min-h-11 flex-1 rounded-xl border border-white/20 bg-transparent px-3.5 text-[15px] font-semibold text-white"
          >
            End role-play
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={onNewTopic}
              disabled={loading}
              className="min-h-11 rounded-xl border border-white/20 bg-transparent px-3.5 text-[15px] font-semibold text-white disabled:opacity-50"
            >
              {loading ? "Choosing…" : "New topic"}
            </button>
            <button
              type="button"
              onClick={roleplay.start}
              disabled={roleplay.loading}
              className="bg-brand-partner text-ink min-h-11 rounded-xl border-0 px-3.5 text-[15px] font-bold disabled:opacity-60"
            >
              Start role-play
            </button>
          </>
        )}
      </div>
      {roleplay.error && <p className="text-brand-partner-text m-0 text-sm">{roleplay.error}</p>}

      {transcript}

      <div className="flex flex-col gap-2">
        <span className="text-dim-dark text-sm">Who&apos;s talking</span>
        <div aria-hidden="true" className="bg-brand-partner flex h-3 overflow-hidden rounded-md">
          <span
            className="bg-brand-you border-panel block h-full border-r-[3px] transition-all duration-700"
            style={{ width: `${talk.balance.minePct}%` }}
          />
        </div>
        <div className="flex justify-between text-sm text-[#D7DAF2]">
          <span>You {talk.balance.minePct}%</span>
          <span>
            {partnerName} {talk.balance.partnerPct}%
          </span>
        </div>
        {talk.tip && (
          <button
            type="button"
            onClick={talk.dismissTip}
            className="text-brand-partner-text rounded-xl bg-[rgba(240,165,50,0.14)] px-3.5 py-3 text-left text-[15px] leading-[1.45]"
          >
            {talk.tip.text}
          </button>
        )}
      </div>
    </aside>
  );
}
