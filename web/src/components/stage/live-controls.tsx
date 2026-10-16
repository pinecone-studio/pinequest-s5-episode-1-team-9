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
          className="text-ink flex min-h-16 items-center justify-center gap-2.5 rounded-2xl border-0 bg-white text-[19px] font-extrabold"
        >
          <SkipForward aria-hidden="true" className="size-5.5" />
          Next partner
        </button>

        <button
          type="button"
          onClick={onStop}
          className="flex min-h-16 items-center justify-center gap-2.5 rounded-2xl border border-white/22 bg-transparent text-[19px] font-extrabold text-white"
        >
          <Square aria-hidden="true" className="size-5 fill-current" />
          Stop
        </button>

        <button
          type="button"
          onClick={onReport}
          className="flex min-h-16 items-center justify-center gap-2.5 rounded-2xl border border-[rgba(255,120,120,0.5)] bg-transparent text-[17px] font-semibold text-[#FFB4B4]"
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
