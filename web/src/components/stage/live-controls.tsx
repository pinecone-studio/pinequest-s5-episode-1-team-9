"use client";

import type { CefrLevel } from "@linguamatch/shared";
import { Flag, SkipForward, Square } from "lucide-react";
import { LevelControl } from "@/components/stage/control-row";

export function LiveControls({
  language,
  level,
  onLevel,
  onNext,
  onStop,
  onReport,
}: {
  language: string | null;
  level: CefrLevel | null;
  onLevel: (level: CefrLevel) => void;
  onNext: () => void;
  onStop: () => void;
  onReport: () => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2.5">
        <button
          type="button"
          onClick={onNext}
          className="bg-brand-partner text-ink flex min-h-16 items-center justify-center gap-2.5 rounded-[16px] border-0 text-[17px] font-bold shadow-sm transition hover:brightness-105 hover:shadow-md active:scale-[0.99]"
        >
          <SkipForward aria-hidden="true" className="size-5.5" />
          Next partner
        </button>

        <button
          type="button"
          onClick={onStop}
          className="bg-card/70 text-foreground flex min-h-16 items-center justify-center gap-2.5 rounded-[16px] border border-border text-[17px] font-semibold transition-colors hover:bg-accent"
        >
          <Square aria-hidden="true" className="size-5 fill-current" />
          Stop
        </button>

        <button
          type="button"
          onClick={onReport}
          className="text-destructive flex min-h-16 items-center justify-center gap-2.5 rounded-[16px] border border-destructive/35 bg-destructive/5 text-[16px] font-semibold transition-colors hover:bg-destructive/10"
        >
          <Flag aria-hidden="true" className="size-5" />
          Report
        </button>

        <LevelControl language={language} level={level} onLevel={onLevel} />
      </div>
      <p className="text-dim-darker m-0 text-right text-xs">Applies to your next partner</p>
    </div>
  );
}
