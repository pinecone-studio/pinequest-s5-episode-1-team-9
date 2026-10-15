"use client";

import type { CefrLevel } from "@linguamatch/shared";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { forgetRoom, recallRoom, rememberRoom } from "@/lib/active-room";
import { getSocket } from "@/lib/socket";

export type StagePhase = "idle" | "searching" | "live";

export type StageGate = "ready" | "signed-out" | "needs-onboarding";

export interface CallStage {
  phase: StagePhase;
  gate: StageGate;
  roomId: string | null;
  waiting: number | null;
  elapsed: number;
  error: string | null;
  wantsMedia: boolean;
  start: () => void;
  stop: () => void;
  reset: () => void;
  clearError: () => void;
}

export function useCallStage(language: string | null, level: CefrLevel | null): CallStage {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [phase, setPhase] = useState<StagePhase>("idle");
  const [roomId, setRoomId] = useState<string | null>(null);
  const [waiting, setWaiting] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [wantsMedia, setWantsMedia] = useState(false);

  const searching = phase === "searching";
  const startedAt = useRef(0);

  const gate: StageGate = loading ? "ready" : !user ? "signed-out" : user.onboarded ? "ready" : "needs-onboarding";

  useEffect(() => {
    const saved = recallRoom();
    if (!saved) return;
    setRoomId(saved);
    setWantsMedia(true);
    setPhase("live");
  }, []);

  useEffect(() => {
    if (!searching) return;
    startedAt.current = Date.now();
    setElapsed(0);
    const timer = setInterval(() => setElapsed((Date.now() - startedAt.current) / 1000), 1000);
    return () => clearInterval(timer);
  }, [searching]);

  useEffect(() => {
    if (!searching || !language) return;
    const socket = getSocket();
    let active = true;

    const join = () => {
      if (!active) return;
      setError(null);
      socket.emit("queue:join", { targetLanguage: language });
    };
    const onStatus = (s: { waiting: number }) => setWaiting(s.waiting);
    const onMatched = ({ roomId: id }: { roomId: string }) => {
      if (!active) return;
      rememberRoom(id);
      setRoomId(id);
      setPhase("live");
    };
    const onError = ({ message }: { message: string }) => {
      if (!active) return;
      setError(message);
      setPhase("idle");
    };

    socket.on("queue:status", onStatus);
    socket.on("queue:matched", onMatched);
    socket.on("queue:error", onError);
    socket.on("connect", join);
    if (socket.connected) join();

    return () => {
      active = false;
      socket.emit("queue:leave");
      socket.off("queue:status", onStatus);
      socket.off("queue:matched", onMatched);
      socket.off("queue:error", onError);
      socket.off("connect", join);
    };
  }, [searching, language]);

  const start = useCallback(() => {
    if (gate === "signed-out") {
      router.push("/signup?redirect_url=%2F");
      return;
    }
    if (gate === "needs-onboarding") {
      router.push("/onboarding");
      return;
    }
    if (!language || !level) {
      setError("Pick a language and level first.");
      return;
    }
    forgetRoom();
    setRoomId(null);
    setWantsMedia(true);
    setWaiting(null);
    setError(null);
    setPhase("searching");
  }, [gate, language, level, router]);

  const stop = useCallback(() => {
    forgetRoom();
    setPhase("idle");
    setRoomId(null);
    setWaiting(null);
  }, []);

  const reset = useCallback(() => {
    forgetRoom();
    setPhase("idle");
    setRoomId(null);
    setWaiting(null);
    setWantsMedia(false);
    setError(null);
  }, []);

  return {
    phase,
    gate,
    roomId,
    waiting,
    elapsed,
    error,
    wantsMedia,
    start,
    stop,
    reset,
    clearError: () => setError(null),
  };
}
