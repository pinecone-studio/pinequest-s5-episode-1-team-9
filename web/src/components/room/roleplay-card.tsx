"use client";

import type { RoleplayCard as Card } from "@linguamatch/shared";
import { EyeOff, Users } from "lucide-react";

export function RoleplayCard({ card }: { card: Card }) {
  return (
    <div className="mt-2">
      <div className="text-xs tracking-wide text-neutral-400 uppercase">{card.scenarioTitle}</div>
      <h2 className="mt-1 text-xl leading-snug font-semibold">{card.roleName}</h2>
      <p className="mt-2 text-sm leading-relaxed text-neutral-300">{card.situation}</p>

      <div className="mt-4 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2">
        <div className="flex items-center gap-1.5 text-[11px] font-medium tracking-wide text-amber-300 uppercase">
          <EyeOff className="size-3.5" /> Your secret goal
        </div>
        <p className="mt-1 text-sm leading-relaxed text-amber-100">{card.secretGoal}</p>
      </div>

      <p className="mt-4 flex items-center gap-1.5 text-xs text-neutral-400">
        <Users className="size-3.5" /> Your partner is the {card.partnerRoleName}. They have their own secret goal.
      </p>
    </div>
  );
}
