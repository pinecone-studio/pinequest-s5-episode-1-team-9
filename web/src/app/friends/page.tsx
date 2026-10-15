"use client";

import {
  languageName,
  levelShort,
  type FriendDTO,
  type FriendRequestsDTO,
  type UserSearchResultDTO,
} from "@linguamatch/shared";
import { Ban, PhoneCall, Search, UserMinus, UserPlus } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { FullPageSpinner } from "@/components/site/header";
import { PaperHeader } from "@/components/site/paper-header";
import { api } from "@/lib/api";
import { useRequireUser } from "@/lib/auth";
import { getSocket } from "@/lib/socket";
import { cn } from "@/lib/utils";

const EMPTY: FriendRequestsDTO = { incoming: [], outgoing: [] };

export default function FriendsPage() {
  const user = useRequireUser();
  const [friends, setFriends] = useState<FriendDTO[]>([]);
  const [requests, setRequests] = useState<FriendRequestsDTO>(EMPTY);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserSearchResultDTO[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [calling, setCalling] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const [f, r] = await Promise.all([api.friends(), api.friendRequests()]);
      setFriends(f.friends);
      setRequests(r.requests);
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    if (user) void reload();
  }, [user, reload]);

  useEffect(() => {
    if (!user) return;
    const t = setInterval(() => void reload(), 15_000);
    return () => clearInterval(t);
  }, [user, reload]);

  useEffect(() => {
    if (!user) return;
    const socket = getSocket();
    const onStatus = (p: { status: string; message?: string }) => {
      if (p.status === "ringing") return;
      if (p.status !== "accepted") {
        setCalling(null);
        setNotice(p.message ?? "Your friend isn't available");
        void reload();
      }
    };
    socket.on("friend:call-status", onStatus);
    return () => {
      socket.off("friend:call-status", onStatus);
    };
  }, [user, reload]);

  const run = async (action: () => Promise<unknown>, message?: string) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await action();
      if (message) setNotice(message);
      setResults(null);
      setQuery("");
      await reload();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    try {
      setResults((await api.searchUsers(query)).results);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  if (!user) return <FullPageSpinner />;

  return (
    <div className="bg-paper text-ink min-h-dvh">
      <PaperHeader />

      <main className="mx-auto flex max-w-[1240px] flex-col gap-6 px-6 pt-6 pb-18">
        <h1 className="font-display m-0 text-[clamp(28px,4vw,40px)] font-bold tracking-[-0.02em]">Friends</h1>

        {notice && <p className="bg-brand-partner-tint m-0 rounded-2xl px-4 py-3 text-[#5C4A26]">{notice}</p>}
        {error && <p className="m-0 rounded-2xl bg-[#FBEAEA] px-4 py-3 text-[#8C1A21]">{error}</p>}

        <section aria-labelledby="add" className="border-hairline flex flex-col gap-4 rounded-3xl border bg-white p-7">
          <h2 id="add" className="m-0 text-xl font-semibold">
            Add a friend
          </h2>
          <form onSubmit={search} className="flex flex-wrap gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Their username"
              aria-label="Username"
              minLength={2}
              className="bg-paper text-ink min-h-12 min-w-0 flex-1 basis-60 rounded-xl border border-[#D6DAEA] px-3.5 text-base"
            />
            <button
              type="submit"
              disabled={query.trim().length < 2}
              className="bg-brand-you inline-flex min-h-12 items-center gap-2 rounded-xl border-0 px-5 font-bold text-white disabled:opacity-50"
            >
              <Search aria-hidden="true" className="size-4.5" />
              Search
            </button>
          </form>

          {results !== null && results.length === 0 && (
            <p className="text-dim m-0">Nobody found with that username.</p>
          )}
          {results !== null && results.length > 0 && (
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {results.map((r) => (
                <li key={r.id} className="bg-paper flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3">
                  <span className="flex items-center gap-3">
                    <Avatar name={r.username} side="partner" />
                    <span className="flex flex-col">
                      <span className="font-semibold">{r.username}</span>
                      {r.nativeLanguage && (
                        <span className="text-sm text-[#5B6085]">Speaks {languageName(r.nativeLanguage)}</span>
                      )}
                    </span>
                  </span>
                  {r.friendship === "accepted" ? (
                    <span className="text-dim text-sm font-semibold">Already friends</span>
                  ) : r.friendship === "pending" ? (
                    <span className="text-dim text-sm font-semibold">
                      {r.iAmRequester ? "Request sent" : "Wants to be friends"}
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void run(() => api.sendFriendRequest(r.username), `Request sent to ${r.username}.`)}
                      className="bg-brand-you inline-flex min-h-11 items-center gap-2 rounded-xl border-0 px-4 font-bold text-white disabled:opacity-50"
                    >
                      <UserPlus aria-hidden="true" className="size-4" />
                      Add
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {(requests.incoming.length > 0 || requests.outgoing.length > 0) && (
          <section aria-labelledby="req" className="bg-brand-partner-tint flex flex-col gap-4 rounded-3xl p-7">
            <h2 id="req" className="m-0 text-xl font-semibold">
              Requests
            </h2>
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {requests.incoming.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3">
                  <span className="flex items-center gap-3">
                    <Avatar name={r.username} side="partner" />
                    <span className="font-semibold">{r.username} wants to be friends</span>
                  </span>
                  <span className="flex gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void run(() => api.acceptFriend(r.id), `${r.username} is now your friend.`)}
                      className="bg-fix min-h-11 rounded-xl border-0 px-4 font-bold text-white disabled:opacity-50"
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void run(() => api.declineFriend(r.id))}
                      className="text-ink min-h-11 rounded-xl border border-[#D6DAEA] bg-white px-4 font-semibold disabled:opacity-50"
                    >
                      Decline
                    </button>
                  </span>
                </li>
              ))}
              {requests.outgoing.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3">
                  <span className="text-dim">Sent by you: {r.username}, waiting</span>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void run(() => api.declineFriend(r.id))}
                    className="text-ink min-h-11 rounded-xl border border-[#D6DAEA] bg-white px-4 font-semibold disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section aria-labelledby="list" className="border-hairline rounded-3xl border bg-white p-7">
          <h2 id="list" className="m-0 mb-2.5 text-xl font-semibold">
            Your friends
          </h2>
          {friends.length === 0 ? (
            <p className="text-dim m-0">No friends yet. Search for someone above.</p>
          ) : (
            <ul className="m-0 flex list-none flex-col p-0">
              {friends.map((f) => (
                <li
                  key={f.id}
                  className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EEF0F7] py-3 last:border-0"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <Avatar name={f.username} side="partner" />
                    <span className="flex min-w-0 flex-col">
                      <span className="font-semibold">{f.username}</span>
                      <span className="text-sm text-[#5B6085]">
                        {!f.online ? "Offline" : f.busy ? "In a call" : "Online now"}
                        {f.language && f.level
                          ? ` · ${languageName(f.language)} ${levelShort(f.language, f.level)}`
                          : ""}
                      </span>
                    </span>
                  </span>
                  <span className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={!f.online || f.busy || calling !== null}
                      onClick={() => {
                        setCalling(f.id);
                        setNotice(null);
                        getSocket().emit("friend:call", { friendId: f.id });
                      }}
                      className={cn(
                        "inline-flex min-h-11 items-center gap-2 rounded-xl border-0 px-4 font-bold",
                        f.online && !f.busy ? "bg-fix text-white" : "bg-[#EEF0F7] text-[#8A8FB0]",
                      )}
                    >
                      <PhoneCall aria-hidden="true" className="size-4" />
                      {calling === f.id ? "Ringing…" : "Call"}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void run(() => api.unfriend(f.id), `Removed ${f.username}.`)}
                      aria-label={`Unfriend ${f.username}`}
                      className="text-ink grid size-11 place-items-center rounded-xl border border-[#D6DAEA] bg-white disabled:opacity-50"
                    >
                      <UserMinus aria-hidden="true" className="size-4.5" />
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void run(() => api.blockUser(f.id), `Blocked ${f.username}.`)}
                      aria-label={`Block ${f.username}`}
                      className="grid size-11 place-items-center rounded-xl border border-[#D6DAEA] bg-white text-[#8C1A21] disabled:opacity-50"
                    >
                      <Ban aria-hidden="true" className="size-4.5" />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className="text-dim m-0 text-[15px]">
          Only accepted friends can call you, and blocking removes you from their search.{" "}
          <Link href="/rules" className="text-brand-you">
            Community rules
          </Link>
        </p>
      </main>
    </div>
  );
}

function Avatar({ name, side }: { name: string; side: "you" | "partner" }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "font-display grid size-10 shrink-0 place-items-center rounded-full text-base font-bold",
        side === "you" ? "bg-brand-you text-white" : "bg-brand-partner text-ink",
      )}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}
