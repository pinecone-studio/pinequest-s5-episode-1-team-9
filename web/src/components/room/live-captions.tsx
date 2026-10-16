"use client";

import { Captions, CaptionsOff } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { SpeechStatus } from "@/hooks/useSpeechRecognition";

const STORAGE_KEY = "linguamatch:captions";

function readPreference(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== "hidden";
  } catch {
    return true;
  }
}

function writePreference(visible: boolean) {
  try {
    window.localStorage.setItem(STORAGE_KEY, visible ? "shown" : "hidden");
  } catch {
    return;
  }
}

function hintFor(status: SpeechStatus, consent: boolean): { text: string; href?: string } | null {
  if (!consent) return { text: "Captions are off — enable transcription in settings", href: "/settings" };
  if (status === "unsupported") return { text: "Live captions work in Chrome" };
  if (status === "denied") return { text: "Microphone access is blocked — allow it in the browser to see captions" };
  if (status === "error") return { text: "Captions stopped — turn your mic off and on to restart" };
  return null;
}

export function LiveCaptions({
  speech,
  consent,
}: {
  speech: { status: SpeechStatus; interim: string; finals: string[] };
  consent: boolean;
}) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    setVisible(readPreference());
  }, []);

  const toggle = () => {
    const next = !visible;
    setVisible(next);
    writePreference(next);
  };

  const hint = hintFor(speech.status, consent);
  const lastFinal = speech.finals[speech.finals.length - 1] ?? "";

  return (
    <div className="flex justify-end">
      <div className="bg-stage border-brand-you/40 flex w-full items-start gap-2 rounded-[14px] border px-3 py-2 sm:w-[calc(50%-7px)]">
        <div aria-live="polite" className="flex min-h-10 min-w-0 flex-1 flex-col justify-center gap-0.5">
          {!visible ? (
            <span className="text-dim-darker text-xs">Captions hidden</span>
          ) : hint ? (
            <span className="text-dim-dark text-xs leading-[1.4]">
              {hint.text}
              {hint.href && (
                <>
                  {" "}
                  <Link href={hint.href} className="text-brand-partner underline">
                    Settings
                  </Link>
                </>
              )}
            </span>
          ) : !lastFinal && !speech.interim ? (
            <span className="text-dim-darker text-xs">Your words appear here as you speak.</span>
          ) : (
            <>
              {lastFinal && (
                <span className="truncate text-xs leading-[1.4] text-white/70 transition-opacity duration-700">
                  {lastFinal}
                </span>
              )}
              {speech.interim && (
                <span className="truncate text-[13px] leading-[1.4] text-white">{speech.interim}</span>
              )}
            </>
          )}
        </div>
        <button
          type="button"
          onClick={toggle}
          aria-label={visible ? "Hide live captions" : "Show live captions"}
          aria-pressed={visible}
          className="grid size-10 shrink-0 place-items-center rounded-full bg-white/8 text-white"
        >
          {visible ? <Captions className="size-4.5" /> : <CaptionsOff className="size-4.5" />}
        </button>
      </div>
    </div>
  );
}
