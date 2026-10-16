import type { FriendDTO, FriendRequestsDTO, UserSearchResultDTO } from "@linguamatch/shared";
import { and, eq, inArray, isNull, ne, notInArray, or, sql } from "drizzle-orm";
import { db } from "../../db/client";
import { friendships, userBlocks, users } from "../../db/schema";
import { hasOpenSession } from "../../models/Session";
import { HttpError } from "../../utils/http";
import { SYSTEM_MODERATOR_ID } from "../moderation/aiModeration";
import { blockedUserIds } from "../moderation/moderationService";
import { nextFriendshipState, type FriendAction, type FriendshipView } from "./friendRules";

const SEARCH_LIMIT = 10;

export async function friendshipBetween(me: string, other: string): Promise<FriendshipView> {
  const [row] = await db
    .select({ userId: friendships.userId, status: friendships.status })
    .from(friendships)
    .where(
      or(
        and(eq(friendships.userId, me), eq(friendships.friendId, other)),
        and(eq(friendships.userId, other), eq(friendships.friendId, me)),
      ),
    );
  if (!row) return { status: "none", iAmRequester: false };
  return { status: row.status, iAmRequester: row.userId === me };
}

async function applyAction(me: string, other: string, action: FriendAction) {
  if (me === other) throw new HttpError(400, "That's you");
  const blocked = await blockedUserIds(me);
  if (blocked.has(other) && action !== "block") throw new HttpError(404, "User not found");

  const current = await friendshipBetween(me, other);
  const { allowed } = nextFriendshipState(current, action);
  if (!allowed) throw new HttpError(409, "That request is no longer valid");
  return current;
}

const pairWhere = (a: string, b: string) =>
  or(
    and(eq(friendships.userId, a), eq(friendships.friendId, b)),
    and(eq(friendships.userId, b), eq(friendships.friendId, a)),
  );

export async function sendRequest(me: string, username: string): Promise<{ id: string; username: string }> {
  const [target] = await db
    .select({ id: users.id, username: users.name })
    .from(users)
    .where(and(sql`lower(${users.name}) = lower(${username})`, isNull(users.deletedAt), ne(users.id, SYSTEM_MODERATOR_ID)));
  if (!target) throw new HttpError(404, "No user with that username");

  await applyAction(me, target.id, "send");
  await db.insert(friendships).values({ userId: me, friendId: target.id, status: "pending" }).onConflictDoNothing();
  return target;
}

export async function acceptRequest(me: string, other: string) {
  await applyAction(me, other, "accept");
  await db.update(friendships).set({ status: "accepted" }).where(pairWhere(me, other));
}

export async function declineRequest(me: string, other: string) {
  await applyAction(me, other, "decline");
  await db.delete(friendships).where(pairWhere(me, other));
}

export async function unfriend(me: string, other: string) {
  await applyAction(me, other, "unfriend");
  await db.delete(friendships).where(pairWhere(me, other));
}

export async function blockUser(me: string, other: string) {
  if (me === other) throw new HttpError(400, "That's you");
  await db.transaction(async (tx) => {
    await tx.delete(friendships).where(pairWhere(me, other));
    await tx.insert(userBlocks).values({ blockerId: me, blockedId: other }).onConflictDoNothing();
  });
}

async function friendIds(me: string): Promise<string[]> {
  const rows = await db
    .select({ userId: friendships.userId, friendId: friendships.friendId })
    .from(friendships)
    .where(and(eq(friendships.status, "accepted"), or(eq(friendships.userId, me), eq(friendships.friendId, me))));
  return rows.map((r) => (r.userId === me ? r.friendId : r.userId));
}

export async function listFriends(
  me: string,
  presence: { online: (id: string) => Promise<boolean>; queued: (id: string) => boolean },
): Promise<FriendDTO[]> {
  const ids = await friendIds(me);
  if (ids.length === 0) return [];

  const rows = await db
    .select({
      id: users.id,
      username: users.name,
      nativeLanguage: users.nativeLang,
      language: users.targetLang,
      level: users.level,
      deletedAt: users.deletedAt,
    })
    .from(users)
    .where(inArray(users.id, ids));

  const friends = await Promise.all(
    rows
      .filter((r) => !r.deletedAt)
      .map(async (r) => {
        const online = await presence.online(r.id);
        const busy = online && (presence.queued(r.id) || (await hasOpenSession(r.id)));
        return {
          id: r.id,
          username: r.username,
          nativeLanguage: r.nativeLanguage,
          language: r.language,
          level: (r.level ?? null) as FriendDTO["level"],
          online,
          busy,
        };
      }),
  );
  return friends.sort((a, b) => Number(b.online) - Number(a.online) || a.username.localeCompare(b.username));
}

export async function listRequests(me: string): Promise<FriendRequestsDTO> {
  const blocked = await blockedUserIds(me);
  const rows = await db
    .select({
      userId: friendships.userId,
      friendId: friendships.friendId,
      createdAt: friendships.createdAt,
      username: users.name,
      deletedAt: users.deletedAt,
    })
    .from(friendships)
    .innerJoin(users, eq(users.id, sql`case when ${friendships.userId} = ${me} then ${friendships.friendId} else ${friendships.userId} end`))
    .where(and(eq(friendships.status, "pending"), or(eq(friendships.userId, me), eq(friendships.friendId, me))));

  const incoming = [];
  const outgoing = [];
  for (const row of rows) {
    const otherId = row.userId === me ? row.friendId : row.userId;
    if (row.deletedAt || blocked.has(otherId)) continue;
    const entry = { id: otherId, username: row.username, createdAt: row.createdAt.toISOString() };
    if (row.userId === me) outgoing.push(entry);
    else incoming.push(entry);
  }
  return { incoming, outgoing };
}

export async function searchUsers(me: string, query: string): Promise<UserSearchResultDTO[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const blocked = await blockedUserIds(me);
  const excluded = [me, SYSTEM_MODERATOR_ID, ...blocked];

  const rows = await db
    .select({ id: users.id, username: users.name, nativeLanguage: users.nativeLang })
    .from(users)
    .where(
      and(
        sql`lower(${users.name}) like lower(${q}) || '%'`,
        isNull(users.deletedAt),
        notInArray(users.id, excluded),
      ),
    )
    .limit(SEARCH_LIMIT);

  return Promise.all(
    rows.map(async (r) => {
      const friendship = await friendshipBetween(me, r.id);
      return {
        id: r.id,
        username: r.username,
        nativeLanguage: r.nativeLanguage,
        friendship: friendship.status === "none" ? null : friendship.status,
        iAmRequester: friendship.iAmRequester,
      };
    }),
  );
}
