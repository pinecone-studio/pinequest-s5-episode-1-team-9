import { clerkClient } from "@clerk/express";
import { CEFR_LEVELS, isNativeLanguage, isTargetLanguage } from "@linguamatch/shared";
import { and, asc, eq, inArray, or } from "drizzle-orm";
import { Router } from "express";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { db, isUniqueViolation } from "../db/client";
import { feedbackReports, queue, recentPartners, sessions, transcriptLines, userBlocks, users } from "../db/schema";
import { currentUser, requireAuth } from "../middleware/auth";
import { involvesUser } from "../models/Session";
import { USERNAME_RE, toUserDTO, updateUser, withLanguageLevel, type UserPatch } from "../models/User";
import { matchmaker } from "../socket";
import { unblockUser } from "../services/moderation/moderationService";
import { buildProfileStats } from "../services/profile/profileService";
import { endSession } from "../services/rooms/roomService";
import { HttpError, parseBody } from "../utils/http";

export const usersRouter = Router();
usersRouter.use(requireAuth);

const nativeLanguage = z.string().refine(isNativeLanguage, "Unsupported language");
const targetLanguage = z.string().refine(isTargetLanguage, "Unsupported language");
const username = z.string().trim().regex(USERNAME_RE, "Use 3–24 letters, numbers and underscores");

/** Saves a patch, turning a taken username into a 409 instead of a 500. */
async function saveUser(id: string, patch: UserPatch) {
  try {
    return await updateUser(id, patch);
  } catch (err) {
    if (isUniqueViolation(err)) throw new HttpError(409, "That username is already taken");
    throw err;
  }
}

const OnboardingSchema = z.object({
  username: username.optional(),
  nativeLanguage,
  targetLanguage,
  level: z.enum(CEFR_LEVELS),
  acceptRules: z.literal(true, { error: "You must accept the community rules" }),
  transcriptionConsent: z.boolean(),
});

usersRouter.post("/onboarding", async (req, res) => {
  const body = parseBody(OnboardingSchema, req.body);
  if (body.nativeLanguage === body.targetLanguage) {
    throw new HttpError(400, "Pick a target language different from your native language");
  }
  const user = currentUser(req);
  const updated = await saveUser(user.id, {
    ...(body.username && { username: body.username }),
    nativeLanguage: body.nativeLanguage,
    targetLanguages: withLanguageLevel(user, body.targetLanguage, body.level, "self"),
    activeTargetLanguage: body.targetLanguage,
    rulesAcceptedAt: user.rulesAcceptedAt ?? new Date(),
    transcriptionConsent: body.transcriptionConsent,
  });
  res.json({ user: toUserDTO(updated) });
});

const SettingsSchema = z.object({
  username: username.optional(),
  nativeLanguage: nativeLanguage.optional(),
  activeTargetLanguage: targetLanguage.optional(),
  privacy: z
    .object({ transcriptionConsent: z.boolean().optional(), retainTranscripts: z.boolean().optional() })
    .optional(),
});

usersRouter.patch("/settings", async (req, res) => {
  const body = parseBody(SettingsSchema, req.body);
  const user = currentUser(req);
  const patch: UserPatch = {};
  if (body.username && body.username !== user.username) patch.username = body.username;
  if (body.nativeLanguage) patch.nativeLanguage = body.nativeLanguage;
  if (body.activeTargetLanguage) {
    if (!user.targetLanguages.some((t) => t.language === body.activeTargetLanguage)) {
      throw new HttpError(400, "Add that language first");
    }
    patch.activeTargetLanguage = body.activeTargetLanguage;
  }
  if (body.privacy?.transcriptionConsent !== undefined) patch.transcriptionConsent = body.privacy.transcriptionConsent;
  if (body.privacy?.retainTranscripts !== undefined) patch.retainTranscripts = body.privacy.retainTranscripts;
  const updated = Object.keys(patch).length ? await saveUser(user.id, patch) : user;
  res.json({ user: toUserDTO(updated) });
});

usersRouter.put("/languages/:code", async (req, res) => {
  const code = req.params.code;
  if (!isTargetLanguage(code)) throw new HttpError(400, "Unsupported language");
  const { level } = parseBody(z.object({ level: z.enum(CEFR_LEVELS) }), req.body);
  const user = currentUser(req);
  if (code === user.nativeLanguage) throw new HttpError(400, "That's your native language");
  const updated = await updateUser(user.id, {
    targetLanguages: withLanguageLevel(user, code, level, "self"),
    activeTargetLanguage: user.activeTargetLanguage ?? code,
  });
  res.json({ user: toUserDTO(updated) });
});

usersRouter.delete("/languages/:code", async (req, res) => {
  const user = currentUser(req);
  if (user.targetLanguages.length <= 1) throw new HttpError(400, "Keep at least one language");
  const targetLanguages = user.targetLanguages.filter((t) => t.language !== req.params.code);
  const updated = await updateUser(user.id, {
    targetLanguages,
    activeTargetLanguage:
      user.activeTargetLanguage === req.params.code ? (targetLanguages[0]?.language ?? null) : user.activeTargetLanguage,
  });
  res.json({ user: toUserDTO(updated) });
});

usersRouter.get("/profile", async (req, res) => {
  res.json({ profile: await buildProfileStats(currentUser(req)) });
});

usersRouter.get("/blocked", async (req, res) => {
  const rows = await db
    .select({ id: users.id, username: users.username, deletedAt: users.deletedAt })
    .from(userBlocks)
    .innerJoin(users, eq(users.id, userBlocks.blockedId))
    .where(eq(userBlocks.blockerId, currentUser(req).id))
    .orderBy(asc(userBlocks.createdAt));
  res.json({ blocked: rows.map((r) => ({ id: r.id, username: r.deletedAt ? "Deleted user" : r.username })) });
});

usersRouter.delete("/blocked/:id", async (req, res) => {
  await unblockUser(currentUser(req).id, req.params.id);
  res.status(204).end();
});

/**
 * Deletes the account. Personal content (transcripts, feedback, queue, partners, blocks) is
 * removed; the user row is anonymized and soft-deleted so other people's sessions, reports and
 * moderation history stay intact. The Clerk user is deleted last, which signs out every device.
 */
usersRouter.delete("/", async (req, res) => {
  const user = currentUser(req);
  await matchmaker.leave(user.id);
  const open = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(and(inArray(sessions.status, ["pending", "active"]), involvesUser(user.id)))
    .then((rows) => rows.map((r) => r.id));
  for (const id of open) await endSession(id, user.id, "partner_left");

  await db.transaction(async (tx) => {
    const mine = tx.select({ id: sessions.id }).from(sessions).where(involvesUser(user.id));
    await tx.delete(transcriptLines).where(inArray(transcriptLines.sessionId, mine));
    await tx.update(sessions).set({ transcriptPurgedAt: new Date() }).where(involvesUser(user.id));
    // Mistakes cascade from feedback reports.
    await tx.delete(feedbackReports).where(eq(feedbackReports.userId, user.id));
    await tx.delete(queue).where(eq(queue.userId, user.id));
    await tx.delete(recentPartners).where(or(eq(recentPartners.userId, user.id), eq(recentPartners.partnerId, user.id)));
    await tx.delete(userBlocks).where(or(eq(userBlocks.blockerId, user.id), eq(userBlocks.blockedId, user.id)));
    await tx
      .update(users)
      .set({
        username: `deleted_${randomBytes(6).toString("hex")}`,
        nativeLanguage: null,
        targetLanguages: [],
        activeTargetLanguage: null,
        transcriptionConsent: false,
        retainTranscripts: false,
        deletedAt: new Date(),
      })
      .where(eq(users.id, user.id));
  });

  try {
    await clerkClient.users.deleteUser(user.id);
  } catch (err) {
    console.error(`[account] App data deleted but the Clerk user ${user.id} could not be deleted:`, err);
  }
  res.status(204).end();
});
