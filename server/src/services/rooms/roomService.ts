import { lowerLevel, type FrameSampleInput, type RoomEndReason, type SignalPayload, type Topic, type TranscriptSegmentInput } from "@linguamatch/shared";
import { and, desc, eq, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { iceServers } from "../../config/env";
import { db, isUuid } from "../../db/client";
import { recentPartners, sessions, transcriptLines, users } from "../../db/schema";
import {
  findSession,
  involvesUser,
  participantOf,
  participantsOf,
  sessionDurationSeconds,
  type Session,
} from "../../models/Session";
import { conversationRoom, getIO, userRoom, type AppSocket } from "../../socket/io";
import { generateConversationFeedback } from "../feedback/feedbackService";
import type { MatchPair } from "../matchmaking/algorithm";
import { clearModerationBuffer, recordForModeration, recordFrameForModeration } from "../moderation/aiModerationQueue";
import { sanitizeSegment } from "../speech";
import { pickRandomTopic } from "../topics/topicBank";
import { awardXpForSession } from "../xp/xpService";

const RECONNECT_GRACE_MS = 20_000;
const JOIN_TIMEOUT_MS = 45_000;
const TOPIC_COOLDOWN_MS = 2_000;
const MIN_SEGMENT_INTERVAL_MS = 250;
const MAX_SEGMENTS_PER_SESSION = 3000;
const MIN_FRAME_INTERVAL_MS = 5_000;
const MAX_FRAME_CHARS = 60_000;
const FRAME_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const OPEN_STATUSES = ["pending", "active"] as const;

interface RoomState {
  sockets: Map<string, string>;
  timers: Map<string, NodeJS.Timeout>;
  topicLoading: boolean;
  /** Last topic error, replayed to people who join after it was sent. */
  topicError: string | null;
  lastTopicRequestAt: number;
  segmentCount: number;
  lastSegmentAt: Map<string, number>;
  lastFrameAt: Map<string, number>;
}

const rooms = new Map<string, RoomState>();

function roomState(sessionId: string): RoomState {
  let state = rooms.get(sessionId);
  if (!state) {
    state = {
      sockets: new Map(),
      timers: new Map(),
      topicLoading: false,
      topicError: null,
      lastTopicRequestAt: 0,
      segmentCount: 0,
      lastSegmentAt: new Map(),
      lastFrameAt: new Map(),
    };
    rooms.set(sessionId, state);
  }
  return state;
}

function clearTimer(state: RoomState, key: string) {
  const t = state.timers.get(key);
  if (t) clearTimeout(t);
  state.timers.delete(key);
}

const isOpen = (s: Session) => s.status === "pending" || s.status === "active";

/** Rooms live in memory, so sessions left open by a previous process can never finish. */
export async function endStaleSessions(): Promise<void> {
  await db
    .update(sessions)
    .set({ status: "ended", endedAt: new Date(), endReason: "disconnected" })
    .where(inArray(sessions.status, [...OPEN_STATUSES]));
}

export async function createSessionFromMatch(pair: MatchPair): Promise<string> {
  const matched = await db
    .select({ id: users.id, transcriptionConsent: users.transcriptionConsent })
    .from(users)
    .where(inArray(users.id, [pair.a.userId, pair.b.userId]));
  const consent = new Map(matched.map((u) => [u.id, u.transcriptionConsent]));
  if (consent.size !== 2) throw new Error("A matched user disappeared during matching");

  const id = await db.transaction(async (tx) => {
    const [session] = await tx
      .insert(sessions)
      .values({
        userA: pair.a.userId,
        userB: pair.b.userId,
        lang: pair.a.targetLanguage,
        userALevel: pair.a.level,
        userBLevel: pair.b.level,
        matchingMode: pair.levelDistance === 0 ? "exact_level" : "flexible_level",
        levelDistance: pair.levelDistance,
        userATranscriptionConsent: consent.get(pair.a.userId)!,
        userBTranscriptionConsent: consent.get(pair.b.userId)!,
      })
      .returning({ id: sessions.id });
    const now = new Date();
    await tx
      .insert(recentPartners)
      .values([
        { userId: pair.a.userId, partnerId: pair.b.userId, lastSessionId: session!.id, metAt: now },
        { userId: pair.b.userId, partnerId: pair.a.userId, lastSessionId: session!.id, metAt: now },
      ])
      .onConflictDoUpdate({
        target: [recentPartners.userId, recentPartners.partnerId],
        set: {
          lastSessionId: sql`excluded.last_session_id`,
          metAt: sql`excluded.met_at`,
          matchCount: sql`${recentPartners.matchCount} + 1`,
        },
      });
    return session!.id;
  });

  const state = roomState(id);
  // If someone never shows up in the room (closed the tab mid-match), don't leave the other hanging.
  state.timers.set(
    "join",
    setTimeout(() => {
      const absent = [pair.a.userId, pair.b.userId].find((uid) => !state.sockets.has(uid));
      void endSession(id, absent ?? null, "partner_left");
    }, JOIN_TIMEOUT_MS),
  );
  void generateTopic(id);
  return id;
}

export async function joinRoom(socket: AppSocket, sessionId: string) {
  const userId = socket.data.userId;
  let session = await findSession(sessionId);
  if (!session || !isOpen(session) || !participantOf(session, userId)) {
    socket.emit("room:error", { message: "This conversation has ended or doesn't exist." });
    return;
  }

  const state = roomState(sessionId);
  clearTimer(state, `disconnect:${userId}`);
  state.sockets.set(userId, socket.id);
  await socket.join(conversationRoom(sessionId));

  const isA = session.userA === userId;
  await db
    .update(sessions)
    .set(isA ? { userAJoinedAt: new Date() } : { userBJoinedAt: new Date() })
    .where(and(eq(sessions.id, sessionId), isNull(isA ? sessions.userAJoinedAt : sessions.userBJoinedAt)));

  const participants = participantsOf(session);
  if (!participants.every((p) => state.sockets.has(p.userId))) {
    socket.emit("room:waiting-partner");
    return;
  }
  clearTimer(state, "join");

  // Both are in the room: the conversation starts now (only the first time).
  const [started] = await db
    .update(sessions)
    .set({ status: "active", startedAt: new Date() })
    .where(and(eq(sessions.id, sessionId), eq(sessions.status, "pending")))
    .returning();
  session = started ?? (await findSession(sessionId));
  if (!session || session.status !== "active") return;

  const profiles = await db
    .select({ id: users.id, username: users.name, nativeLanguage: users.nativeLang, deletedAt: users.deletedAt })
    .from(users)
    .where(inArray(users.id, [session.userA, session.userB]));
  const profileOf = new Map(profiles.map((p) => [p.id, p]));

  // (Re)start the call for both sides. On a refresh this also resets the other peer's connection.
  const io = getIO();
  const topic = latestTopic(session);
  participants.forEach((p, index) => {
    const partner = participants[1 - index]!;
    const partnerProfile = profileOf.get(partner.userId);
    const sid = state.sockets.get(p.userId);
    if (!sid) return;
    io.to(sid).emit("room:ready", {
      roomId: sessionId,
      role: index === 0 ? "caller" : "callee",
      partner: {
        displayName: !partnerProfile || partnerProfile.deletedAt ? "Deleted user" : partnerProfile.username,
        nativeLanguage: partnerProfile?.nativeLanguage ?? null,
        level: partner.level,
      },
      targetLanguage: session.lang,
      yourLevel: p.level,
      startedAt: session.startedAt!.toISOString(),
      topic,
      iceServers: iceServers(),
    });
  });
  // The first topic is generated at match time, before anyone is in the room, so replay its state.
  io.to(conversationRoom(sessionId)).emit("topic:update", {
    topic,
    loading: state.topicLoading,
    ...(state.topicError && { error: state.topicError }),
  });
}

export function handleSocketDisconnect(socket: AppSocket) {
  const userId = socket.data.userId;
  for (const [sessionId, state] of rooms) {
    if (state.sockets.get(userId) !== socket.id) continue;
    state.sockets.delete(userId);
    socket.to(conversationRoom(sessionId)).emit("room:waiting-partner");
    state.timers.set(
      `disconnect:${userId}`,
      setTimeout(() => void endSession(sessionId, userId, "disconnected"), RECONNECT_GRACE_MS),
    );
  }
}

export async function relaySignal(socket: AppSocket, sessionId: string, data: SignalPayload) {
  const state = rooms.get(sessionId);
  const userId = socket.data.userId;
  if (!state || state.sockets.get(userId) !== socket.id) return;
  for (const [otherId, sid] of state.sockets) {
    if (otherId !== userId) getIO().to(sid).emit("signal", { roomId: conversationId, data });
  }
}

export async function requestTopic(socket: AppSocket, sessionId: string) {
  const state = rooms.get(sessionId);
  if (!state || state.sockets.get(socket.data.userId) !== socket.id) return;
  if (state.topicLoading || Date.now() - state.lastTopicRequestAt < TOPIC_COOLDOWN_MS) return;
  await generateTopic(sessionId);
}

function latestTopic(s: Pick<Session, "topics">): Topic | null {
  const t = s.topics.at(-1);
  if (!t?.title) return null;
  return { title: t.title, description: t.description, questions: t.questions, level: t.level };
}

/** Picks a random topic from the topic bank for the pair's level and sends it to the room. */
async function generateTopic(sessionId: string) {
  const state = roomState(sessionId);
  const io = getIO();
  const room = conversationRoom(sessionId);
  state.topicLoading = true;
  state.topicError = null;
  state.lastTopicRequestAt = Date.now();

  try {
    const session = await findSession(sessionId);
    if (!session || !isOpen(session)) return;

    const level = lowerLevel(session.userALevel as Topic["level"], session.userBLevel as Topic["level"]);
    // Avoid repeating topics from this call and either person's recent calls.
    const recent = await db
      .select({ topics: sessions.topics })
      .from(sessions)
      .where(and(ne(sessions.id, sessionId), or(involvesUser(session.userA), involvesUser(session.userB))))
      .orderBy(desc(sessions.createdAt))
      .limit(10);
    const used = [...session.topics, ...recent.flatMap((s) => s.topics)].map((t) => t.title).filter(Boolean);

    const topic = pickRandomTopic(level, used, latestTopic(session)?.title);
    const stored = { ...topic, shownAt: new Date().toISOString() };
    const updated = await db
      .update(sessions)
      .set({ topics: sql`${sessions.topics} || ${JSON.stringify([stored])}::jsonb` })
      .where(and(eq(sessions.id, sessionId), inArray(sessions.status, [...OPEN_STATUSES])))
      .returning({ id: sessions.id });
    if (updated.length) io.to(room).emit("topic:update", { topic, loading: false });
  } catch (err) {
    console.error("[topic] Couldn't pick a topic:", err);
    state.topicError = "Couldn't load a topic right now. Try again in a moment.";
    io.to(room).emit("topic:update", { topic: null, loading: false, error: state.topicError });
  } finally {
    state.topicLoading = false;
  }
}

export async function addTranscriptSegment(socket: AppSocket, input: TranscriptSegmentInput) {
  const userId = socket.data.userId;
  const state = rooms.get(input.roomId);
  if (!state || state.sockets.get(userId) !== socket.id) return;
  if (state.segmentCount >= MAX_SEGMENTS_PER_SESSION) return;
  const now = Date.now();
  if (now - (state.lastSegmentAt.get(userId) ?? 0) < MIN_SEGMENT_INTERVAL_MS) return;

  const session = await findSession(input.roomId);
  // Consent is snapshotted at match time; without it nothing is stored (the database enforces this too).
  if (!session || session.status !== "active" || !session.startedAt || !participantOf(session, userId)?.transcriptionConsent) {
    return;
  }

  const segment = sanitizeSegment(input, session.startedAt, now);
  if (!segment) return;
  state.lastSegmentAt.set(userId, now);
  state.segmentCount++;
  await db.insert(transcriptLines).values({
    sessionId: session.id,
    userId,
    text: segment.text,
    spokenAt: segment.startedAt,
    endedAt: segment.endedAt,
    confidence: segment.confidence,
  });
  // Feed the real-time AI moderation window (in memory; the sweeper scans it periodically).
  recordForModeration(session.id, userId, segment.text, segment.startedAt);
}

/**
 * Buffers one camera frame for real-time AI vision moderation. Frames are validated, throttled per
 * user, kept only in memory until the next sweep, and never written to the database or any file.
 */
export async function addVideoFrame(socket: AppSocket, input: FrameSampleInput) {
  const userId = socket.data.userId;
  const state = rooms.get(input.roomId);
  if (!state || state.sockets.get(userId) !== socket.id) return;
  if (!FRAME_MIME_TYPES.includes(input.mimeType)) return;
  if (typeof input.data !== "string" || input.data.length === 0 || input.data.length > MAX_FRAME_CHARS) return;
  const now = Date.now();
  if (now - (state.lastFrameAt.get(userId) ?? 0) < MIN_FRAME_INTERVAL_MS) return;

  const session = await findSession(input.roomId);
  // Consent is snapshotted at match time; without it no frame is even buffered.
  if (!session || session.status !== "active" || !session.startedAt || !participantOf(session, userId)?.transcriptionConsent) {
    return;
  }

  state.lastFrameAt.set(userId, now);
  recordFrameForModeration(session.id, userId, input.mimeType, input.data, new Date(now));
}

/**
 * Awards XP to both participants for a finished call, each in their own try/catch so one
 * failure can't cost the other their XP. Runs in the background: the client is told by the
 * `xp:awarded` event, not by the response that ended the call.
 */
async function awardXpToParticipants(ended: Session) {
  const talkSeconds = sessionDurationSeconds(ended);
  const io = getIO();
  for (const { userId } of participantsOf(ended)) {
    try {
      const award = await awardXpForSession({ userId, sessionId: ended.id, talkSeconds });
      // Null means the call was too short to earn anything, or XP was already granted.
      if (award) io.to(userRoom(userId)).emit("xp:awarded", award);
    } catch (err) {
      console.error(`[xp] Award failed for ${userId} in session ${ended.id}:`, err);
    }
  }
}

/** Ends a session exactly once, notifies both users and starts feedback. */
export async function endSession(sessionId: string, byUserId: string | null, reason: RoomEndReason) {
  const [ended] = isUuid(sessionId)
    ? await db
        .update(sessions)
        .set({ status: "ended", endedAt: new Date(), endReason: reason, endedBy: byUserId })
        .where(and(eq(sessions.id, sessionId), inArray(sessions.status, [...OPEN_STATUSES])))
        .returning()
    : [];

  const state = rooms.get(sessionId);
  if (state) for (const key of [...state.timers.keys()]) clearTimer(state, key);
  rooms.delete(sessionId);
  clearModerationBuffer(sessionId);
  if (!ended) return;

  const io = getIO();
  for (const p of participantsOf(ended)) {
    io.to(userRoom(p.userId)).emit("room:ended", {
      conversationId: sessionId,
      reason,
      byPartner: byUserId !== null && byUserId !== p.userId,
    });
  }
  io.in(conversationRoom(sessionId)).socketsLeave(conversationRoom(sessionId));

  // Both only make sense for a call that actually started (both people in the room).
  if (ended.startedAt) {
    void generateConversationFeedback(sessionId);
    void awardXpToParticipants(ended);
  }
}
