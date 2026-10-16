"use client";

import { useEffect, useState } from "react";

const SAMPLE_MS = 100;
const SPEAKING_RMS = 0.02;

export function useMicActivity(stream: MediaStream | null, enabled: boolean): number {
  const [speakingMs, setSpeakingMs] = useState(0);

  useEffect(() => {
    if (!enabled || !stream || stream.getAudioTracks().length === 0) return;
    if (typeof window === "undefined" || typeof window.AudioContext === "undefined") return;

    let context: AudioContext;
    try {
      context = new AudioContext();
    } catch {
      return;
    }

    const source = context.createMediaStreamSource(stream);
    const analyser = context.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    const buffer = new Float32Array(analyser.fftSize);

    const timer = setInterval(() => {
      analyser.getFloatTimeDomainData(buffer);
      let sum = 0;
      for (const sample of buffer) sum += sample * sample;
      if (Math.sqrt(sum / buffer.length) >= SPEAKING_RMS) setSpeakingMs((ms) => ms + SAMPLE_MS);
    }, SAMPLE_MS);

    return () => {
      clearInterval(timer);
      source.disconnect();
      analyser.disconnect();
      void context.close().catch(() => {});
    };
  }, [stream, enabled]);

  return speakingMs;
}
