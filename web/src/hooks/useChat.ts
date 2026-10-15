"use client";

import type { ChatMessageDTO, DraftAssist, SuggestedWord } from "@linguamatch/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AppSocket } from "@/lib/socket";

const SUGGEST_REFRESH_MS = 60_000;

const ERRORS: Record<string, string> = {
  empty: "Type something first.",
  too_long: "That message is too long.",
  rate_limited: "Slow down a moment.",
};

export interface Chat {
  messages: ChatMessageDTO[];
  aiAvailable: boolean;
  suggestions: SuggestedWord[];
  usedWords: string[];
  assist: DraftAssist | null;
  assistLoading: boolean;
  error: string | null;
  send: (text: string) => void;
  requestAssist: (draft: string) => void;
  dismissAssist: () => void;
}

export function useChat(
  socket: AppSocket | null,
  roomId: string,
  ready: boolean,
  context: { topic: string; recent: readonly string[] },
): Chat {
  const [messages, setMessages] = useState<ChatMessageDTO[]>([]);
  const [aiAvailable, setAiAvailable] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestedWord[]>([]);
  const [usedWords, setUsedWords] = useState<string[]>([]);
  const [assist, setAssist] = useState<DraftAssist | null>(null);
  const [assistLoading, setAssistLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const contextRef = useRef(context);
  contextRef.current = context;
  const lastSuggestRef = useRef(0);

  useEffect(() => {
    if (!socket || !ready) return;

    const onMessage = (m: ChatMessageDTO) =>
      setMessages((prev) => (prev.some((p) => p.id === m.id) ? prev : [...prev, m]));
    const onState = (p: { messages: ChatMessageDTO[]; aiAvailable: boolean }) => {
      setMessages(p.messages);
      setAiAvailable(p.aiAvailable);
    };
    const onSuggestions = (p: { words: SuggestedWord[] }) => setSuggestions(p.words);
    const onAssist = (p: { assist: DraftAssist | null; loading: boolean }) => {
      setAssistLoading(p.loading);
      if (!p.loading) setAssist(p.assist);
    };
    const onCredited = (p: { word: string }) =>
      setUsedWords((prev) => (prev.includes(p.word) ? prev : [...prev, p.word]));
    const onError = (p: { reason: string }) => {
      setError(ERRORS[p.reason] ?? "Couldn't send that.");
      setTimeout(() => setError(null), 2500);
    };

    socket.on("chat:message", onMessage);
    socket.on("chat:state", onState);
    socket.on("chat:suggestions", onSuggestions);
    socket.on("chat:assist", onAssist);
    socket.on("chat:word-credited", onCredited);
    socket.on("chat:error", onError);
    socket.emit("chat:sync", { roomId });

    return () => {
      socket.off("chat:message", onMessage);
      socket.off("chat:state", onState);
      socket.off("chat:suggestions", onSuggestions);
      socket.off("chat:assist", onAssist);
      socket.off("chat:word-credited", onCredited);
      socket.off("chat:error", onError);
    };
  }, [socket, roomId, ready]);

  useEffect(() => {
    if (!socket || !ready || !aiAvailable) return;
    const ask = () => {
      const now = Date.now();
      if (now - lastSuggestRef.current < SUGGEST_REFRESH_MS) return;
      lastSuggestRef.current = now;
      socket.emit("chat:suggest", {
        roomId,
        topic: contextRef.current.topic,
        recent: [...contextRef.current.recent],
      });
    };
    ask();
    const t = setInterval(ask, 5000);
    return () => clearInterval(t);
  }, [socket, roomId, ready, aiAvailable, context.topic]);

  const creditedRef = useRef(0);
  useEffect(() => {
    if (!socket || !ready) return;
    const lines = context.recent;
    if (lines.length < creditedRef.current) creditedRef.current = 0;
    for (let i = creditedRef.current; i < lines.length; i++) {
      socket.emit("chat:caption", { roomId, text: lines[i]! });
    }
    creditedRef.current = lines.length;
  }, [socket, roomId, ready, context.recent]);

  const send = useCallback(
    (text: string) => {
      if (!socket) return;
      setAssist(null);
      socket.emit("chat:send", { roomId, text });
    },
    [socket, roomId],
  );

  const requestAssist = useCallback(
    (draft: string) => {
      if (!socket) return;
      socket.emit("chat:assist", { roomId, draft });
    },
    [socket, roomId],
  );

  return {
    messages,
    aiAvailable,
    suggestions,
    usedWords,
    assist,
    assistLoading,
    error,
    send,
    requestAssist,
    dismissAssist: () => setAssist(null),
  };
}
