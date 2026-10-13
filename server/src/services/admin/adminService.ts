import {
  TARGET_LANGUAGES,
  lowerLevel,
  type AdminActionDTO,
  type AdminActionType,
  type AdminDashboard,
  type AdminReportDetail,
  type AdminReportSummary,
  type AdminSessionSummary,
  type AdminSettingsDTO,
  type AdminUserSummary,
  type BanDTO,
  type CefrLevel,
  type EvidenceFrame,
  type EvidenceTranscriptLine,
  type QueueBucket,
  type ReportAiFlag,
  type ReportStatus,
  type UserRole,
} from "@linguamatch/shared";
import { Types } from "mongoose";
import { AdminAction } from "../../models/AdminAction";
import { AdminSettings, SETTINGS_KEY } from "../../models/AdminSettings";
import { Ban } from "../../models/Ban";
import { Conversation } from "../../models/Conversation";
import { Report } from "../../models/Report";
import { User, type UserDoc } from "../../models/User";
import { getIO } from "../../socket/io";
import { matchmaker } from "../../socket";
import { HttpError } from "../../utils/http";
import { createBan, recordAdminAction, setModeration, unbanUser } from "../moderation/moderationService";
import { invalidateLanguageCache } from "./settingsCache";

const DAY_MS = 24 * 3600 * 1000;

// ─── Lean shapes ─────────────────────────────────────────────────────────────
// Explicit interfaces keep the mapping honest: InferSchemaType does not add createdAt.

interface LeanUser {
  _id: Types.ObjectId;
  username: string;
  email: string;
  role?: string | null;
  strikes?: number | null;
  statistics?: { conversations?: number | null } | null;
  moderation?: { status?: string | null; suspendedUntil?: Date | null; reason?: string | null } | null;
  createdAt?: Date | null;
}

interface LeanReport {
  _id: Types.ObjectId;
  reporterId: Types.ObjectId;
  reportedUserId: Types.ObjectId;
  conversationId: Types.ObjectId;
  reason: string;
  details?: string | null;
  status: string;
  aiFlag?: string | null;
  evidenceFrames?: { url: string; capturedAt: Date }[] | null;
  evidenceTranscript?: { userId: Types.ObjectId; text: string; spokenAt: Date }[] | null;
  evidenceExpiresAt?: Date | null;
  handledAt?: Date | null;
  resolution?: string | null;
  createdAt: Date;
}

interface LeanConversation {
  _id: Types.ObjectId;
  targetLanguage: string;
  participants: { userId: Types.ObjectId; displayName: string; level: string }[];
  startTime: Date;
  endTime?: Date | null;
  endReason?: string | null;
}

interface LeanAction {
  _id: Types.ObjectId;
  adminId?: Types.ObjectId | null;
  adminUsername?: string | null;
  action: string;
  targetUserId?: Types.ObjectId | null;
  reportId?: Types.ObjectId | null;
  note?: string | null;
  createdAt: Date;
}

interface LeanBan {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  deviceFingerprint?: string | null;
  reason: string;
  endsAt?: Date | null;
  active: boolean;
  createdBy?: Types.ObjectId | null;
  reportId?: Types.ObjectId | null;
  createdAt: Date;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toActionDTO(action: LeanAction): AdminActionDTO {
  return {
    id: String(action._id),
    adminId: action.adminId ? String(action.adminId) : null,
    adminUsername: action.adminUsername ?? null,
    action: action.action as AdminActionType,
    targetUserId: action.targetUserId ? String(action.targetUserId) : null,
    reportId: action.reportId ? String(action.reportId) : null,
    note: action.note ?? null,
    createdAt: action.createdAt.toISOString(),
  };
}

function isBanActive(ban: LeanBan): boolean {
  return ban.active && (!ban.endsAt || ban.endsAt.getTime() > Date.now());
}

async function usernamesFor(ids: (Types.ObjectId | string)[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.map(String))].filter((id) => Types.ObjectId.isValid(id));
  const users = await User.find({ _id: { $in: unique } }).select("username").lean<{ _id: Types.ObjectId; username: string }[]>();
  return new Map(users.map((u) => [String(u._id), u.username]));
}

async function toUserSummary(user: LeanUser): Promise<AdminUserSummary> {
  const [conversations, reportsAgainst] = await Promise.all([
    Conversation.countDocuments({ "participants.userId": user._id }),
    Report.countDocuments({ reportedUserId: user._id }),
  ]);
  const moderation = user.moderation ?? {};
  return {
    id: String(user._id),
    username: user.username,
    email: user.email,
    role: (user.role ?? "user") as UserRole,
    strikes: user.strikes ?? 0,
    conversations,
    reportsAgainst,
    moderation: {
      status: (moderation.status ?? "active") as AdminUserSummary["moderation"]["status"],
      suspendedUntil: moderation.suspendedUntil ? moderation.suspendedUntil.toISOString() : null,
      reason: moderation.reason ?? null,
    },
    createdAt: (user.createdAt ?? new Date()).toISOString(),
  };
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

export async function getDashboard(): Promise<AdminDashboard> {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const onlineUserIds = new Set<string>();
  for (const socket of getIO().sockets.sockets.values()) {
    if (socket.data.userId) onlineUserIds.add(socket.data.userId);
  }

  const [callsToday, openReports, bansThisWeek] = await Promise.all([
    Conversation.countDocuments({ startTime: { $gte: startOfToday } }),
    Report.countDocuments({ status: "open" }),
    Ban.countDocuments({ createdAt: { $gte: new Date(Date.now() - 7 * DAY_MS) } }),
  ]);

  return {
    usersOnline: onlineUserIds.size,
    inQueue: matchmaker.totalWaiting(),
    callsToday,
    openReports,
    bansThisWeek,
  };
}

export function getQueueBuckets(): QueueBucket[] {
  const now = Date.now();
  const buckets = new Map<string, QueueBucket>();
  for (const entry of matchmaker.waitingEntries()) {
    const key = `${entry.targetLanguage}:${entry.level}`;
    const wait = Math.max(0, Math.round((now - entry.joinedAt) / 1000));
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.waiting += 1;
      bucket.longestWaitSeconds = Math.max(bucket.longestWaitSeconds, wait);
    } else {
      buckets.set(key, {
        targetLanguage: entry.targetLanguage,
        level: entry.level,
        waiting: 1,
        longestWaitSeconds: wait,
      });
    }
  }
  return [...buckets.values()].sort((a, b) => b.waiting - a.waiting || b.longestWaitSeconds - a.longestWaitSeconds);
}

// ─── Reports ─────────────────────────────────────────────────────────────────

export async function listReports(status: ReportStatus | "all" = "open"): Promise<AdminReportSummary[]> {
  const filter = status === "all" ? {} : { status };
  const reports = await Report.find(filter).sort({ createdAt: -1 }).limit(200).lean<LeanReport[]>();
  const names = await usernamesFor(reports.flatMap((r) => [r.reporterId, r.reportedUserId]));
  const strikes = await strikesFor(reports.map((r) => r.reportedUserId));

  return reports.map((r) => ({
    id: String(r._id),
    reason: r.reason,
    reporter: { id: String(r.reporterId), username: names.get(String(r.reporterId)) ?? "Deleted user" },
    reported: {
      id: String(r.reportedUserId),
      username: names.get(String(r.reportedUserId)) ?? "Deleted user",
      strikes: strikes.get(String(r.reportedUserId)) ?? 0,
    },
    conversationId: String(r.conversationId),
    aiFlag: (r.aiFlag ?? "none") as ReportAiFlag,
    status: r.status as ReportStatus,
    createdAt: r.createdAt.toISOString(),
  }));
}

async function strikesFor(ids: Types.ObjectId[]): Promise<Map<string, number>> {
  const unique = [...new Set(ids.map(String))];
  if (!unique.length) return new Map();
  const users = await User.find({ _id: { $in: unique } }).select("strikes").lean<{ _id: Types.ObjectId; strikes?: number }[]>();
  return new Map(users.map((u) => [String(u._id), u.strikes ?? 0]));
}

export async function getReportDetail(reportId: string): Promise<AdminReportDetail> {
  if (!Types.ObjectId.isValid(reportId)) throw new HttpError(404, "Report not found");
  const report = await Report.findById(reportId).select("+evidenceFrames +evidenceTranscript").lean<LeanReport>();
  if (!report) throw new HttpError(404, "Report not found");

  const reportedId = String(report.reportedUserId);
  const [reportedUserDoc, reportActions] = await Promise.all([
    User.findById(reportedId).lean<LeanUser>(),
    AdminAction.find({ reportId }).sort({ createdAt: 1 }).limit(100).lean<LeanAction[]>(),
  ]);
  if (!reportedUserDoc) throw new HttpError(404, "Reported user not found");

  const strikesHistory = await AdminAction.find({
    targetUserId: report.reportedUserId,
    action: { $in: ["warn", "ban_24h", "ban_7d", "ban_permanent", "auto_suspend"] },
  })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean<LeanAction[]>();

  const names = await usernamesFor([report.reporterId]);
  const frames: EvidenceFrame[] = (report.evidenceFrames ?? []).map((f) => ({
    url: f.url,
    capturedAt: f.capturedAt.toISOString(),
  }));
  const transcript: EvidenceTranscriptLine[] = (report.evidenceTranscript ?? []).map((l) => ({
    userId: String(l.userId),
    text: l.text,
    spokenAt: l.spokenAt.toISOString(),
  }));

  return {
    id: String(report._id),
    reason: report.reason,
    reporter: { id: String(report.reporterId), username: names.get(String(report.reporterId)) ?? "Deleted user" },
    reported: {
      id: reportedId,
      username: reportedUserDoc.username,
      strikes: reportedUserDoc.strikes ?? 0,
    },
    conversationId: String(report.conversationId),
    aiFlag: (report.aiFlag ?? "none") as ReportAiFlag,
    status: report.status as ReportStatus,
    createdAt: report.createdAt.toISOString(),
    details: report.details ?? "",
    evidence: {
      frames,
      transcript,
      expiresAt: report.evidenceExpiresAt ? report.evidenceExpiresAt.toISOString() : null,
    },
    reportedUser: await toUserSummary(reportedUserDoc),
    strikesHistory: strikesHistory.map(toActionDTO),
    actions: reportActions.map(toActionDTO),
  };
}

/**
 * Handles one admin decision on a report. Every branch writes to admin_actions and updates the
 * report, so the moderation trail and the queue stay consistent.
 */
export async function applyReportAction(
  admin: UserDoc,
  reportId: string,
  action: AdminActionType,
  note: string,
): Promise<AdminReportDetail> {
  if (!Types.ObjectId.isValid(reportId)) throw new HttpError(404, "Report not found");
  const report = await Report.findById(reportId);
  if (!report) throw new HttpError(404, "Report not found");
  const adminId = admin._id.toString();
  const adminUsername = admin.username;
  const targetId = report.reportedUserId.toString();

  switch (action) {
    case "dismiss":
      await recordAdminAction({ adminId, adminUsername, action, targetUserId: targetId, reportId, note });
      report.status = "dismissed";
      report.resolution = note || "Dismissed";
      break;
    case "warn": {
      await User.updateOne({ _id: targetId }, { $inc: { strikes: 1 } });
      await recordAdminAction({ adminId, adminUsername, action, targetUserId: targetId, reportId, note });
      report.status = "actioned";
      report.resolution = note || "Warned";
      break;
    }
    case "ban_24h":
      await applyBan(admin, targetId, { reason: note || "Report upheld", durationHours: 24, reportId, action });
      report.status = "actioned";
      report.resolution = note || "Banned 24 hours";
      break;
    case "ban_7d":
      await applyBan(admin, targetId, { reason: note || "Report upheld", durationHours: 7 * 24, reportId, action });
      report.status = "actioned";
      report.resolution = note || "Banned 7 days";
      break;
    case "ban_permanent":
      await applyBan(admin, targetId, { reason: note || "Report upheld", durationHours: null, reportId, action });
      report.status = "actioned";
      report.resolution = note || "Banned permanently";
      break;
    default:
      throw new HttpError(400, "Unsupported action for a report");
  }

  report.handledBy = admin._id;
  report.handledAt = new Date();
  await report.save();
  return getReportDetail(reportId);
}

// ─── Users ───────────────────────────────────────────────────────────────────

export async function searchUsers(query: string): Promise<AdminUserSummary[]> {
  const escaped = query.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const filter = escaped
    ? { $or: [{ email: new RegExp(escaped, "i") }, { username: new RegExp(escaped, "i") }] }
    : {};
  const users = await User.find(filter).sort({ createdAt: -1 }).limit(50).lean<LeanUser[]>();
  return Promise.all(users.map(toUserSummary));
}

export async function getUserSummary(userId: string): Promise<AdminUserSummary> {
  if (!Types.ObjectId.isValid(userId)) throw new HttpError(404, "User not found");
  const user = await User.findById(userId).lean<LeanUser>();
  if (!user) throw new HttpError(404, "User not found");
  return toUserSummary(user);
}

export async function updateUserRole(admin: UserDoc, userId: string, role: UserRole): Promise<AdminUserSummary> {
  if (!Types.ObjectId.isValid(userId)) throw new HttpError(404, "User not found");
  if (userId === admin._id.toString() && role !== "admin") {
    throw new HttpError(400, "You can't remove your own admin role");
  }
  const user = await User.findByIdAndUpdate(userId, { $set: { role } }, { new: true });
  if (!user) throw new HttpError(404, "User not found");
  await recordAdminAction({
    adminId: admin._id.toString(),
    adminUsername: admin.username,
    action: "role_change",
    targetUserId: userId,
    note: `Role set to ${role}`,
  });
  return toUserSummary(user.toObject() as LeanUser);
}

export async function banUserByAdmin(
  admin: UserDoc,
  userId: string,
  options: { reason: string; durationHours: number | null; deviceFingerprint?: string | null; reportId?: string | null },
): Promise<BanDTO> {
  if (!Types.ObjectId.isValid(userId)) throw new HttpError(404, "User not found");
  const user = await User.findById(userId);
  if (!user) throw new HttpError(404, "User not found");
  const action: AdminActionType =
    options.durationHours === null ? "ban_permanent" : options.durationHours <= 24 ? "ban_24h" : "ban_7d";
  const ban = await applyBan(admin, userId, {
    reason: options.reason,
    durationHours: options.durationHours,
    deviceFingerprint: options.deviceFingerprint ?? null,
    reportId: options.reportId ?? null,
    action,
  });
  const names = await usernamesFor([userId]);
  return {
    id: String(ban._id),
    userId,
    username: names.get(userId) ?? user.username,
    deviceFingerprint: ban.deviceFingerprint ?? null,
    reason: ban.reason,
    endsAt: ban.endsAt ? ban.endsAt.toISOString() : null,
    active: true,
    createdBy: admin._id.toString(),
    reportId: ban.reportId ? String(ban.reportId) : null,
    createdAt: new Date().toISOString(),
  };
}

async function applyBan(
  admin: UserDoc,
  userId: string,
  options: {
    reason: string;
    durationHours: number | null;
    deviceFingerprint?: string | null;
    reportId?: string | null;
    action: AdminActionType;
  },
) {
  const endsAt = options.durationHours === null ? null : new Date(Date.now() + options.durationHours * 3600 * 1000);
  const ban = await createBan({
    userId,
    deviceFingerprint: options.deviceFingerprint ?? null,
    reason: options.reason,
    endsAt,
    createdBy: admin._id.toString(),
    reportId: options.reportId ?? null,
  });
  await setModeration(userId, {
    status: options.durationHours === null ? "banned" : "suspended",
    suspendedUntil: endsAt,
    reason: options.reason,
  });
  await User.updateOne({ _id: userId }, { $inc: { strikes: 1 } });
  await recordAdminAction({
    adminId: admin._id.toString(),
    adminUsername: admin.username,
    action: options.action,
    targetUserId: userId,
    reportId: options.reportId ?? null,
    note: options.reason,
  });
  return ban;
}

export async function unbanByAdmin(admin: UserDoc, userId: string): Promise<void> {
  if (!Types.ObjectId.isValid(userId)) throw new HttpError(404, "User not found");
  await unbanUser(userId);
  await recordAdminAction({
    adminId: admin._id.toString(),
    adminUsername: admin.username,
    action: "unban",
    targetUserId: userId,
    note: "Ban lifted",
  });
}

// ─── Bans ────────────────────────────────────────────────────────────────────

export async function listBans(activeOnly: boolean): Promise<BanDTO[]> {
  const query = activeOnly ? Ban.find({ active: true }) : Ban.find();
  const bans = await query.sort({ createdAt: -1 }).limit(200).lean<LeanBan[]>();
  const names = await usernamesFor(bans.map((b) => b.userId));
  return bans.map((b) => ({
    id: String(b._id),
    userId: String(b.userId),
    username: names.get(String(b.userId)) ?? "Deleted user",
    deviceFingerprint: b.deviceFingerprint ?? null,
    reason: b.reason,
    endsAt: b.endsAt ? b.endsAt.toISOString() : null,
    active: isBanActive(b),
    createdBy: b.createdBy ? String(b.createdBy) : null,
    reportId: b.reportId ? String(b.reportId) : null,
    createdAt: b.createdAt.toISOString(),
  }));
}

export async function liftBan(admin: UserDoc, banId: string): Promise<void> {
  if (!Types.ObjectId.isValid(banId)) throw new HttpError(404, "Ban not found");
  const ban = await Ban.findById(banId);
  if (!ban) throw new HttpError(404, "Ban not found");
  ban.active = false;
  await ban.save();
  await unbanUser(ban.userId.toString());
  await recordAdminAction({
    adminId: admin._id.toString(),
    adminUsername: admin.username,
    action: "unban",
    targetUserId: ban.userId.toString(),
    note: "Ban lifted",
  });
}

// ─── Sessions ────────────────────────────────────────────────────────────────

export async function listSessions(): Promise<AdminSessionSummary[]> {
  const conversations = await Conversation.find().sort({ startTime: -1 }).limit(100).lean<LeanConversation[]>();
  return conversations.map((c) => {
    const end = c.endTime ?? null;
    const durationSeconds = Math.max(0, Math.round(((end ?? new Date()).getTime() - c.startTime.getTime()) / 1000));
    const levels = c.participants.map((p) => p.level);
    const level = levels.length >= 2 ? lowerLevel(levels[0] as CefrLevel, levels[1] as CefrLevel) : ((levels[0] as CefrLevel) ?? "A1");
    return {
      id: String(c._id),
      targetLanguage: c.targetLanguage,
      level,
      participants: c.participants.map((p) => ({ id: String(p.userId), username: p.displayName })),
      startTime: c.startTime.toISOString(),
      endTime: end ? end.toISOString() : null,
      durationSeconds,
      endReason: c.endReason ?? null,
    };
  });
}

// ─── Settings ────────────────────────────────────────────────────────────────

const LEVELS: CefrLevel[] = ["A1", "A2", "B1", "B2", "C1", "C2"];

async function loadSettings() {
  const existing = await AdminSettings.findOne({ key: SETTINGS_KEY });
  return existing ?? AdminSettings.create({ key: SETTINGS_KEY });
}

function toSettingsDTO(doc: Awaited<ReturnType<typeof loadSettings>>): AdminSettingsDTO {
  const stored = doc.languages ?? [];
  const languages = TARGET_LANGUAGES.map((l) => ({
    code: l.code,
    enabled: stored.find((s) => s.code === l.code)?.enabled ?? true,
  }));
  const rawTopics = (doc.topicsByLevel ?? {}) as Record<string, string[] | undefined>;
  const topicsByLevel = Object.fromEntries(
    LEVELS.map((level) => [level, Array.isArray(rawTopics[level]) ? rawTopics[level]!.filter((t) => typeof t === "string") : []]),
  ) as Record<CefrLevel, string[]>;
  return {
    languages,
    topicsByLevel,
    nudityThreshold: doc.nudityThreshold ?? 0.7,
    updatedAt: (doc.get("updatedAt") as Date | undefined)?.toISOString() ?? null,
  };
}

export async function getSettings(): Promise<AdminSettingsDTO> {
  return toSettingsDTO(await loadSettings());
}

export async function updateSettings(
  admin: UserDoc,
  patch: { languages?: { code: string; enabled: boolean }[]; topicsByLevel?: Record<string, string[]>; nudityThreshold?: number },
): Promise<AdminSettingsDTO> {
  const doc = await loadSettings();
  if (patch.languages) doc.set("languages", patch.languages.map((l) => ({ code: l.code, enabled: Boolean(l.enabled) })));
  if (patch.topicsByLevel) doc.topicsByLevel = patch.topicsByLevel;
  if (patch.nudityThreshold !== undefined) {
    if (patch.nudityThreshold < 0 || patch.nudityThreshold > 1) throw new HttpError(400, "Nudity threshold must be between 0 and 1");
    doc.nudityThreshold = patch.nudityThreshold;
  }
  await doc.save();
  invalidateLanguageCache();
  await recordAdminAction({
    adminId: admin._id.toString(),
    adminUsername: admin.username,
    action: "settings_update",
    note: "Updated AI & language settings",
  });
  return toSettingsDTO(doc);
}
