import { and, desc, eq, inArray, lt } from "drizzle-orm";
import { env } from "../../config/env";
import { db } from "../../db/client";
import { queue, recentPartners } from "../../db/schema";
import { activeLanguageProfile, findUserById, isOnboarded } from "../../models/User";
import { getIO, userRoom } from "../../socket/io";
import { blockedUserIds, findActiveBan } from "../moderation/moderationService";
import { DEFAULT_MATCH_OPTIONS, findMatches, type MatchOptions, type MatchPair, type QueueEntry } from "./algorithm";

interface LiveEntry extends QueueEntry {
  queueRowId: number;
}

export class QueueError extends Error {}

type MatchHandler = (pair: MatchPair) => Promise<string>;

const RESOLVED_ENTRY_RETENTION_MS = 7 * 24 * 3600 * 1000;
const RECENT_PARTNERS_LOADED = 10;

/** Keeps finished queue entries for a week for debugging matchmaking, then drops them. */
export async function pruneResolvedQueueEntries(): Promise<void> {
  await db.delete(queue).where(lt(queue.resolvedAt, new Date(Date.now() - RESOLVED_ENTRY_RETENTION_MS)));
}

/** The live queue is in memory, so rows still "waiting" from a previous process are stale. */
export async function expireStaleQueueEntries(): Promise<void> {
  await db.update(queue).set({ status: "expired", resolvedAt: new Date() }).where(eq(queue.status, "waiting"));
}

/**
 * In-memory matchmaking queue for a single server process. Each entry is mirrored to the
 * queue table. To scale horizontally, move `entries` into Redis and run `tick` on one
 * leader instance.
 */
export class Matchmaker {
  private entries = new Map<string, LiveEntry>();
  private timer: NodeJS.Timeout | null = null;
  private ticking = false;

  constructor(
    private onMatch: MatchHandler,
    private opts: MatchOptions = {
      ...DEFAULT_MATCH_OPTIONS,
      maxLevelDistance: env.MATCH_MAX_LEVEL_DISTANCE,
      expandAfterSeconds: env.MATCH_EXPAND_AFTER_SECONDS,
      recentPartnerWindow: env.MATCH_RECENT_PARTNER_WINDOW,
    },
  ) {}

  start(intervalMs = 1000) {
    this.timer ??= setInterval(() => void this.tick(), intervalMs);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  isWaiting(userId: string) {
    return this.entries.has(userId);
  }

  async join(userId: string, socketId: string, targetLanguage: string): Promise<LiveEntry> {
    const user = await findUserById(userId);
    if (!user || user.deletedAt) throw new QueueError("Account not found");
    if (!isOnboarded(user)) throw new QueueError("Finish setting up your languages first");
    if (await findActiveBan(userId)) throw new QueueError("Your account is temporarily suspended from matching");

    const profile = activeLanguageProfile(user, targetLanguage);
    if (!profile) throw new QueueError("Add this language to your profile before practicing it");

    // Re-joining (e.g. a second tab) replaces the previous entry.
    await this.leave(userId, "cancelled");

    const [blocked, recent] = await Promise.all([
      blockedUserIds(userId),
      db
        .select({ partnerId: recentPartners.partnerId })
        .from(recentPartners)
        .where(eq(recentPartners.userId, userId))
        .orderBy(desc(recentPartners.metAt))
        .limit(RECENT_PARTNERS_LOADED),
    ]);
    const [row] = await db
      .insert(queue)
      .values({ userId, nativeLanguage: user.nativeLang, lang: targetLanguage, level: profile.level })
      .returning({ id: queue.id });

    const entry: LiveEntry = {
      queueRowId: row!.id,
      userId,
      socketId,
      nativeLanguage: user.nativeLang,
      targetLanguage,
      level: profile.level,
      joinedAt: Date.now(),
      blocked,
      recentPartners: recent.map((r) => r.partnerId),
    };
    this.entries.set(userId, entry);
    this.broadcastStatus(targetLanguage);
    void this.tick();
    return entry;
  }

  async leave(userId: string, status: "cancelled" | "expired" = "cancelled") {
    const entry = this.entries.get(userId);
    if (!entry) return;
    this.entries.delete(userId);
    await db
      .update(queue)
      .set({ status, resolvedAt: new Date() })
      .where(and(eq(queue.id, entry.queueRowId), eq(queue.status, "waiting")));
    this.broadcastStatus(entry.targetLanguage);
  }

  waitingCount(targetLanguage: string): number {
    let n = 0;
    for (const e of this.entries.values()) if (e.targetLanguage === targetLanguage) n++;
    return n;
  }

  private broadcastStatus(targetLanguage: string) {
    const io = getIO();
    const waiting = this.waitingCount(targetLanguage);
    for (const e of this.entries.values()) {
      if (e.targetLanguage !== targetLanguage) continue;
      io.to(userRoom(e.userId)).emit("queue:status", { waiting, targetLanguage, level: e.level });
    }
  }

  async tick() {
    if (this.ticking || this.entries.size < 2) return;
    this.ticking = true;
    try {
      const pairs = findMatches([...this.entries.values()], Date.now(), this.opts);
      for (const pair of pairs) {
        const a = this.entries.get(pair.a.userId);
        const b = this.entries.get(pair.b.userId);
        if (!a || !b) continue;
        this.entries.delete(a.userId);
        this.entries.delete(b.userId);

        try {
          const sessionId = await this.onMatch(pair);
          await db
            .update(queue)
            .set({ status: "matched", sessionId, resolvedAt: new Date() })
            .where(inArray(queue.id, [a.queueRowId, b.queueRowId]));
          const io = getIO();
          io.to(userRoom(a.userId)).emit("queue:matched", { roomId: sessionId });
          io.to(userRoom(b.userId)).emit("queue:matched", { roomId: sessionId });
        } catch (err) {
          console.error("[match] Failed to create room, requeueing both users:", err);
          this.entries.set(a.userId, a);
          this.entries.set(b.userId, b);
        }
        this.broadcastStatus(a.targetLanguage);
      }
    } finally {
      this.ticking = false;
    }
  }
}
