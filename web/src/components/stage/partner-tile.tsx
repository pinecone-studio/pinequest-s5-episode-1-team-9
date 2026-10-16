"use client";

import { levelWithArticle, type CefrLevel } from "@linguamatch/shared";
import { LogoMark } from "@/components/brand/logo-mark";
import { formatClock } from "@/lib/utils";

export function PartnerIdleTile() {
  return (
    <div className="bg-stage flex aspect-4/3 flex-col items-center justify-center gap-4.5 rounded-[22px] border-[3px] border-dashed border-[rgba(240,165,50,0.6)] p-6 text-center">
      <LogoMark scale={2} waiting />
      <span className="font-display max-w-[15em] text-[22px] leading-[1.3] font-bold text-white">
        Your partner appears here
      </span>
      <span className="text-dim-dark max-w-[24em] leading-[1.5]">
        Press Start and we&apos;ll match you with an English learner at your level.
      </span>
    </div>
  );
}

export function PartnerSearchingTile({
  language,
  level,
  elapsed,
}: {
  language: string | null;
  level: CefrLevel;
  elapsed: number;
}) {
  return (
    <div
      role="status"
      className="bg-stage border-brand-partner relative flex aspect-4/3 flex-col items-center justify-center gap-4 overflow-hidden rounded-[22px] border-[3px] border-dashed p-6 text-center"
    >
      <div aria-hidden="true" className="relative grid size-24 place-items-center">
        <span className="lm-ring border-brand-partner absolute inset-0 rounded-full border-[3px]" />
        <span className="lm-ring lm-ring-2 border-brand-you absolute inset-0 rounded-full border-[3px]" />
        <LogoMark scale={1.35} />
      </div>
      <span className="font-display text-[22px] font-bold text-white">
        Finding {levelWithArticle(language, level)} partner
      </span>
      <span className="text-dim-dark leading-[1.5]">
        Now also looking one level either side, so you don&apos;t wait long.
      </span>
      <span className="font-semibold tabular-nums text-white">{formatClock(elapsed)}</span>
    </div>
  );
}
