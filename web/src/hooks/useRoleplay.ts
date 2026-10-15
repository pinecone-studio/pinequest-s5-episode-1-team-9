"use client";

import type { RoleplayCard } from "@linguamatch/shared";
import { useCallback, useEffect, useState } from "react";
import type { AppSocket } from "@/lib/socket";

export interface Roleplay {
  card: RoleplayCard | null;
  loading: boolean;
  error: string | null;
  start: () => void;
  end: () => void;
}

export function useRoleplay(socket: AppSocket | null, roomId: string, ready: boolean): Roleplay {
  const [card, setCard] = useState<RoleplayCard | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!socket || !ready) return;
    const onCard = (p: { card: RoleplayCard | null; loading: boolean; error?: string }) => {
      setCard(p.card);
      setLoading(p.loading);
      setError(p.error ?? null);
    };
    socket.on("roleplay:card", onCard);
    socket.emit("roleplay:sync", { roomId });
    return () => {
      socket.off("roleplay:card", onCard);
    };
  }, [socket, roomId, ready]);

  const start = useCallback(() => {
    if (!socket) return;
    setError(null);
    setLoading(true);
    socket.emit("roleplay:start", { roomId });
  }, [socket, roomId]);

  const end = useCallback(() => {
    if (!socket) return;
    setCard(null);
    setError(null);
    socket.emit("roleplay:end", { roomId });
  }, [socket, roomId]);

  return { card, loading, error, start, end };
}
