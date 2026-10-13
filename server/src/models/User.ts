import { clerkClient } from "@clerk/express";
import type { CefrLevel, LanguageProfile, UserDTO } from "@linguamatch/shared";
import { eq } from "drizzle-orm";
import { db, isUniqueViolation, type DB } from "../db/client";
import { users } from "../db/schema";

export type User = typeof users.$inferSelect;
export type UserPatch = Partial<Omit<typeof users.$inferInsert, "id" | "createdAt" | "updatedAt">>;

export const USERNAME_RE = /^[A-Za-z0-9_]{3,24}$/;

export async function findUserById(id: string, tx: DB = db): Promise<User | null> {
  const [user] = await tx.select().from(users).where(eq(users.id, id));
  return user ?? null;
}

export async function updateUser(id: string, patch: UserPatch): Promise<User> {
  const [user] = await db.update(users).set(patch).where(eq(users.id, id)).returning();
  if (!user) throw new Error(`User ${id} not found`);
  return user;
}

/** A valid username derived from the Clerk profile. Partners see it, so the email domain is never used. */
function usernameBase(clerkUser: { username: string | null; firstName: string | null; primaryEmailAddress?: { emailAddress: string } | null }) {
  const candidates = [clerkUser.username, clerkUser.firstName, clerkUser.primaryEmailAddress?.emailAddress.split("@")[0]];
  for (const raw of candidates) {
    const cleaned = (raw ?? "").replace(/[^A-Za-z0-9_]/g, "").slice(0, 18);
    if (cleaned.length >= 3) return cleaned;
  }
  return "learner";
}

/**
 * Returns the app's row for a Clerk user, creating it on first sign-in. Clerk keeps the email and
 * credentials; only the public username and learning settings live here.
 */
export async function findOrCreateUser(clerkUserId: string): Promise<User> {
  const existing = await findUserById(clerkUserId);
  if (existing) return existing;

  const base = usernameBase(await clerkClient.users.getUser(clerkUserId));
  for (let attempt = 0; attempt < 6; attempt++) {
    const username = attempt === 0 ? base : `${base}_${Math.floor(1000 + Math.random() * 9000)}`;
    try {
      const [created] = await db.insert(users).values({ id: clerkUserId, username }).onConflictDoNothing({ target: users.id }).returning();
      // Another request for the same new user won the race.
      return created ?? (await findUserById(clerkUserId))!;
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
    }
  }
  throw new Error(`Couldn't find a free username for ${clerkUserId}`);
}

/** Sets the level for a language, adding it to the end of the list if it's new. */
export function withLanguageLevel(
  user: Pick<User, "targetLanguages">,
  language: string,
  level: CefrLevel,
  levelSource: LanguageProfile["levelSource"],
): LanguageProfile[] {
  return user.targetLanguages.some((t) => t.language === language)
    ? user.targetLanguages.map((t) => (t.language === language ? { ...t, level, levelSource } : t))
    : [...user.targetLanguages, { language, level, levelSource, estimatedPerformance: null }];
}

export function isOnboarded(user: Pick<User, "nativeLanguage" | "targetLanguages" | "activeTargetLanguage" | "rulesAcceptedAt">) {
  return Boolean(user.nativeLanguage && user.activeTargetLanguage && user.targetLanguages.length && user.rulesAcceptedAt);
}

export function activeLanguageProfile(user: Pick<User, "targetLanguages" | "activeTargetLanguage">, language?: string) {
  const code = language ?? user.activeTargetLanguage;
  return user.targetLanguages.find((t) => t.language === code) ?? null;
}

export function toUserDTO(user: User): UserDTO {
  return {
    id: user.id,
    username: user.username,
    nativeLanguage: user.nativeLanguage,
    targetLanguages: user.targetLanguages.map((t) => ({
      language: t.language,
      level: t.level,
      levelSource: t.levelSource ?? "self",
      estimatedPerformance: t.estimatedPerformance ?? null,
    })),
    activeTargetLanguage: user.activeTargetLanguage,
    privacy: {
      transcriptionConsent: user.transcriptionConsent,
      retainTranscripts: user.retainTranscripts,
    },
    rulesAcceptedAt: user.rulesAcceptedAt?.toISOString() ?? null,
    onboarded: isOnboarded(user),
  };
}
