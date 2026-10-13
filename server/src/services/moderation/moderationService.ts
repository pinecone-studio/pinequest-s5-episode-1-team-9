import type { AdminActionType, ReportAiFlag, ReportReason } from "@linguamatch/shared";
import { Types } from "mongoose";
import { env } from "../../config/env";
import { AdminAction } from "../../models/AdminAction";
import { Ban } from "../../models/Ban";
import { Conversation } from "../../models/Conversation";
import { Report } from "../../models/Report";
import { User } from "../../models/User";
import { HttpError } from "../../utils/http";
import { endConversation } from "../rooms/roomService";

const SUSPENSION_HOURS = 24;

/**
 * Reports and blocks are addressed by conversation, never by user id, so the client
 * never learns a stranger's account identifier.
 */
async function partnerIn(conversationId: string, userId: string) {
  if (!Types.ObjectId.isValid(conversationId)) throw new HttpError(404, "Conversation not found");
  const conversation = await Conversation.findById(conversationId).select("participants status");
  const me = conversation?.participants.find((p) => p.userId.toString() === userId);
  const partner = conversation?.participants.find((p) => p.userId.toString() !== userId);
  if (!conversation || !me || !partner) throw new HttpError(404, "Conversation not found");
  return { conversation, partnerId: partner.userId };
}

/** Snapshot of the transcript at report time, so evidence survives normal transcript purging. */
async function snapshotTranscript(conversationId: string) {
  const conversation = await Conversation.findById(conversationId).select("+transcript transcript");
  const lines = conversation?.transcript ?? [];
  return lines.slice(-200).map((line) => ({
    userId: line.userId,
    text: line.text,
    spokenAt: line.endedAt,
  }));
}

export async function blockPartner(userId: string, conversationId: string) {
  const { conversation, partnerId } = await partnerIn(conversationId, userId);
  await User.updateOne({ _id: userId }, { $addToSet: { blockedUsers: partnerId } });
  if (conversation.status === "active") await endConversation(conversationId, userId, "blocked");
}

export interface ReportEvidenceInput {
  /** Set by the browser safety check; "none" means a person tapped Report. */
  aiFlag?: ReportAiFlag;
  /** Up to 3 blurred frames captured around the report. */
  frames?: { url: string; capturedAt: string }[];
  autoReported?: boolean;
}

export async function reportPartner(
  userId: string,
  conversationId: string,
  reason: ReportReason,
  details: string,
  evidence: ReportEvidenceInput = {},
) {
  const { conversation, partnerId } = await partnerIn(conversationId, userId);
  const frames = evidence.frames ?? [];
  const hasEvidence = frames.length > 0;
  const expiresAt = hasEvidence ? new Date(Date.now() + env.EVIDENCE_TTL_DAYS * 24 * 3600 * 1000) : null;
  const aiFlag = evidence.aiFlag ?? "none";

  let report;
  try {
    report = await Report.create({
      reporterId: userId,
      reportedUserId: partnerId,
      conversationId,
      reason,
      details,
      aiFlag,
      autoReported: evidence.autoReported ?? false,
      evidenceFrames: frames.map((f) => ({ url: f.url, capturedAt: new Date(f.capturedAt) })),
      evidenceTranscript: hasEvidence ? await snapshotTranscript(conversationId) : [],
      evidenceExpiresAt: expiresAt,
    });
  } catch (err) {
    if ((err as { code?: number }).code === 11000) throw new HttpError(409, "You already reported this conversation");
    throw err;
  }

  // Reporting always blocks too: you should never be matched with someone you reported.
  await User.updateOne({ _id: userId }, { $addToSet: { blockedUsers: partnerId } });
  if (conversation.status === "active") await endConversation(conversationId, userId, "reported");

  const reportId = report._id.toString();
  if (aiFlag === "nudity") {
    // Automatic nudity detection applies a strike immediately; the report stays open for review.
    await recordStrike(partnerId.toString(), {
      reason: "Automatic nudity detection",
      reportId,
      permanent: reason === "minor",
    });
  } else {
    await applyAutomaticModeration(partnerId, reportId);
  }
}

/** The 24h-permanent escalation used by both automatic checks and manual bans. */
export function banHoursForStrike(strikes: number): number | null {
  if (strikes >= 3) return 7 * 24;
  if (strikes === 2) return 24;
  return null;
}

export interface StrikeInput {
  reason: string;
  reportId?: string | null;
  adminId?: string | null;
  adminUsername?: string | null;
  /** Sexual content involving a minor is a permanent ban. */
  permanent?: boolean;
  deviceFingerprint?: string | null;
}

/**
 * Adds a strike and applies the escalation: 1st = warning, 2nd = 24h ban, 3rd+ = 7-day ban.
 * `permanent` forces a permanent ban (minor + sexual content). Every outcome is audited.
 */
export async function recordStrike(userId: string, input: StrikeInput) {
  const user = await User.findByIdAndUpdate(userId, { $inc: { strikes: 1 } }, { new: true });
  const strikes = user?.strikes ?? 1;
  const hours = input.permanent ? null : banHoursForStrike(strikes);
  const permanent = Boolean(input.permanent);
  const endsAt = permanent ? null : hours ? new Date(Date.now() + hours * 3600 * 1000) : null;

  if (permanent || endsAt) {
    await createBan({
      userId,
      deviceFingerprint: input.deviceFingerprint ?? null,
      reason: input.reason,
      endsAt: endsAt ?? null,
      createdBy: input.adminId ?? null,
      reportId: input.reportId ?? null,
    });
    await setModeration(userId, {
      status: permanent ? "banned" : "suspended",
      suspendedUntil: endsAt,
      reason: input.reason,
    });
  }

  await recordAdminAction({
    adminId: input.adminId ?? null,
    adminUsername: input.adminUsername ?? null,
    action: permanent ? "ban_permanent" : hours === 24 ? "ban_24h" : hours ? "ban_7d" : "warn",
    targetUserId: userId,
    reportId: input.reportId ?? null,
    note: `Strike ${strikes}: ${input.reason}`,
  });

  return { strikes, permanent, endsAt };
}

export async function createBan(input: {
  userId: string;
  deviceFingerprint?: string | null;
  reason: string;
  endsAt: Date | null;
  createdBy: string | null;
  reportId: string | null;
}) {
  const ban = await Ban.create({
    userId: input.userId,
    deviceFingerprint: input.deviceFingerprint ?? null,
    reason: input.reason,
    endsAt: input.endsAt,
    createdBy: input.createdBy,
    reportId: input.reportId,
    active: true,
  });
  if (input.deviceFingerprint) {
    await User.updateOne({ _id: input.userId }, { $addToSet: { deviceFingerprints: input.deviceFingerprint } });
  }
  return ban;
}

export async function setModeration(
  userId: string,
  moderation: { status: "active" | "suspended" | "banned"; suspendedUntil: Date | null; reason: string | null },
) {
  await User.updateOne(
    { _id: userId },
    {
      $set: {
        "moderation.status": moderation.status,
        "moderation.suspendedUntil": moderation.suspendedUntil,
        "moderation.reason": moderation.reason,
      },
    },
  );
}

/** Lifts every active ban for a user and returns the account to active. */
export async function unbanUser(userId: string) {
  await Ban.updateMany({ userId, active: true }, { $set: { active: false } });
  await setModeration(userId, { status: "active", suspendedUntil: null, reason: null });
}

export async function recordAdminAction(input: {
  adminId: string | null;
  adminUsername: string | null;
  action: AdminActionType;
  targetUserId?: string | null;
  reportId?: string | null;
  note?: string | null;
}) {
  return AdminAction.create({
    adminId: input.adminId,
    adminUsername: input.adminUsername,
    action: input.action,
    targetUserId: input.targetUserId ?? null,
    reportId: input.reportId ?? null,
    note: input.note ?? null,
  });
}

/** Temporarily suspends users who are reported by several different people within a day. */
async function applyAutomaticModeration(userId: Types.ObjectId, reportId: string) {
  const since = new Date(Date.now() - 24 * 3600 * 1000);
  const reporters = await Report.distinct("reporterId", { reportedUserId: userId, createdAt: { $gte: since } });
  if (reporters.length < env.MODERATION_AUTO_SUSPEND_REPORTS) return;

  const endsAt = new Date(Date.now() + SUSPENSION_HOURS * 3600 * 1000);
  const reason = `Automatically suspended after ${reporters.length} reports in 24 hours, pending review`;
  await createBan({
    userId: userId.toString(),
    reason,
    endsAt,
    createdBy: null,
    reportId,
  });
  await setModeration(userId.toString(), { status: "suspended", suspendedUntil: endsAt, reason });
  await recordAdminAction({
    adminId: null,
    adminUsername: null,
    action: "auto_suspend",
    targetUserId: userId.toString(),
    reportId,
    note: reason,
  });
  console.warn(`[moderation] User ${userId} auto-suspended after ${reporters.length} reports`);
}

/**
 * Removes evidence from reports whose retention window has passed. Open cases keep their
 * evidence indefinitely so a review is never thrown away mid-investigation.
 */
export async function purgeExpiredEvidence(): Promise<number> {
  const result = await Report.updateMany(
    { evidenceExpiresAt: { $ne: null, $lte: new Date() }, status: { $nin: ["open"] } },
    { $set: { evidenceFrames: [], evidenceTranscript: [] } },
  );
  return result.modifiedCount;
}

export async function unblockUser(userId: string, blockedId: string) {
  await User.updateOne({ _id: userId }, { $pull: { blockedUsers: blockedId } });
}
