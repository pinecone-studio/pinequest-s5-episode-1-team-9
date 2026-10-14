/**
 * In-memory buffer of freshly captured speech and camera frames, kept per active conversation,
 * for real-time AI moderation. Deliberately dependency-free (no DB, no socket, no AI) so that
 * roomService can feed it without creating an import cycle with the moderation sweeper.
 *
 * Transcripts are already stored in the database; camera frames are NEVER stored — they live here
 * only until the next vision check, then are dropped.
 */

export interface BufferedUtterance {
  /** The speaker's user id; the sweeper maps it to "a"/"b" using the session. */
  userId: string;
  text: string;
  spokenAt: Date;
}

export interface BufferedFrame {
  /** The broadcaster's user id; the sweeper maps it to "a"/"b" using the session. */
  userId: string;
  mimeType: string;
  dataBase64: string;
  capturedAt: Date;
}

interface SessionBuffer {
  utterances: BufferedUtterance[];
  frames: BufferedFrame[];
}

/** Newest frames only: bounded so a chatty camera can't grow memory or the vision request. */
const MAX_FRAMES_PER_SESSION = 6;

const buffers = new Map<string, SessionBuffer>();

function buffer(sessionId: string): SessionBuffer {
  let b = buffers.get(sessionId);
  if (!b) {
    b = { utterances: [], frames: [] };
    buffers.set(sessionId, b);
  }
  return b;
}

/** Appends one utterance to a conversation's pending moderation window. */
export function recordForModeration(sessionId: string, userId: string, text: string, spokenAt: Date): void {
  const trimmed = text.trim();
  if (!trimmed) return;
  buffer(sessionId).utterances.push({ userId, text: trimmed, spokenAt });
}

/** Appends one camera frame to a conversation's pending moderation window. */
export function recordFrameForModeration(
  sessionId: string,
  userId: string,
  mimeType: string,
  dataBase64: string,
  capturedAt: Date,
): void {
  const frames = buffer(sessionId).frames;
  frames.push({ userId, mimeType, dataBase64, capturedAt });
  if (frames.length > MAX_FRAMES_PER_SESSION) frames.splice(0, frames.length - MAX_FRAMES_PER_SESSION);
}

/** Number of pending utterances for a conversation. */
export function moderationBacklog(sessionId: string): number {
  return buffers.get(sessionId)?.utterances.length ?? 0;
}

/** Number of pending camera frames for a conversation. */
export function frameBacklog(sessionId: string): number {
  return buffers.get(sessionId)?.frames.length ?? 0;
}

/** Session ids that currently have pending utterances or frames. */
export function sessionsWithModerationBacklog(): string[] {
  return [...buffers.keys()];
}

/**
 * Removes and returns the pending utterances for a conversation. The sweeper takes a snapshot
 * before calling the model so a slow request can't re-send the same text or grow unbounded.
 */
export function drainModerationBuffer(sessionId: string): BufferedUtterance[] {
  const b = buffers.get(sessionId);
  if (!b) return [];
  const utterances = b.utterances;
  b.utterances = [];
  return utterances;
}

/** Removes and returns the pending camera frames for a conversation. */
export function drainFrameBuffer(sessionId: string): BufferedFrame[] {
  const b = buffers.get(sessionId);
  if (!b) return [];
  const frames = b.frames;
  b.frames = [];
  return frames;
}

/** Drops any pending utterances and frames (call when a conversation ends). */
export function clearModerationBuffer(sessionId: string): void {
  buffers.delete(sessionId);
}
