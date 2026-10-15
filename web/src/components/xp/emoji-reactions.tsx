"use client";

import { EMOJI_UNLOCKS, unlockLevelOf } from "@linguamatch/shared";
import { Lock } from "lucide-react";
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
  layer,
}: {
  socket: AppSocket | null;
  roomId: string;
  myUserId: string;
  layer: React.RefObject<HTMLDivElement | null>;
}) {
  const [level, setLevel] = useState(1);
  const [coolingDown, setCoolingDown] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

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

  const float = useCallback(
    (emoji: string, mine: boolean) => {
      const host = layer.current;
      if (!host) return;
      const el = document.createElement("span");
      el.textContent = emoji;
      el.style.cssText = `position:absolute;bottom:64px;${mine ? "right" : "left"}:${12 + Math.random() * 25}%;font-size:40px;pointer-events:none;`;
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
    },
    [layer],
  );

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
    <div className="flex flex-col items-center gap-2 self-center">
      {hint && (
        <span role="status" className="bg-ink rounded-full px-3 py-1.5 text-xs text-white">
          {hint}
        </span>
      )}
      <div
        role="group"
        aria-label="Reactions"
        className="no-scrollbar flex max-w-full flex-wrap justify-center gap-0.5 overflow-x-auto rounded-2xl bg-white/8 px-2 py-1.5"
      >
        {Object.entries(EMOJI_UNLOCKS).flatMap(([lvl, list]) =>
          list.map((emoji) => {
            const locked = Number(lvl) > level;
            return (
              <button
                key={emoji}
                type="button"
                onClick={() => send(emoji)}
                disabled={!locked && coolingDown}
                aria-label={locked ? `${emoji}, unlocks at level ${lvl}` : `Send ${emoji}`}
                title={locked ? `Unlocks at Level ${lvl}` : emoji}
                className={cn(
                  "relative grid size-10 shrink-0 place-items-center rounded-full border-0 bg-transparent text-[28px] leading-none transition",
                  locked ? "cursor-not-allowed text-[#6E72A3] opacity-45" : "hover:bg-white/10",
                  !locked && coolingDown && "opacity-60",
                )}
              >
                {emoji}
                {locked && (
                  <Lock aria-hidden="true" className="absolute right-0 bottom-0 size-2.5 text-[#6E72A3]" />
                )}
              </button>
            );
          }),
        )}
      </div>
    </div>
  );
}
