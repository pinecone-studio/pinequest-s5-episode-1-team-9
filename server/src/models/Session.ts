import type { CefrLevel } from "@linguamatch/shared";
import { eq, or } from "drizzle-orm";
import { db, isUuid, type DB } from "../db/client";
import { sessions } from "../db/schema";

export type Session = typeof sessions.$inferSelect;

/** One side of a session. Index 0 (user A) is the WebRTC caller. */
export interface Participant {
  userId: string;
  level: CefrLevel;
  transcriptionConsent: boolean;
  joinedAt: Date | null;
}

export async function findSession(id: string, tx: DB = db): Promise<Session | null> {
  if (!isUuid(id)) return null;
  const [session] = await tx.select().from(sessions).where(eq(sessions.id, id));
  return session ?? null;
}

export function participantsOf(s: Session): [Participant, Participant] {
  return [
    { userId: s.userA, level: s.userALevel as CefrLevel, transcriptionConsent: s.userATranscriptionConsent, joinedAt: s.userAJoinedAt },
    { userId: s.userB, level: s.userBLevel as CefrLevel, transcriptionConsent: s.userBTranscriptionConsent, joinedAt: s.userBJoinedAt },
  ];
}

export function participantOf(s: Session, userId: string): Participant | null {
  return participantsOf(s).find((p) => p.userId === userId) ?? null;
}

export function partnerIdOf(s: Session, userId: string): string | null {
  if (s.userA === userId) return s.userB;
  if (s.userB === userId) return s.userA;
  return null;
}

/** Sessions the user took part in, on either side. */
export const involvesUser = (userId: string) => or(eq(sessions.userA, userId), eq(sessions.userB, userId));

/** Talk time: from the moment both people were in the room until the end. */
export function sessionDurationSeconds(s: Pick<Session, "startedAt" | "endedAt">): number {
  if (!s.startedAt) return 0;
  const end = s.endedAt ?? new Date();
  return Math.max(0, Math.round((end.getTime() - s.startedAt.getTime()) / 1000));
}
