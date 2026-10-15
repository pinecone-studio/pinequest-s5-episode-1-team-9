"use client";

import { Captions, CaptionsOff } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { SpeechStatus } from "@/hooks/useSpeechRecognition";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "linguamatch:captions";
const FADE = ["opacity-45", "opacity-70", "opacity-100"];

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
  const lines = speech.finals.slice(-FADE.length);
  const empty = lines.length === 0 && !speech.interim;

  return (
    <div className="pointer-events-none absolute right-3 bottom-3 flex max-w-[72%] flex-col items-end gap-2">
      {visible && (hint || !empty) && (
        <div className="flex flex-col gap-1 rounded-[14px] bg-[rgba(20,18,58,0.86)] px-3.5 py-3 text-[15px] leading-[1.4]">
          {hint ? (
            <span className="text-dim-dark">
              {hint.text}
              {hint.href && (
                <>
                  {" "}
                  <Link href={hint.href} className="text-brand-partner pointer-events-auto underline">
                    Settings
                  </Link>
                </>
              )}
            </span>
          ) : (
            <>
              {lines.map((line, i) => (
                <span
                  key={`${lines.length}-${i}-${line}`}
                  className={cn("text-white transition-opacity duration-700", FADE[FADE.length - lines.length + i])}
                >
                  {line}
                </span>
              ))}
              {speech.interim && <span className="text-dim-dark">{speech.interim}</span>}
            </>
          )}
        </div>
      )}
      <button
        type="button"
        onClick={toggle}
        aria-label={visible ? "Hide live captions" : "Show live captions"}
        aria-pressed={visible}
        className="pointer-events-auto grid size-11 place-items-center rounded-full bg-[rgba(20,18,58,0.75)] text-white"
      >
        {visible ? <Captions className="size-5" /> : <CaptionsOff className="size-5" />}
      </button>
    </div>
  );
}
