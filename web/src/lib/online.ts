"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { getSocket } from "@/lib/socket";

const POLL_MS = 15_000;

export function useOnlineCount(): number | null {
  const { user, loading } = useAuth();
  const [online, setOnline] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;
    const socket = getSocket();
    const onPresence = ({ online: n }: { online: number }) => setOnline(n);
    socket.on("presence:online", onPresence);
    return () => {
      socket.off("presence:online", onPresence);
    };
  }, [user]);

  useEffect(() => {
    if (loading || user) return;
    let cancelled = false;
    const poll = () => {
      fetch("/api/online", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (!cancelled && d && typeof d.online === "number") setOnline(d.online);
        })
        .catch(() => {});
    };
    poll();
    const t = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [loading, user]);

  return online;
}
