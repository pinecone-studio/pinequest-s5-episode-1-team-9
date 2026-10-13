import { isUuid } from "../db/client";
import { canUseEmoji } from "../services/xp/levels";
import { getXpLevel } from "../services/xp/xpService";
import { conversationRoom, type AppSocket, type IO } from "./io";

const RATE_LIMIT_MS = 2000;
const LEVEL_CACHE_MS = 60_000;

/**
 * Emoji reactions, gated by the sender's xp_level. Reactions are relayed to the
 * conversation room and never stored — they're ephemeral, like the call itself.
 */
export function registerEmojiHandlers(io: IO, socket: AppSocket) {
  socket.on("emoji:send", async (payload, ack) => {
    const reply = typeof ack === "function" ? ack : () => {};
    const userId = socket.data.userId;
    const { roomId, emoji } = payload ?? ({} as { roomId: string; emoji: string });

    if (!isUuid(roomId) || typeof emoji !== "string" || !emoji) {
      return reply({ ok: false, error: "invalid" });
    }

    // joinRoom() puts the socket in `conversation:<id>`, not in the bare room id.
    const room = conversationRoom(roomId);
    if (!socket.rooms.has(room)) return reply({ ok: false, error: "not_in_room" });

    const now = Date.now();
    if (now - (socket.data.lastEmojiAt ?? 0) < RATE_LIMIT_MS) {
      return reply({ ok: false, error: "rate_limited" });
    }

    const cache = socket.data.xpLevelCache;
    let level = cache && now - cache.at < LEVEL_CACHE_MS ? cache.level : null;
    if (level === null) {
      level = await getXpLevel(userId);
      socket.data.xpLevelCache = { level, at: now };
    }
    if (!canUseEmoji(emoji, level)) return reply({ ok: false, error: "locked" });

    socket.data.lastEmojiAt = now;
    io.to(room).emit("emoji:reaction", { emoji, fromUserId: userId, at: now });
    reply({ ok: true });
  });
}
