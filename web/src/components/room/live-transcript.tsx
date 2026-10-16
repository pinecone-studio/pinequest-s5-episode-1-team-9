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
    <section aria-label="Live Transcript" className="flex min-h-0 flex-col gap-3 rounded-[18px] border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display m-0 text-lg font-bold text-white">Live Transcript</h2>
        {status === "listening" && consent && (
          <span className="flex shrink-0 items-center gap-1.5 text-xs font-semibold text-[#9DE6C0]">
            <span aria-hidden="true" className="size-2 rounded-full bg-[#75D6A5]" />
            Live
          </span>
        )}
      </div>

      <div ref={listRef} aria-live="polite" className="max-h-64 min-h-24 space-y-3 overflow-y-auto overscroll-contain pr-1">
        {entries.length === 0 && !interim ? (
          <p className="text-dim-dark m-0 py-2 text-sm leading-[1.5]">Start speaking to see your conversation here.</p>
        ) : (
          <>
            {entries.map((entry) => {
              const mine = entry.speaker === "you";
              return (
                <div key={entry.id} className={`flex flex-col gap-1 ${mine ? "items-end" : "items-start"}`}>
                  <span className="text-dim-dark text-xs">{mine ? "You" : partnerName}</span>
                  <p
                    className={`m-0 max-w-[92%] rounded-[14px] px-3 py-2 text-sm leading-[1.45] break-words ${
                      mine ? "bg-brand-you text-white" : "bg-white/10 text-[#E4E5F4]"
                    }`}
                  >
                    {entry.text}
                  </p>
                </div>
              );
            })}
            {interim && (
              <div className="flex flex-col items-end gap-1">
                <span className="text-dim-dark text-xs">You</span>
                <p className="bg-brand-you/65 m-0 max-w-[92%] rounded-[14px] px-3 py-2 text-sm leading-[1.45] break-words text-white">
                  {interim}
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {hint && <p className="text-dim-dark m-0 text-xs leading-[1.45]">{hint}</p>}
    </section>
  );
}