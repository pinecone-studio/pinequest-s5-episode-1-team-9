"use client";

import { useEffect, useRef, useState } from "react";

// Minimal typings for the Web Speech API (not in TypeScript's DOM lib).
interface SpeechRecognitionAlternativeLike {
  transcript: string;
  confidence: number;
}
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: { length: number; [index: number]: SpeechRecognitionResultLike };
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export interface RecognizedSegment {
  text: string;
  startedAt: number;
  endedAt: number;
  confidence: number | null;
}

export type SpeechStatus = "unsupported" | "idle" | "listening" | "denied" | "error";

const INTERIM_THROTTLE_MS = 250;
export const MAX_CAPTION_LINES = 3;

/**
 * Transcribes ONLY the local user's microphone with the browser's speech recognizer and
 * reports each finalized phrase. Audio is handled by the browser; nothing is recorded here.
 */
export function useSpeechRecognition(opts: {
  locale: string;
  enabled: boolean;
  onSegment: (segment: RecognizedSegment) => void;
}) {
  const [status, setStatus] = useState<SpeechStatus>(() => (getRecognitionCtor() ? "idle" : "unsupported"));
  const [interim, setInterim] = useState("");
  const [finals, setFinals] = useState<string[]>([]);
  const [speakingMs, setSpeakingMs] = useState(0);
  const onSegmentRef = useRef(opts.onSegment);
  onSegmentRef.current = opts.onSegment;

  useEffect(() => {
    const clearCaptions = () => {
      setInterim((s) => (s ? "" : s));
      setFinals((f) => (f.length ? [] : f));
    };

    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      setStatus("unsupported");
      clearCaptions();
      return;
    }
    if (!opts.enabled) {
      setStatus("idle");
      clearCaptions();
      return;
    }

    let stopped = false;
    let phraseStart: number | null = null;
    let restartTimer: ReturnType<typeof setTimeout> | null = null;
    let interimTimer: ReturnType<typeof setTimeout> | null = null;
    let pendingInterim = "";
    let lastInterimAt = 0;

    const queueInterim = (text: string) => {
      pendingInterim = text;
      if (interimTimer) return;
      const wait = Math.max(0, INTERIM_THROTTLE_MS - (Date.now() - lastInterimAt));
      interimTimer = setTimeout(() => {
        interimTimer = null;
        lastInterimAt = Date.now();
        setInterim(pendingInterim);
      }, wait);
    };

    const dropInterim = () => {
      if (interimTimer) clearTimeout(interimTimer);
      interimTimer = null;
      pendingInterim = "";
      setInterim((s) => (s ? "" : s));
    };
    const recognition = new Ctor();
    recognition.lang = opts.locale;
    recognition.continuous = true;
    recognition.interimResults = true; // used to timestamp when a phrase starts
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setStatus("listening");
    recognition.onresult = (event) => {
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]!;
        const alt = result[0];
        if (!alt) continue;
        phraseStart ??= Date.now();
        if (!result.isFinal) {
          interimText += alt.transcript;
          continue;
        }
        const text = alt.transcript.trim();
        if (text) {
          const endedAt = Date.now();
          const segmentStart = Math.min(phraseStart, endedAt - 300);
          onSegmentRef.current({
            text,
            startedAt: segmentStart,
            endedAt,
            // Browsers report 0 when they don't compute confidence.
            confidence: alt.confidence > 0 ? alt.confidence : null,
          });
          setFinals((lines) => [...lines, text].slice(-MAX_CAPTION_LINES));
          setSpeakingMs((ms) => ms + Math.max(0, endedAt - segmentStart));
        }
        phraseStart = null;
      }
      const trimmed = interimText.trim();
      if (trimmed) queueInterim(trimmed);
      else dropInterim();
    };
    recognition.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        stopped = true;
        setStatus("denied");
      } else if (e.error !== "no-speech" && e.error !== "aborted") {
        console.warn("[speech] recognition error:", e.error);
      }
    };
    // Recognizers stop on their own after silence or ~60s; keep restarting while enabled.
    recognition.onend = () => {
      phraseStart = null;
      if (stopped) return;
      restartTimer = setTimeout(() => {
        try {
          recognition.start();
        } catch {
          setStatus("error");
        }
      }, 250);
    };

    try {
      recognition.start();
    } catch {
      setStatus("error");
    }

    return () => {
      stopped = true;
      if (restartTimer) clearTimeout(restartTimer);
      if (interimTimer) clearTimeout(interimTimer);
      recognition.onend = null;
      recognition.abort();
    };
  }, [opts.enabled, opts.locale]);

  return { status, supported: status !== "unsupported", interim, finals, speakingMs };
}
