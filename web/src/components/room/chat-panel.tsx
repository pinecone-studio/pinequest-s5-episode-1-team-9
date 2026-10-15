"use client";

import { CHAT_MAX_CHARS } from "@linguamatch/shared";
import { Check, Loader2, Send, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { WordChips } from "@/components/room/word-chips";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Chat } from "@/hooks/useChat";
import { cn } from "@/lib/utils";

export function ChatPanel({ chat, myUserId }: { chat: Chat; myUserId: string }) {
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chat.messages.length]);

  const submit = () => {
    const text = draft.trim();
    if (!text) return;
    chat.send(text);
    setDraft("");
  };

  const applyFix = (value: string) => {
    setDraft(value);
    chat.dismissAssist();
    inputRef.current?.focus();
  };

  const assist = chat.assist;

  return (
    <section className="flex min-h-56 flex-col gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-neutral-100">
      <div ref={listRef} className="max-h-48 flex-1 overflow-y-auto pr-1">
        {chat.messages.length === 0 ? (
          <p className="text-xs text-neutral-400">
            Say hello. Messages here are only between you two and are not kept after the call.
          </p>
        ) : (
          <ul className="grid gap-1.5">
            {chat.messages.map((m) => {
              const mine = m.userId === myUserId;
              return (
                <li key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                  <span
                    className={cn(
                      "max-w-[85%] rounded-xl px-3 py-1.5 text-sm break-words",
                      mine ? "bg-indigo-500/25 text-neutral-50" : "bg-white/10 text-neutral-200",
                    )}
                  >
                    {m.text}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {assist && (
        <div className="rounded-lg border border-white/10 bg-white/5 p-2.5 text-xs">
          {assist.mode === "ok" ? (
            <p className="flex items-center gap-1.5 text-emerald-300">
              <Check className="size-3.5" /> Looks good!
            </p>
          ) : (
            <>
              <p className="text-neutral-100">{assist.mode === "translate" ? assist.english : assist.fixed}</p>
              {assist.reason && <p className="mt-1 text-neutral-400">{assist.reason}</p>}
              <div className="mt-2 flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-7 bg-white/10 text-xs text-white hover:bg-white/15"
                  onClick={() => applyFix((assist.mode === "translate" ? assist.english : assist.fixed) ?? draft)}
                >
                  Use fix
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={chat.dismissAssist}>
                  Keep mine
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {chat.aiAvailable && (
        <WordChips words={chat.suggestions} used={chat.usedWords} onPick={(w) => setDraft((d) => (d ? `${d} ${w}` : w))} />
      )}

      {chat.error && <p className="text-xs text-amber-300">{chat.error}</p>}

      <div className="flex items-center gap-2">
        <Input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, CHAT_MAX_CHARS))}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          maxLength={CHAT_MAX_CHARS}
          placeholder="Write a message…"
          aria-label="Chat message"
          className="border-white/15 bg-white/5 text-neutral-100 placeholder:text-neutral-500"
        />
        {chat.aiAvailable && (
          <Button
            size="icon"
            variant="secondary"
            onClick={() => chat.requestAssist(draft)}
            disabled={!draft.trim() || chat.assistLoading}
            aria-label="Check my message with AI"
            title="Check my message"
            className="shrink-0 bg-white/10 text-white hover:bg-white/15"
          >
            {chat.assistLoading ? <Loader2 className="animate-spin" /> : <Sparkles />}
          </Button>
        )}
        <Button size="icon" onClick={submit} disabled={!draft.trim()} aria-label="Send message" className="shrink-0">
          <Send />
        </Button>
      </div>
      <div className="flex justify-end text-[11px] text-neutral-500">
        {draft.length}/{CHAT_MAX_CHARS}
      </div>
    </section>
  );
}
