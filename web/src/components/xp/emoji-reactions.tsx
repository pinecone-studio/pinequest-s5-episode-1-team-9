"use client";

import { EMOJI_UNLOCKS, unlockLevelOf } from "@linguamatch/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { AppSocket } from "@/lib/socket";
import { cn } from "@/lib/utils";

const COOLDOWN_MS = 2000;
const HINT_MS = 1800;

export function EmojiReactions({
  socket,
  roomId,
  myUserId,
}: {
  socket: AppSocket | null;
  roomId: string;
  myUserId: string;
}) {
  const [level, setLevel] = useState(1);
  const [coolingDown, setCoolingDown] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const layer = useRef<HTMLDivElement>(null);

  const loadLevel = useCallback(() => {
    api
      .xpMe()
      .then((xp) => setLevel(xp.level))
      .catch(() => {});
  }, []);

  useEffect(loadLevel, [loadLevel]);

  useEffect(() => {
    if (!socket) return;
    const onAwarded = () => loadLevel();
    socket.on("xp:awarded", onAwarded);
    return () => {
      socket.off("xp:awarded", onAwarded);
    };
  }, [socket, loadLevel]);

  const float = useCallback((emoji: string, mine: boolean) => {
    const host = layer.current;
    if (!host) return;
    const el = document.createElement("span");
    el.textContent = emoji;
    el.style.cssText = `position:absolute;bottom:72px;${mine ? "right" : "left"}:${12 + Math.random() * 25}%;font-size:40px;pointer-events:none;`;
    host.appendChild(el);

    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setTimeout(() => el.remove(), 1200);
      return;
    }
    const anim = el.animate(
      [
        { transform: "translateY(0) scale(0.6)", opacity: 0 },
        { transform: "translateY(-40px) scale(1.1)", opacity: 1, offset: 0.15 },
        { transform: "translateY(-260px) scale(1)", opacity: 0 },
      ],
      { duration: 2600, easing: "ease-out" },
    );
    anim.onfinish = () => el.remove();
  }, []);

  useEffect(() => {
    if (!socket) return;
    const onReaction = (r: { emoji: string; fromUserId: string; at: number }) =>
      float(r.emoji, r.fromUserId === myUserId);
    socket.on("emoji:reaction", onReaction);
    return () => {
      socket.off("emoji:reaction", onReaction);
    };
  }, [socket, myUserId, float]);

  const showHint = (message: string) => {
    setHint(message);
    setTimeout(() => setHint(null), HINT_MS);
  };

  const send = (emoji: string) => {
    const needed = unlockLevelOf(emoji);
    if (needed === null || needed > level) {
      showHint(`Unlocks at Level ${needed ?? "?"}`);
      return;
    }
    if (coolingDown || !socket) return;
    setCoolingDown(true);
    setTimeout(() => setCoolingDown(false), COOLDOWN_MS);
    socket.emit("emoji:send", { roomId, emoji }, (result) => {
      if (result.ok) return;
      if (result.error === "locked") showHint("That reaction is still locked");
      else if (result.error === "rate_limited") showHint("Slow down a moment");
    });
  };

  return (
    <>
      <div ref={layer} className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden />
      <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2">
        {hint && (
          <div className="bg-foreground text-background rounded-full px-3 py-1 text-xs" role="status">
            {hint}
          </div>
        )}
        <div className="flex max-w-[92vw] gap-1 overflow-x-auto rounded-full bg-black/50 px-2 py-1 backdrop-blur">
          {Object.entries(EMOJI_UNLOCKS).flatMap(([lvl, list]) =>
            list.map((emoji) => {
              const locked = Number(lvl) > level;
              return (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => send(emoji)}
                  disabled={!locked && coolingDown}
                  aria-label={locked ? `${emoji}, unlocks at level ${lvl}` : emoji}
                  title={locked ? `Unlocks at Level ${lvl}` : emoji}
                  className={cn(
                    "relative shrink-0 rounded-full p-1 text-2xl transition",
                    locked ? "opacity-30 grayscale" : "hover:scale-125",
                    !locked && coolingDown && "opacity-60",
                  )}
                >
                  {emoji}
                  {locked && <span className="absolute -top-0.5 -right-0.5 text-[10px]">🔒</span>}
                </button>
              );
            }),
          )}
        </div>
      </div>
    </>
  );
}
