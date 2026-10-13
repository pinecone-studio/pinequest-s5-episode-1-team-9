import type { ClientToServerEvents, ServerToClientEvents } from "@linguamatch/shared";
import type { Server, Socket } from "socket.io";

export interface SocketData {
  userId: string;
  /** Epoch ms of this socket's last emoji, for per-socket rate limiting. */
  lastEmojiAt?: number;
  /** Short-lived xp_level cache so every reaction doesn't hit the database. */
  xpLevelCache?: { level: number; at: number };
}

export type IO = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
export type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

let io: IO | null = null;

export function setIO(server: IO) {
  io = server;
}

export function getIO(): IO {
  if (!io) throw new Error("Socket.IO server not initialized");
  return io;
}

/** Every socket belongs to a per-user room so services can reach all of a user's tabs. */
export const userRoom = (userId: string) => `user:${userId}`;
export const conversationRoom = (conversationId: string) => `conversation:${conversationId}`;