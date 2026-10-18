"use client";

import { useEffect, useRef } from "react";
import type { SpeechStatus } from "@/hooks/useSpeechRecognition";

export interface LiveTranscriptEntry {
  id: string;
  speaker: "you" | "partner";
  text: string;
}

export function LiveTranscript({
  entries,
  interim,
  status,
  consent,
  hasAudioTrack,
  micOn,
  partnerName,
}: {
  entries: LiveTranscriptEntry[];
  interim: string;
  status: SpeechStatus;
  consent: boolean;
  hasAudioTrack: boolean;
  micOn: boolean;
  partnerName: string;
}) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    list.scrollTo({ top: list.scrollHeight, behavior: reduceMotion ? "instant" : "smooth" });
  }, [entries.length, interim]);

  const hint = !consent
    ? "Enable transcription in Settings to caption your speech."
    : status === "unsupported"
      ? "Speech recognition is not supported in this browser."
      : status === "denied"
        ? "Speech recognition permission is blocked. Allow microphone access in your browser."
        : !hasAudioTrack
          ? "Your microphone is unavailable, so speech cannot be transcribed."
          : !micOn
            ? "Unmute your microphone to resume transcription."
            : status === "error"
              ? "Speech recognition was interrupted. Try toggling your microphone to restart it."
              : null;

  return (
    <section
      aria-label="Live Transcript"
      className="bg-stage flex min-h-0 flex-col gap-3.5 rounded-[22px] border border-white/10 p-3.5"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display m-0 text-[22px] leading-[1.25] font-bold text-white">Live transcript</h2>
        {status === "listening" && consent && (
          <span className="text-fix-glow flex shrink-0 items-center gap-1.5 rounded-full bg-[rgba(35,168,107,0.18)] px-2.5 py-1 text-xs font-semibold">
            <span aria-hidden="true" className="bg-fix-glow size-2 rounded-full" />
            Live
          </span>
        )}
      </div>

      <div
        ref={listRef}
        aria-live="polite"
        className="no-scrollbar max-h-64 min-h-24 space-y-3 overflow-y-auto overscroll-contain pr-1"
      >
        {entries.length === 0 && !interim ? (
          <p className="text-dim-dark m-0 py-2 text-sm leading-[1.5]">
            Captions will appear here when you start talking.
          </p>
        ) : (
          <>
            {entries.map((entry) => {
              const mine = entry.speaker === "you";
              return (
                <div key={entry.id} className={`flex flex-col gap-1 ${mine ? "items-end" : "items-start"}`}>
                  <span className="text-xs font-semibold text-white">{mine ? "You" : partnerName}</span>
                  <p
                    className={`m-0 max-w-[92%] rounded-[14px] px-3 py-2 text-sm leading-[1.45] break-words ${
                      mine
                        ? "bg-brand-you rounded-[16px_6px_16px_16px] text-white"
                        : "bg-brand-partner text-ink rounded-[6px_16px_16px_16px]"
                    }`}
                  >
                    {entry.text}
                  </p>
                </div>
              );
            })}
            {interim && (
              <div className="flex flex-col items-end gap-1">
                <span className="text-xs font-semibold text-white">You</span>
                <p className="bg-brand-you m-0 max-w-[92%] rounded-[16px_6px_16px_16px] px-3 py-2 text-sm leading-[1.45] break-words text-white italic">
                  {interim}
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {hint && <p className="text-dim-dark m-0 border-t border-white/10 pt-3 text-xs leading-[1.45]">{hint}</p>}
    </section>
  );
}
