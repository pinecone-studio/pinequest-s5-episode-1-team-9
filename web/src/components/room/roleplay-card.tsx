"use client";

import type { RoleplayCard as Card } from "@linguamatch/shared";

export function RoleplayCard({ card }: { card: Card }) {
  return (
    <div className="flex flex-col gap-4">
      <span className="text-dim-dark text-sm">Your role card. Only you can see it.</span>
      <div className="border-t-brand-you text-ink flex flex-col gap-3 rounded-[18px] border-t-8 bg-white p-5">
        <h2 className="font-display m-0 text-[22px] leading-[1.25] font-bold">You are the {card.roleName}</h2>
        <p className="text-dim m-0 leading-[1.5]">{card.situation}</p>
        <div className="bg-brand-partner-tint flex flex-col gap-1 rounded-xl px-3.5 py-3">
          <span className="font-bold text-[#8A5300]">Your secret goal</span>
          <span className="leading-[1.45]">{card.secretGoal}</span>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="font-semibold">Your partner</span>
          <span className="text-dim leading-[1.45]">
            is the {card.partnerRoleName}, with their own secret goal.
          </span>
        </div>
      </div>
    </div>
  );
}
