"use client";

import type { SuggestedWord } from "@linguamatch/shared";
import { Check } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export function WordChips({
  words,
  used,
  onPick,
}: {
  words: SuggestedWord[];
  used: string[];
  onPick: (word: string) => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  if (words.length === 0) return null;

  return (
    <div className="relative">
      <div className="flex flex-wrap gap-1.5">
        {words.map((w) => {
          const isUsed = used.includes(w.word);
          return (
            <button
              key={w.word}
              type="button"
              onClick={() => onPick(w.word)}
              onMouseEnter={() => setOpen(w.word)}
              onMouseLeave={() => setOpen(null)}
              onFocus={() => setOpen(w.word)}
              onBlur={() => setOpen(null)}
              onContextMenu={(e) => {
                e.preventDefault();
                setOpen((c) => (c === w.word ? null : w.word));
              }}
              aria-describedby={open === w.word ? `word-${w.word}` : undefined}
              className={cn(
                "flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition",
                isUsed
                  ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200"
                  : "border-white/15 bg-white/5 text-neutral-200 hover:bg-white/10",
              )}
            >
              {isUsed && <Check className="size-3" />}
              {w.word}
            </button>
          );
        })}
      </div>

      {words.map(
        (w) =>
          open === w.word && (
            <div
              key={`tip-${w.word}`}
              id={`word-${w.word}`}
              role="tooltip"
              className="absolute bottom-full left-0 z-20 mb-2 w-64 rounded-lg border border-white/10 bg-neutral-900/95 p-3 text-xs shadow-xl backdrop-blur"
            >
              <div className="font-medium text-neutral-100">{w.word}</div>
              <p className="mt-1 text-neutral-300">{w.meaning}</p>
              {w.example && <p className="mt-2 text-neutral-400 italic">{w.example}</p>}
            </div>
          ),
      )}
    </div>
  );
}
