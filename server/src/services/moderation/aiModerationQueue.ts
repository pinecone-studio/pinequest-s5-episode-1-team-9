/**
 * In-memory buffer of freshly recognized speech, kept per active conversation, for real-time
 * AI moderation. Deliberately dependency-free (no DB, no socket, no AI) so that roomService can
 * feed it without creating an import cycle with the moderation sweeper.
 *
 * Transcripts are already stored in the database; this only holds the delta since the last scan.
 */

export interface BufferedUtterance {
  /** The speaker's user id; the sweeper maps it to "a"/"b" using the session. */
  userId: string;
  text: string;
  spokenAt: Date;
}

const buffers = new Map<string, BufferedUtterance[]>();

/** Appends one utterance to a conversation's pending moderation window. */
export function recordForModeration(sessionId: string, userId: string, text: string, spokenAt: Date): void {
  const trimmed = text.trim();
  if (!trimmed) return;
  const list = buffers.get(sessionId);
  if (list) list.push({ userId, text: trimmed, spokenAt });
  else buffers.set(sessionId, [{ userId, text: trimmed, spokenAt }]);
}

/** Number of pending utterances for a conversation. */
export function moderationBacklog(sessionId: string): number {
  return buffers.get(sessionId)?.length ?? 0;
}

/** Session ids that currently have pending utterances. */
export function sessionsWithModerationBacklog(): string[] {
  return [...buffers.keys()];
}

/**
 * Removes and returns the pending utterances for a conversation. The sweeper takes a snapshot
 * before calling the model so a slow request can't re-send the same text or grow unbounded.
 */
export function drainModerationBuffer(sessionId: string): BufferedUtterance[] {
  const list = buffers.get(sessionId) ?? [];
  buffers.delete(sessionId);
  return list;
}

/** Drops any pending utterances (call when a conversation ends). */
export function clearModerationBuffer(sessionId: string): void {
  buffers.delete(sessionId);
}
