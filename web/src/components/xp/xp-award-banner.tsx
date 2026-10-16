"use client";

import { DAILY_XP_CAP, type XpSessionDTO } from "@linguamatch/shared";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

const POLL_TRIES = 4;
const POLL_INTERVAL_MS = 1500;

export function XpAwardBanner({ sessionId }: { sessionId: string }) {
  const [data, setData] = useState<XpSessionDTO | null>(null);
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let tries = 0;

    const load = async () => {
      try {
        const result = await api.xpSession(sessionId);
        if (cancelled) return;
        setData(result);
        if (result.xpGained > 0 || ++tries >= POLL_TRIES) setSettled(true);
        else timer = setTimeout(load, POLL_INTERVAL_MS);
      } catch {
        if (!cancelled) setSettled(true);
      }
    };
    void load();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [sessionId]);

  if (!data) return null;

  const breakdown = [
    data.xpGained - data.streakBonus > 0 ? `${data.xpGained - data.streakBonus} for the call` : null,
    data.streakBonus > 0 ? `${data.streakBonus} for your ${data.streakCount}-day streak` : null,
  ]
    .filter(Boolean)
    .join(", ");

  const pct = Math.round(data.progress * 100);

  return (
    <section
      aria-label="XP earned"
      className="bg-ink flex flex-wrap items-center gap-7 rounded-3xl p-7 text-white"
    >
      <div className="flex shrink flex-col gap-1">
        <span className="font-display text-fix-glow text-5xl leading-none font-bold">
          {data.xpGained > 0 ? `+${data.xpGained} XP` : settled ? "No XP" : "…"}
        </span>
        <span className="text-dim-dark">
          {data.xpGained > 0
            ? breakdown
            : settled
              ? "Talk for 8 minutes or more to earn XP."
              : "Working out your XP…"}
        </span>
      </div>

      <div className="flex min-w-0 flex-1 basis-80 flex-col gap-2">
        <div className="flex justify-between font-semibold">
          <span>Level {data.level}</span>
          <span className="text-dim-dark font-medium tabular-nums">
            {data.xp.toLocaleString()} of {data.nextGoal.toLocaleString()} XP
          </span>
        </div>
        <div aria-hidden="true" className="h-3 overflow-hidden rounded-md bg-white/12">
          <span className="bg-fix block h-full transition-all duration-700" style={{ width: `${pct}%` }} />
        </div>
        <span className="text-dim-dark text-[15px] tabular-nums">
          {data.xpToNext.toLocaleString()} XP to Level {data.level + 1}
          {data.earnedToday >= DAILY_XP_CAP ? ` · today's ${DAILY_XP_CAP} XP limit reached` : ""}
        </span>
      </div>
    </section>
  );
}
