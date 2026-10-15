"use client";

import { CHAT_MAX_CHARS } from "@linguamatch/shared";
import { Check, Loader2, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
  const suggestion = assist && assist.mode !== "ok" ? (assist.mode === "translate" ? assist.english : assist.fixed) : null;

  return (
    <section aria-label="Chat" className="flex flex-col gap-3.5 border-t border-white/10 pt-3.5">
      <div ref={listRef} className="max-h-52 overflow-y-auto pr-1">
        {chat.messages.length === 0 ? (
          <p className="text-dim-dark m-0 text-[15px] leading-[1.5]">
            Say hello. Messages stay between you two and aren&apos;t kept after the call.
          </p>
        ) : (
          <div className="flex flex-col gap-2.5 text-base">
            {chat.messages.map((m) => {
              const mine = m.userId === myUserId;
              return (
                <p
                  key={m.id}
                  className={cn(
                    "m-0 max-w-[80%] px-3.5 py-2.5 break-words",
                    mine
                      ? "bg-brand-you self-end rounded-[16px_6px_16px_16px] text-white"
                      : "bg-brand-partner text-ink self-start rounded-[6px_16px_16px_16px]",
                  )}
                >
                  {m.text}
                </p>
              );
            })}
          </div>
        )}
      </div>

      {chat.aiAvailable && chat.suggestions.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-dim-dark text-sm">Try</span>
          {chat.suggestions.map((w) => {
            const used = chat.usedWords.includes(w.word);
            return used ? (
              <span
                key={w.word}
                className="bg-fix inline-flex min-h-10 items-center gap-1.5 rounded-full px-3.5 text-[15px] font-bold text-white"
              >
                <Check aria-hidden="true" className="size-3.5" strokeWidth={2.6} />
                {w.word}, +2 XP
              </span>
            ) : (
              <button
                key={w.word}
                type="button"
                onClick={() => setDraft((d) => (d ? `${d} ${w.word}` : w.word))}
                title={`${w.meaning}${w.example ? ` — ${w.example}` : ""}`}
                className="min-h-10 rounded-full border border-white/18 bg-transparent px-3.5 text-[15px] font-semibold text-white"
              >
                {w.word}
              </button>
            );
          })}
        </div>
      )}

      {assist && (
        <div className="flex flex-col gap-2 rounded-[14px] border border-[rgba(127,224,176,0.4)] bg-[rgba(35,168,107,0.14)] px-3.5 py-3">
          {assist.mode === "ok" ? (
            <div className="text-fix-glow flex items-center gap-2 text-base">
              <Check aria-hidden="true" className="size-4.5" strokeWidth={2.4} />
              Looks good!
            </div>
          ) : (
            <>
              <div className="text-base leading-[1.5] text-white">
                <strong className="text-fix-glow font-bold">{suggestion}</strong>
              </div>
              {assist.reason && <div className="text-sm text-[#B9E9D0]">{assist.reason}</div>}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => applyFix(suggestion ?? draft)}
                  className="bg-fix min-h-10 rounded-[10px] border-0 px-3.5 text-[15px] font-bold text-white"
                >
                  Use fix
                </button>
                <button
                  type="button"
                  onClick={chat.dismissAssist}
                  className="min-h-10 rounded-[10px] border border-white/20 bg-transparent px-3.5 text-[15px] font-semibold text-white"
                >
                  Keep mine
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {chat.error && <p className="text-brand-partner-text m-0 text-sm">{chat.error}</p>}

      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, CHAT_MAX_CHARS))}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          maxLength={CHAT_MAX_CHARS}
          placeholder="Type a message, or write in Mongolian and press Fix"
          aria-label="Message"
          className="bg-stage min-h-12 min-w-0 flex-1 rounded-xl border border-white/18 px-3.5 text-base text-white placeholder:text-[#6F74A6]"
        />
        {chat.aiAvailable && (
          <button
            type="button"
            onClick={() => chat.requestAssist(draft)}
            disabled={!draft.trim() || chat.assistLoading}
            aria-label="Check with AI"
            className="text-fix-glow inline-flex min-h-12 items-center gap-1.5 rounded-xl border border-[#7FE0B0] bg-transparent px-3.5 text-[15px] font-bold disabled:opacity-50"
          >
            {chat.assistLoading ? (
              <Loader2 aria-hidden="true" className="size-4.5 animate-spin" />
            ) : (
              <Sparkles aria-hidden="true" className="size-4.5" />
            )}
            Fix
          </button>
        )}
        <button
          type="button"
          onClick={submit}
          disabled={!draft.trim()}
          className="bg-brand-you min-h-12 rounded-xl border-0 px-4.5 text-[15px] font-bold text-white disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </section>
  );
}
