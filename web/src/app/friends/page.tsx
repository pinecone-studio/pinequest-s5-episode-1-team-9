"use client";

import {
  languageName,
  type FriendDTO,
  type FriendRequestsDTO,
  type UserSearchResultDTO,
} from "@linguamatch/shared";
import { Ban, Check, Search, UserMinus, UserPlus, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { FullPageSpinner, PageShell } from "@/components/site/header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { useRequireUser } from "@/lib/auth";

const EMPTY_REQUESTS: FriendRequestsDTO = { incoming: [], outgoing: [] };

export default function FriendsPage() {
  const user = useRequireUser();
  const [friends, setFriends] = useState<FriendDTO[]>([]);
  const [requests, setRequests] = useState<FriendRequestsDTO>(EMPTY_REQUESTS);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserSearchResultDTO[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

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

  const run = async (action: () => Promise<unknown>, message?: string) => {
    setError(null);
    try {
      await action();
      if (message) setNotice(message);
      setResults(null);
      setQuery("");
      await reload();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setSearching(true);
    try {
      setResults((await api.searchUsers(query)).results);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSearching(false);
    }
  };

  if (!user) return <FullPageSpinner />;

  return (
    <PageShell className="max-w-3xl">
      <h1 className="text-3xl font-semibold tracking-tight">Friends</h1>
      <p className="text-muted-foreground mt-1 text-sm">
        Add people by username, then call them directly instead of being matched with a stranger.
      </p>

      {error && (
        <Alert variant="destructive" className="mt-6">
          <AlertDescription className="text-destructive">{error}</AlertDescription>
        </Alert>
      )}
      {notice && (
        <Alert className="mt-6">
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      )}

      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="text-lg">Find someone</CardTitle>
          <CardDescription>Search by their exact username, or the start of it.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={search} className="flex gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="username"
              aria-label="Username"
              minLength={2}
            />
            <Button type="submit" disabled={searching || query.trim().length < 2}>
              <Search /> Search
            </Button>
          </form>

          {results !== null && results.length === 0 && (
            <p className="text-muted-foreground mt-4 text-sm">Nobody found with that username.</p>
          )}
          {results !== null && results.length > 0 && (
            <ul className="mt-4 divide-y rounded-xl border">
              {results.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <div className="font-medium">{r.username}</div>
                    {r.nativeLanguage && (
                      <div className="text-muted-foreground text-xs">Speaks {languageName(r.nativeLanguage)}</div>
                    )}
                  </div>
                  {r.friendship === "accepted" ? (
                    <Badge variant="secondary">Already friends</Badge>
                  ) : r.friendship === "pending" ? (
                    <Badge variant="outline">{r.iAmRequester ? "Request sent" : "Wants to be friends"}</Badge>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => void run(() => api.sendFriendRequest(r.username), `Request sent to ${r.username}.`)}
                    >
                      <UserPlus /> Add
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {requests.incoming.length > 0 && (
        <>
          <h2 className="mt-12 text-xl font-semibold">Friend requests</h2>
          <ul className="mt-4 divide-y rounded-xl border">
            {requests.incoming.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="font-medium">{r.username}</span>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => void run(() => api.acceptFriend(r.id), `${r.username} is now your friend.`)}>
                    <Check /> Accept
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => void run(() => api.declineFriend(r.id))}>
                    <X /> Decline
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {requests.outgoing.length > 0 && (
        <>
          <h2 className="mt-12 text-xl font-semibold">Sent requests</h2>
          <ul className="mt-4 divide-y rounded-xl border">
            {requests.outgoing.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <span className="font-medium">{r.username}</span>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">Waiting</Badge>
                  <Button size="sm" variant="ghost" onClick={() => void run(() => api.declineFriend(r.id))}>
                    Cancel
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <h2 className="mt-12 text-xl font-semibold">Your friends</h2>
      {friends.length === 0 ? (
        <p className="text-muted-foreground mt-4 text-sm">No friends yet. Search for someone above.</p>
      ) : (
        <ul className="mt-4 divide-y rounded-xl border">
          {friends.map((f) => (
            <li key={f.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div>
                <div className="flex items-center gap-2 font-medium">
                  {f.username}
                  <PresenceBadge friend={f} />
                </div>
                {f.nativeLanguage && (
                  <div className="text-muted-foreground text-xs">Speaks {languageName(f.nativeLanguage)}</div>
                )}
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => void run(() => api.unfriend(f.id), `Removed ${f.username}.`)}>
                  <UserMinus /> Unfriend
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() => void run(() => api.blockUser(f.id), `Blocked ${f.username}.`)}
                >
                  <Ban /> Block
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}

function PresenceBadge({ friend }: { friend: FriendDTO }) {
  if (!friend.online) return <Badge variant="outline">Offline</Badge>;
  if (friend.busy) return <Badge variant="outline">In a call</Badge>;
  return (
    <Badge variant="secondary" className="text-success">
      Online
    </Badge>
  );
}
