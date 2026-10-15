import { isTargetLanguage } from "@linguamatch/shared";
import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { isAllowedOrigin } from "../config/env";
import { isUuid as isRoomId } from "../db/client";
import { Matchmaker, QueueError } from "../services/matchmaking/matchmaker";
import {
  acceptCall,
  cancelCall,
  cancelCallsFor,
  declineCall,
  setQueuedCheck,
  startCall,
} from "../services/friends/friendCalls";
import { assist, creditCaption, refreshSuggestions, sendMessage, syncChat } from "../services/chat/chatService";
import { endRoleplay, startRoleplay, syncRoleplay } from "../services/roleplay/roleplayService";
import { findOrCreateUser } from "../models/User";
import {
  addTranscriptSegment,
  addVideoFrame,
  createSessionFromMatch,
  endSession,
  handleSocketDisconnect,
  joinRoom,
  relaySignal,
  requestTopic,
} from "../services/rooms/roomService";
import { logAuthFailure, verifySessionToken } from "../utils/auth";
import { registerEmojiHandlers } from "./emojiHandlers";
import { setIO, userRoom, type AppSocket, type IO } from "./io";

export let matchmaker: Matchmaker;

/** Wraps a handler so a thrown error is logged instead of crashing the process. */
function safe<A extends unknown[]>(socket: AppSocket, fn: (...args: A) => Promise<void> | void) {
  return (...args: A) => {
    Promise.resolve()
      .then(() => fn(...args))
      .catch((err) => {
        console.error(`[socket] ${socket.data.userId}:`, err);
      });
  };
}

export function createSocketServer(httpServer: HttpServer): IO {
  const io: IO = new Server(httpServer, {
    cors: { origin: (origin, cb) => cb(null, isAllowedOrigin(origin)), credentials: true },
    maxHttpBufferSize: 64 * 1024,
  });
  setIO(io);

  // Auth uses the Clerk session token from the handshake `auth` payload, never cookies: the socket
  // server lives on another site, where the web app's cookies are third-party and get blocked.
  // CORS doesn't cover WebSocket upgrades, so the origin is checked here as well.
  io.use((socket, next) => {
    const origin = socket.handshake.headers.origin;
    if (!isAllowedOrigin(origin)) {
      logAuthFailure("socket", "wrong_origin", { origin });
      return next(new Error("forbidden_origin"));
    }
    const token = socket.handshake.auth?.token;
    // The client reads `message` to decide whether to fetch a fresh token and retry.
    const reject = (reason: string) => next(Object.assign(new Error("unauthorized"), { data: { reason } }));
    void (async () => {
      const result = await verifySessionToken(typeof token === "string" ? token : null);
      if (!result.ok) {
        logAuthFailure("socket", result.reason, { origin });
        return reject(result.reason);
      }
      const user = await findOrCreateUser(result.userId);
      if (user.deletedAt) {
        logAuthFailure("socket", "deleted_user", { origin });
        return reject("deleted_user");
      }
      socket.data.userId = user.id;
      next();
    })().catch((err) => {
      console.error("[socket] auth failed:", err);
      next(new Error("server_error"));
    });
  });

  matchmaker = new Matchmaker(createSessionFromMatch);
  matchmaker.start();
  setQueuedCheck((userId) => matchmaker.isWaiting(userId));

  io.on("connection", (socket: AppSocket) => {
    const userId = socket.data.userId;
    void socket.join(userRoom(userId));
    registerEmojiHandlers(io, socket);

    socket.on(
      "queue:join",
      safe(socket, async (payload) => {
        if (!isTargetLanguage(payload?.targetLanguage)) {
          socket.emit("queue:error", { message: "Unsupported language" });
          return;
        }
        try {
          await matchmaker.join(userId, socket.id, payload.targetLanguage);
        } catch (err) {
          if (err instanceof QueueError) socket.emit("queue:error", { message: err.message });
          else throw err;
        }
      }),
    );

    socket.on("queue:leave", safe(socket, () => matchmaker.leave(userId)));

    socket.on(
      "room:join",
      safe(socket, async (payload) => {
        if (isRoomId(payload?.roomId)) await joinRoom(socket, payload.roomId);
      }),
    );

    socket.on(
      "room:leave",
      safe(socket, async (payload) => {
        if (!isRoomId(payload?.roomId)) return;
        await endSession(payload.roomId, userId, payload.reason === "next" ? "next" : "ended");
      }),
    );

    socket.on(
      "signal",
      safe(socket, async (payload) => {
        if (!isRoomId(payload?.roomId) || !payload.data || typeof payload.data !== "object") return;
        await relaySignal(socket, payload.roomId, payload.data);
      }),
    );

    socket.on(
      "topic:request",
      safe(socket, async (payload) => {
        if (isRoomId(payload?.roomId)) await requestTopic(socket, payload.roomId);
      }),
    );

    socket.on(
      "transcript:segment",
      safe(socket, async (payload) => {
        if (isRoomId(payload?.roomId)) await addTranscriptSegment(socket, payload);
      }),
    );

    socket.on(
      "frame:sample",
      safe(socket, async (payload) => {
        if (isRoomId(payload?.roomId)) await addVideoFrame(socket, payload);
      }),
    );

    socket.on(
      "chat:send",
      safe(socket, async (payload) => {
        if (isRoomId(payload?.roomId)) await sendMessage(payload.roomId, userId, payload.text);
      }),
    );

    socket.on(
      "chat:sync",
      safe(socket, (payload) => {
        if (isRoomId(payload?.roomId)) syncChat(payload.roomId, userId);
      }),
    );

    socket.on(
      "chat:assist",
      safe(socket, async (payload) => {
        if (isRoomId(payload?.roomId)) await assist(payload.roomId, userId, payload.draft);
      }),
    );

    socket.on(
      "chat:suggest",
      safe(socket, async (payload) => {
        if (isRoomId(payload?.roomId)) await refreshSuggestions(payload.roomId, userId, payload);
      }),
    );

    socket.on(
      "chat:caption",
      safe(socket, async (payload) => {
        if (isRoomId(payload?.roomId)) await creditCaption(payload.roomId, userId, payload.text);
      }),
    );

    socket.on(
      "roleplay:start",
      safe(socket, async (payload) => {
        if (isRoomId(payload?.roomId)) await startRoleplay(payload.roomId, userId);
      }),
    );

    socket.on(
      "roleplay:end",
      safe(socket, async (payload) => {
        if (isRoomId(payload?.roomId)) await endRoleplay(payload.roomId, userId);
      }),
    );

    socket.on(
      "roleplay:sync",
      safe(socket, (payload) => {
        if (isRoomId(payload?.roomId)) syncRoleplay(payload.roomId, userId);
      }),
    );

    socket.on(
      "friend:call",
      safe(socket, async (payload) => {
        if (typeof payload?.friendId === "string" && payload.friendId) await startCall(userId, payload.friendId);
      }),
    );

    socket.on(
      "friend:accept",
      safe(socket, async (payload) => {
        if (isRoomId(payload?.inviteId)) await acceptCall(userId, payload.inviteId);
      }),
    );

    socket.on(
      "friend:decline",
      safe(socket, (payload) => {
        if (isRoomId(payload?.inviteId)) declineCall(userId, payload.inviteId);
      }),
    );

    socket.on(
      "friend:cancel",
      safe(socket, (payload) => {
        if (isRoomId(payload?.inviteId)) cancelCall(userId, payload.inviteId);
      }),
    );

    socket.on(
      "disconnect",
      safe(socket, async () => {
        handleSocketDisconnect(socket);
        // Only drop the queue entry if this was the socket that queued.
        const remaining = await io.in(userRoom(userId)).fetchSockets();
        if (remaining.length === 0) {
          cancelCallsFor(userId);
          await matchmaker.leave(userId, "expired");
        }
      }),
    );
  });

  return io;
}
