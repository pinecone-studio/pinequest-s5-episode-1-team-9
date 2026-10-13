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
 * Returns the app's row for a Clerk user, creating it on first sign-in. Clerk keeps the credentials;
 * the row holds a copy of the primary email, the public username and learning settings.
 */
export async function findOrCreateUser(clerkUserId: string): Promise<User> {
  const existing = await findUserById(clerkUserId);
  if (existing && (existing.email || existing.deletedAt)) return existing;

  const clerkUser = await clerkClient.users.getUser(clerkUserId);
  const email = clerkUser.primaryEmailAddress?.emailAddress ?? null;
  if (existing) return email ? updateUser(existing.id, { email }) : existing;

  const base = usernameBase(clerkUser);
  for (let attempt = 0; attempt < 6; attempt++) {
    const name = attempt === 0 ? base : `${base}_${Math.floor(1000 + Math.random() * 9000)}`;
    try {
      const [created] = await db.insert(users).values({ id: clerkUserId, name, email }).onConflictDoNothing({ target: users.id }).returning();
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

export function isOnboarded(user: Pick<User, "nativeLang" | "targetLanguages" | "targetLang" | "rulesAcceptedAt">) {
  return Boolean(user.nativeLang && user.targetLang && user.targetLanguages.length && user.rulesAcceptedAt);
}

export function activeLanguageProfile(user: Pick<User, "targetLanguages" | "targetLang">, language?: string) {
  const code = language ?? user.targetLang;
  return user.targetLanguages.find((t) => t.language === code) ?? null;
}

export function toUserDTO(user: User): UserDTO {
  return {
    id: user.id,
    username: user.name,
    nativeLanguage: user.nativeLang,
    targetLanguages: user.targetLanguages.map((t) => ({
      language: t.language,
      level: t.level,
      levelSource: t.levelSource ?? "self",
      estimatedPerformance: t.estimatedPerformance ?? null,
    })),
    activeTargetLanguage: user.targetLang,
    privacy: {
      transcriptionConsent: user.transcriptionConsent,
      retainTranscripts: user.retainTranscripts,
    },
    rulesAcceptedAt: user.rulesAcceptedAt?.toISOString() ?? null,
    onboarded: isOnboarded(user),
  };
}
