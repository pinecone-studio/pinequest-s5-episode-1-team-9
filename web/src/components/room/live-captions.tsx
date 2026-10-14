"use client";

import { Captions, CaptionsOff } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { SpeechStatus } from "@/hooks/useSpeechRecognition";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "linguamatch:captions";

const FADE = ["opacity-35", "opacity-60", "opacity-100"];

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

  return (
    <div className="pointer-events-none absolute right-3 bottom-20 z-10 flex max-w-[70%] flex-col items-end gap-2 sm:bottom-16 sm:max-w-xs">
      {visible && (
        <div className="bg-card/80 w-full rounded-xl border px-3 py-2 text-sm shadow-lg backdrop-blur">
          {hint ? (
            <p className="text-muted-foreground text-xs leading-relaxed">
              {hint.text}
              {hint.href && (
                <>
                  {" "}
                  <Link href={hint.href} className="text-primary pointer-events-auto underline">
                    Open settings
                  </Link>
                </>
              )}
            </p>
          ) : lines.length === 0 && !speech.interim ? (
            <p className="text-muted-foreground text-xs">Say something and your words appear here.</p>
          ) : (
            <div className="flex flex-col gap-0.5 text-right">
              {lines.map((line, i) => (
                <p
                  key={`${lines.length}-${i}-${line}`}
                  className={cn(
                    "text-foreground leading-snug transition-opacity duration-700",
                    FADE[FADE.length - lines.length + i] ?? "opacity-100",
                  )}
                >
                  {line}
                </p>
              ))}
              {speech.interim && <p className="text-muted-foreground leading-snug">{speech.interim}</p>}
            </div>
          )}
        </div>
      )}
      <Button
        type="button"
        size="icon"
        variant="secondary"
        onClick={toggle}
        aria-label={visible ? "Hide live captions" : "Show live captions"}
        aria-pressed={visible}
        title={visible ? "Hide live captions" : "Show live captions"}
        className="pointer-events-auto size-8 rounded-full"
      >
        {visible ? <Captions className="size-4" /> : <CaptionsOff className="size-4" />}
      </Button>
    </div>
  );
}
