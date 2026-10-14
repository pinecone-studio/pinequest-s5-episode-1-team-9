"use client";

import { DAILY_XP_CAP, type XpSessionDTO } from "@linguamatch/shared";
import { Flame, Loader2, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api";
import { XpBar } from "./xp-bar";

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

  if (data.xpGained === 0 && !settled) {
    return (
      <Card className="mt-8">
        <CardContent className="text-muted-foreground flex items-center gap-3 py-5 text-sm">
          <Loader2 className="size-4 animate-spin" /> Working out your XP…
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mt-8">
      <CardContent className="grid gap-4 py-6">
        {data.xpGained > 0 ? (
          <div className="flex items-baseline gap-2">
            <span className="text-primary text-3xl font-semibold tabular-nums">+{data.xpGained} XP</span>
            {data.streakBonus > 0 && (
              <span className="text-warning flex items-center gap-1 text-sm">
                <Flame className="size-4" /> includes +{data.streakBonus} streak bonus
              </span>
            )}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">Talk for 8 minutes or more to earn XP next time.</p>
        )}

        {data.leveledUp && (
          <div className="bg-accent text-accent-foreground rounded-xl px-4 py-3">
            <p className="flex items-center gap-2 font-semibold">
              <Sparkles className="size-4" /> Level up — you reached Level {data.level}
            </p>
            {data.newEmojis.length > 0 && (
              <p className="mt-1 text-sm">New reactions unlocked: {data.newEmojis.join(" ")}</p>
            )}
          </div>
        )}

        {data.earnedToday >= DAILY_XP_CAP && (
          <p className="text-muted-foreground text-xs">
            You&apos;ve hit today&apos;s {DAILY_XP_CAP} XP limit. It resets tomorrow.
          </p>
        )}

        <XpBar xp={data.xp} streakCount={data.streakCount} />
      </CardContent>
    </Card>
  );
}
