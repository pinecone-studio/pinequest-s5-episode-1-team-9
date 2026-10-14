"use client";

import { languageName, type CefrLevel, type FriendDTO } from "@linguamatch/shared";
import { PhoneCall, Shuffle, Users, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { FullPageSpinner, Logo } from "@/components/site/header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useRequireUser } from "@/lib/auth";
import { getSocket, useSocketStatus, type SocketStatus } from "@/lib/socket";
import { cn, formatClock } from "@/lib/utils";

const CONNECTION_MESSAGES: Partial<Record<SocketStatus, string>> = {
  unreachable: "Waking up the server, this can take up to a minute...",
  reconnecting: "Connection lost. Reconnecting… you'll keep your place in the queue.",
  auth_error: "We couldn't verify your session with the matching server. Please reload the page.",
};

type Mode = "random" | "friend";

export default function MatchPage() {
  const user = useRequireUser();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("random");
  const [waiting, setWaiting] = useState<number | null>(null);
  const [level, setLevel] = useState<CefrLevel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const language = user?.activeTargetLanguage ?? null;

  const socketStatus = useSocketStatus();

  useEffect(() => {
    if (!language || mode !== "random") return;
    const socket = getSocket();
    let active = true;
    const join = () => {
      if (!active) return;
      setError(null);
      socket.emit("queue:join", { targetLanguage: language });
    };
    const onStatus = (s: { waiting: number; level: CefrLevel }) => {
      setWaiting(s.waiting);
      setLevel(s.level);
    };
    const onMatched = ({ roomId }: { roomId: string }) => {
      if (active) router.push(`/room/${roomId}`);
    };
    const onError = ({ message }: { message: string }) => setError(message);

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
  }, [language, mode, router]);

  useEffect(() => {
    if (!language || mode !== "random") return;
    const started = Date.now();
    setElapsed(0);
    const timer = setInterval(() => setElapsed((Date.now() - started) / 1000), 1000);
    return () => clearInterval(timer);
  }, [language, mode]);

  if (!user || !language) return <FullPageSpinner />;
  const myLevel = level ?? user.targetLanguages.find((t) => t.language === language)?.level;
  const connectionMessage = CONNECTION_MESSAGES[socketStatus];

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex h-16 w-full max-w-6xl items-center px-4 sm:px-6">
        <Logo />
      </header>
      <main className="flex flex-1 flex-col items-center justify-center px-4 pb-20 text-center">
        <div className="bg-muted mb-10 inline-flex rounded-full p-1" role="tablist" aria-label="How to start a call">
          <ModeTab active={mode === "random"} onClick={() => setMode("random")}>
            <Shuffle className="size-4" /> Random partner
          </ModeTab>
          <ModeTab active={mode === "friend"} onClick={() => setMode("friend")}>
            <PhoneCall className="size-4" /> Call a friend
          </ModeTab>
        </div>

        {mode === "random" ? (
          <>
            <div className="relative mb-10 grid size-36 place-items-center">
              <span className="animate-pulse-ring bg-primary/30 absolute inset-0 rounded-full" />
              <span className="animate-pulse-ring bg-primary/20 absolute inset-0 rounded-full [animation-delay:0.6s]" />
              <span className="bg-primary text-primary-foreground relative grid size-24 place-items-center rounded-full text-2xl font-semibold shadow-lg">
                {myLevel}
              </span>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Finding your conversation partner…</h1>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              <Badge variant="secondary">{languageName(language)}</Badge>
              <Badge variant="outline">Your level: {myLevel}</Badge>
              <Badge variant="outline">
                <Users /> {waiting ?? "–"} waiting
              </Badge>
              <Badge variant="outline" className="font-mono">{formatClock(elapsed)}</Badge>
            </div>
            <p className="text-muted-foreground mt-6 max-w-md text-sm">
              {elapsed < 10
                ? `Looking for someone at exactly ${myLevel}.`
                : "Also looking one level above and below so you don't wait too long."}{" "}
              Keep this tab open — we&apos;ll connect you automatically.
            </p>
          </>
        ) : (
          <FriendPicker language={language} />
        )}

        {connectionMessage && (
          <Alert className="mt-6 max-w-md text-left" role="status">
            <AlertDescription>{connectionMessage}</AlertDescription>
          </Alert>
        )}
        {error && (
          <Alert variant="destructive" className="mt-6 max-w-md text-left">
            <AlertDescription className="text-destructive">
              {error}{" "}
              {error.includes("languages") && <Link href="/onboarding" className="underline">Finish setup</Link>}
            </AlertDescription>
          </Alert>
        )}

        <Button variant="outline" className="mt-10" onClick={() => router.push("/profile")}>
          <X /> Cancel
        </Button>
        <p className="text-muted-foreground mt-8 max-w-sm text-xs">
          Don&apos;t share personal details with strangers. You can end, skip, block or report anyone at any time.
        </p>
      </main>
    </div>
  );
}

function ModeTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition",
        active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function FriendPicker({ language }: { language: string }) {
  const router = useRouter();
  const [friends, setFriends] = useState<FriendDTO[] | null>(null);
  const [calling, setCalling] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setFriends((await api.friends()).friends);
    } catch {
      setFriends([]);
    }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 15_000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    const socket = getSocket();
    const onStatus = (p: { status: string; roomId?: string; message?: string }) => {
      if (p.status === "ringing") {
        setStatus("Ringing…");
        return;
      }
      if (p.status === "accepted" && p.roomId) {
        router.push(`/room/${p.roomId}`);
        return;
      }
      setCalling(null);
      setStatus(p.message ?? "Your friend isn't available");
      void load();
    };
    socket.on("friend:call-status", onStatus);
    return () => {
      socket.off("friend:call-status", onStatus);
    };
  }, [router, load]);

  const call = (friend: FriendDTO) => {
    setCalling(friend.id);
    setStatus("Ringing…");
    getSocket().emit("friend:call", { friendId: friend.id });
  };

  return (
    <div className="w-full max-w-md text-left">
      <h1 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">Call a friend</h1>
      <p className="text-muted-foreground mt-3 text-center text-sm">
        You&apos;ll practice {languageName(language)}. Only friends who are online and free can be called.
      </p>

      {status && (
        <Alert className="mt-6" role="status">
          <AlertDescription>{status}</AlertDescription>
        </Alert>
      )}

      {friends === null ? (
        <p className="text-muted-foreground mt-6 text-center text-sm">Loading your friends…</p>
      ) : friends.length === 0 ? (
        <p className="text-muted-foreground mt-6 text-center text-sm">
          You have no friends yet.{" "}
          <Link href="/friends" className="text-primary underline">
            Add someone by username
          </Link>
          .
        </p>
      ) : (
        <ul className="mt-6 divide-y rounded-xl border">
          {friends.map((f) => (
            <li key={f.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div>
                <div className="font-medium">{f.username}</div>
                <div className="text-muted-foreground text-xs">
                  {!f.online ? "Offline" : f.busy ? "In a call" : "Online"}
                </div>
              </div>
              <Button
                size="sm"
                disabled={!f.online || f.busy || calling !== null}
                onClick={() => call(f)}
              >
                <PhoneCall /> {calling === f.id ? "Ringing…" : "Call"}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
