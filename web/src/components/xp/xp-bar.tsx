"use client";

import { levelProgress } from "@linguamatch/shared";
import { Flame } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export function XpBar({
  xp,
  streakCount,
  compact = false,
  className,
}: {
  xp: number;
  streakCount?: number;
  compact?: boolean;
  className?: string;
}) {
  const p = levelProgress(xp);
  const pct = Math.round(p.progress * 100);

  return (
    <div className={cn(compact ? "w-40" : "w-full max-w-md", className)}>
      <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
        <span className="font-semibold">Level {p.level}</span>
        <span className="text-muted-foreground flex items-center gap-2 tabular-nums">
          {!compact && (
            <span>
              {xp.toLocaleString()} / {p.nextGoal.toLocaleString()} XP
            </span>
          )}
          {streakCount ? (
            <span className="text-warning flex items-center gap-1" title={`${streakCount}-day streak`}>
              <Flame className="size-3.5" /> {streakCount} {streakCount === 1 ? "day" : "days"}
            </span>
          ) : null}
        </span>
      </div>
      <Progress value={pct} aria-label={`Level ${p.level}, ${pct}% to level ${p.level + 1}`} />
      {!compact && (
        <p className="text-muted-foreground mt-1.5 text-xs tabular-nums">
          {p.xpToNext.toLocaleString()} XP to Level {p.level + 1}
        </p>
      )}
    </div>
  );
}
