import {
  USER_ROLES,
  type AdminActionDTO,
  type AdminBanDTO,
  type AdminReportDTO,
  type AdminStatsDTO,
  type AdminUserDTO,
  type CefrLevel,
  type UserRole,
} from "@linguamatch/shared";
import {
  aliasedTable,
  and,
  count,
  desc,
  eq,
  gt,
  gte,
  ilike,
  inArray,
  isNull,
  lte,
  or,
  sql,
} from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import { db } from "../db/client";
import { ADMIN_ACTIONS, adminActions, bans, reports, sessions, transcriptLines, users } from "../db/schema";
import { currentUser, requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/role";
import { involvesUser } from "../models/Session";
import { isOnboarded, type User, type UserPatch } from "../models/User";
import { activeBansFor, findActiveBan } from "../services/moderation/moderationService";
import { endSession } from "../services/rooms/roomService";
import { matchmaker } from "../socket";
import { getIO, userRoom } from "../socket/io";
import { HttpError, parseBody } from "../utils/http";

export const adminRouter = Router();
adminRouter.use(requireAuth);
// Everything on this router needs at least moderator rank; admin-only routes override below.
adminRouter.use(requireRole("moderator"));

const reporterTable = aliasedTable(users, "reporter");
const reportedTable = aliasedTable(users, "reported");

const Pagination = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
});

const ReportsQuery = Pagination.extend({
  status: z.enum(["open", "under_review", "actioned", "dismissed"]).optional(),
  aiFlag: z.enum(["true", "false"]).optional(),
});

function toAdminBanDTO(ban: typeof bans.$inferSelect | null | undefined): AdminBanDTO | null {
  if (!ban) return null;
  return {
    id: ban.id,
    source: ban.source,
    reason: ban.reason,
    startsAt: ban.startsAt.toISOString(),
    endsAt: ban.endsAt?.toISOString() ?? null,
    revokedAt: ban.revokedAt?.toISOString() ?? null,
    revokedBy: ban.revokedBy,
    createdBy: ban.createdBy,
  };
}

function toAdminUserDTO(user: User, activeBan: typeof bans.$inferSelect | null, openReportsCount: number): AdminUserDTO {
  return {
    id: user.id,
    username: user.name,
    email: user.email,
    role: user.role as UserRole,
    nativeLanguage: user.nativeLang,
    activeTargetLanguage: user.targetLang,
    level: (user.level as CefrLevel) ?? null,
    onboarded: isOnboarded(user),
    deletedAt: user.deletedAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
    activeBan: toAdminBanDTO(activeBan),
    openReportsCount,
  };
}

async function ensureUser(id: string): Promise<User> {
  const [user] = await db.select().from(users).where(eq(users.id, id));
  if (!user) throw new HttpError(404, "User not found");
  return user;
}

/** Kicks the user out of the matchmaking queue and any live conversation. Called when they're banned. */
async function kickUser(userId: string) {
  await matchmaker.leave(userId);
  const open = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(and(inArray(sessions.status, ["pending", "active"]), involvesUser(userId)))
    .then((rows) => rows.map((r) => r.id));
  for (const id of open) await endSession(id, userId, "partner_left");
  getIO().in(userRoom(userId)).disconnectSockets(true);
}

async function countOpenReportsFor(userIds: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>(userIds.map((id) => [id, 0]));
  if (userIds.length === 0) return map;
  const rows = await db
    .select({ id: reports.reportedId, n: count() })
    .from(reports)
    .where(and(inArray(reports.reportedId, userIds), inArray(reports.status, ["open", "under_review"])))
    .groupBy(reports.reportedId);
  for (const row of rows) map.set(row.id, row.n);
  return map;
}

// ─── Stats ─────────────────────────────────────────────────────────────────

adminRouter.get("/stats", async (_req, res) => {
  const now = new Date();
  const since = new Date(Date.now() - 24 * 3600 * 1000);
  const [openReports, activeBans, totalUsers, usersLast24h] = await Promise.all([
    db.select({ n: count() }).from(reports).where(inArray(reports.status, ["open", "under_review"])),
    db
      .select({ n: count() })
      .from(bans)
      .where(
        and(isNull(bans.revokedAt), lte(bans.startsAt, now), or(isNull(bans.endsAt), gt(bans.endsAt, now))),
      ),
    db.select({ n: count() }).from(users),
    db.select({ n: count() }).from(users).where(gte(users.createdAt, since)),
  ]);
  const stats: AdminStatsDTO = {
    openReports: openReports[0]?.n ?? 0,
    activeBans: activeBans[0]?.n ?? 0,
    totalUsers: totalUsers[0]?.n ?? 0,
    usersLast24h: usersLast24h[0]?.n ?? 0,
  };
  res.json({ stats });
});

// ─── Reports ───────────────────────────────────────────────────────────────

adminRouter.get("/reports", async (req, res) => {
  const { limit, offset, status, aiFlag } = parseBody(ReportsQuery, req.query);
  const conditions = [
    status ? eq(reports.status, status) : inArray(reports.status, ["open", "under_review"]),
  ];
  if (aiFlag !== undefined) conditions.push(eq(reports.aiFlag, aiFlag === "true"));
  const where = and(...conditions);

  const [rows, total] = await Promise.all([
    db
      .select({
        report: reports,
        reporterName: reporterTable.name,
        reporterDeletedAt: reporterTable.deletedAt,
        reportedName: reportedTable.name,
        reportedDeletedAt: reportedTable.deletedAt,
        sessionLang: sessions.lang,
        sessionStartedAt: sessions.startedAt,
        sessionEndedAt: sessions.endedAt,
      })
      .from(reports)
      .innerJoin(reporterTable, eq(reporterTable.id, reports.reporterId))
      .innerJoin(reportedTable, eq(reportedTable.id, reports.reportedId))
      .innerJoin(sessions, eq(sessions.id, reports.sessionId))
      .where(where)
      .orderBy(desc(reports.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ n: count() }).from(reports).where(where),
  ]);

  const activeBans = await activeBansFor([...new Set(rows.map((r) => r.report.reportedId))]);
  const list: AdminReportDTO[] = rows.map((r) => {
    const report = r.report;
    return {
      id: report.id,
      reason: report.reason as AdminReportDTO["reason"],
      details: report.details,
      chatEvidence: report.chatEvidence ?? null,
      aiFlag: report.aiFlag,
      status: report.status,
      reporter: { id: report.reporterId, username: r.reporterDeletedAt ? "Deleted user" : r.reporterName },
      reported: { id: report.reportedId, username: r.reportedDeletedAt ? "Deleted user" : r.reportedName },
      sessionId: report.sessionId,
      sessionLang: r.sessionLang,
      sessionStartedAt: r.sessionStartedAt?.toISOString() ?? null,
      sessionEndedAt: r.sessionEndedAt?.toISOString() ?? null,
      createdAt: report.createdAt.toISOString(),
      activeBan: toAdminBanDTO(activeBans.get(report.reportedId) ?? null),
    };
  });

  res.json({ reports: list, total: total[0]?.n ?? 0 });
});

adminRouter.get("/reports/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, "Invalid report id");
  const [row] = await db
    .select({
      report: reports,
      reporterName: reporterTable.name,
      reportedName: reportedTable.name,
      sessionLang: sessions.lang,
      sessionStartedAt: sessions.startedAt,
      sessionEndedAt: sessions.endedAt,
    })
    .from(reports)
    .innerJoin(reporterTable, eq(reporterTable.id, reports.reporterId))
    .innerJoin(reportedTable, eq(reportedTable.id, reports.reportedId))
    .innerJoin(sessions, eq(sessions.id, reports.sessionId))
    .where(eq(reports.id, id));
  if (!row) throw new HttpError(404, "Report not found");

  // Opening a report to look at it moves it out of the unclaimed queue.
  if (row.report.status === "open") {
    await db.update(reports).set({ status: "under_review" }).where(eq(reports.id, id));
    row.report.status = "under_review";
  }
  const [activeBan, transcriptCount] = await Promise.all([
    findActiveBan(row.report.reportedId),
    db.select({ n: count() }).from(transcriptLines).where(eq(transcriptLines.sessionId, row.report.sessionId)),
  ]);
  res.json({
    report: {
      id: row.report.id,
      reason: row.report.reason as AdminReportDTO["reason"],
      details: row.report.details,
      chatEvidence: row.report.chatEvidence ?? null,
      aiFlag: row.report.aiFlag,
      status: row.report.status,
      reporter: { id: row.report.reporterId, username: row.reporterName },
      reported: { id: row.report.reportedId, username: row.reportedName },
      sessionId: row.report.sessionId,
      sessionLang: row.sessionLang,
      sessionStartedAt: row.sessionStartedAt?.toISOString() ?? null,
      sessionEndedAt: row.sessionEndedAt?.toISOString() ?? null,
      createdAt: row.report.createdAt.toISOString(),
      activeBan: toAdminBanDTO(activeBan),
    } satisfies AdminReportDTO,
    transcriptCount: transcriptCount[0]?.n ?? 0,
  });
});

const ReviewSchema = z.object({
  action: z.enum(["dismiss", "suspend"]),
  /** Null = permanent. */
  days: z.number().int().min(1).max(3650).nullable().optional(),
  reason: z.string().trim().min(1, "Add a short note for the audit log").max(500),
});

adminRouter.post("/reports/:id/review", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, "Invalid report id");
  const body = parseBody(ReviewSchema, req.body);
  const admin = currentUser(req);
  const [report] = await db.select().from(reports).where(eq(reports.id, id));
  if (!report) throw new HttpError(404, "Report not found");
  if (report.status === "actioned" || report.status === "dismissed") {
    throw new HttpError(409, "This report was already reviewed");
  }

  const reviewedSet = { reviewedBy: admin.id, reviewedAt: new Date(), resolutionNote: body.reason };

  if (body.action === "dismiss") {
    await db.update(reports).set({ ...reviewedSet, status: "dismissed" }).where(eq(reports.id, id));
    await recordAdminAction(admin.id, "dismiss_report", { reportId: id, reason: body.reason });
    return res.json({ report: await findReportDTO(id), ok: true });
  }

  await db.update(reports).set({ ...reviewedSet, status: "actioned" }).where(eq(reports.id, id));
  const endsAt = body.days === null || body.days === undefined ? null : new Date(Date.now() + body.days * 24 * 3600 * 1000);
  const [ban] = await db
    .insert(bans)
    .values({
      userId: report.reportedId,
      source: "moderator",
      reason: body.reason,
      reportId: id,
      createdBy: admin.id,
      endsAt,
    })
    .returning();
  await Promise.all([
    recordAdminAction(admin.id, "ban_user", {
      reportId: id,
      reason: body.reason,
      metadata: { days: body.days ?? null, source: "report_review" },
    }),
    recordAdminAction(admin.id, "review_report", { reportId: id, reason: body.reason, metadata: { decision: "suspend" } }),
  ]);
  await kickUser(report.reportedId);
  res.json({ report: await findReportDTO(id), ban: toAdminBanDTO(ban!), ok: true });
});

async function findReportDTO(id: number): Promise<AdminReportDTO> {
  const [row] = await db
    .select({
      report: reports,
      reporterName: reporterTable.name,
      reporterDeletedAt: reporterTable.deletedAt,
      reportedName: reportedTable.name,
      reportedDeletedAt: reportedTable.deletedAt,
      sessionLang: sessions.lang,
      sessionStartedAt: sessions.startedAt,
      sessionEndedAt: sessions.endedAt,
    })
    .from(reports)
    .innerJoin(reporterTable, eq(reporterTable.id, reports.reporterId))
    .innerJoin(reportedTable, eq(reportedTable.id, reports.reportedId))
    .innerJoin(sessions, eq(sessions.id, reports.sessionId))
    .where(eq(reports.id, id));
  if (!row) throw new HttpError(404, "Report not found");
  const report = row.report;
  const activeBan = await findActiveBan(report.reportedId);
  return {
    id: report.id,
    reason: report.reason as AdminReportDTO["reason"],
    details: report.details,
    chatEvidence: report.chatEvidence ?? null,
    aiFlag: report.aiFlag,
    status: report.status,
    reporter: { id: report.reporterId, username: row.reporterDeletedAt ? "Deleted user" : row.reporterName },
    reported: { id: report.reportedId, username: row.reportedDeletedAt ? "Deleted user" : row.reportedName },
    sessionId: report.sessionId,
    sessionLang: row.sessionLang,
    sessionStartedAt: row.sessionStartedAt?.toISOString() ?? null,
    sessionEndedAt: row.sessionEndedAt?.toISOString() ?? null,
    createdAt: report.createdAt.toISOString(),
    activeBan: toAdminBanDTO(activeBan),
  };
}

// ─── Users ─────────────────────────────────────────────────────────────────

const UsersQuery = Pagination.extend({
  q: z.string().trim().max(100).optional(),
  role: z.enum(USER_ROLES).optional(),
  banned: z.enum(["true", "false"]).optional(),
  deleted: z.enum(["true", "false"]).optional(),
});

adminRouter.get("/users", async (req, res) => {
  const { q, role, banned, deleted, limit, offset } = parseBody(UsersQuery, req.query);
  const conditions = [];
  if (q) {
    const like = `%${q.replace(/[%_]/g, "\\$&")}%`;
    conditions.push(or(ilike(users.name, like), ilike(users.email, like)));
  }
  if (role) conditions.push(eq(users.role, role));
  if (deleted === "true") conditions.push(sql`${users.deletedAt} is not null`);
  if (deleted === "false") conditions.push(sql`${users.deletedAt} is null`);
  const where = conditions.length ? and(...conditions) : undefined;

  const [rows, total] = await Promise.all([
    db
      .select()
      .from(users)
      .where(where)
      .orderBy(desc(users.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ n: count() }).from(users).where(where),
  ]);

  const ids = rows.map((u) => u.id);
  const [activeBans, openReports] = await Promise.all([activeBansFor(ids), countOpenReportsFor(ids)]);

  let list = rows.map((u) => toAdminUserDTO(u, activeBans.get(u.id) ?? null, openReports.get(u.id) ?? 0));
  if (banned === "true") list = list.filter((u) => u.activeBan);
  if (banned === "false") list = list.filter((u) => !u.activeBan);

  res.json({ users: list, total: banned ? list.length : total[0]?.n ?? 0 });
});

adminRouter.get("/users/:id", async (req, res) => {
  const id = String(req.params.id);
  if (!id.startsWith("user_")) throw new HttpError(400, "Invalid user id");
  const user = await ensureUser(id);
  const [activeBan, banHistory, reportRows, sessionCount] = await Promise.all([
    findActiveBan(user.id),
    db.select().from(bans).where(eq(bans.userId, user.id)).orderBy(desc(bans.createdAt)),
    db
      .select({
        report: reports,
        reporterName: reporterTable.name,
      })
      .from(reports)
      .innerJoin(reporterTable, eq(reporterTable.id, reports.reporterId))
      .where(eq(reports.reportedId, user.id))
      .orderBy(desc(reports.createdAt)),
    db.select({ n: count() }).from(sessions).where(involvesUser(user.id)),
  ]);
  const openReports = await countOpenReportsFor([user.id]);
  res.json({
    user: toAdminUserDTO(user, activeBan, openReports.get(user.id) ?? 0),
    sessionCount: sessionCount[0]?.n ?? 0,
    bans: banHistory.map((b) => toAdminBanDTO(b)),
    reports: reportRows.map((r) => ({
      id: r.report.id,
      reason: r.report.reason,
      details: r.report.details,
      status: r.report.status,
      reporter: r.reporterName,
      sessionId: r.report.sessionId,
      createdAt: r.report.createdAt.toISOString(),
    })),
  });
});

// Changing roles is admin-only.
adminRouter.patch("/users/:id/role", requireRole("admin"), async (req, res) => {
  const id = String(req.params.id);
  if (!id.startsWith("user_")) throw new HttpError(400, "Invalid user id");
  const body = parseBody(z.object({ role: z.enum(USER_ROLES) }), req.body);
  const admin = currentUser(req);
  if (admin.id === id) throw new HttpError(400, "You can't change your own role");
  const target = await ensureUser(id);
  if (target.role === "admin" && body.role !== "admin") {
    const [row] = await db.select({ n: count() }).from(users).where(eq(users.role, "admin"));
    if ((row?.n ?? 0) <= 1) throw new HttpError(400, "At least one admin is required");
  }
  const patch: UserPatch = { role: body.role };
  const [updated] = await db.update(users).set(patch).where(eq(users.id, id)).returning();
  await recordAdminAction(admin.id, "change_role", {
    targetUserId: id,
    reason: null,
    metadata: { from: target.role, to: body.role },
  });
  res.json({ user: toAdminUserDTO(updated!, null, 0) });
});

const BanSchema = z.object({
  reason: z.string().trim().min(1, "A reason is required").max(500),
  /** Null = permanent. */
  days: z.number().int().min(1).max(3650).nullable().optional(),
});

adminRouter.post("/users/:id/ban", async (req, res) => {
  const id = String(req.params.id);
  if (!id.startsWith("user_")) throw new HttpError(400, "Invalid user id");
  const body = parseBody(BanSchema, req.body);
  const admin = currentUser(req);
  const user = await ensureUser(id);
  if (user.deletedAt) throw new HttpError(400, "This account is already deleted");

  const endsAt = body.days === null || body.days === undefined ? null : new Date(Date.now() + body.days * 24 * 3600 * 1000);
  const [ban] = await db
    .insert(bans)
    .values({ userId: id, source: "moderator", reason: body.reason, createdBy: admin.id, endsAt })
    .returning();
  await recordAdminAction(admin.id, "ban_user", {
    targetUserId: id,
    reason: body.reason,
    metadata: { days: body.days ?? null, source: "manual" },
  });
  await kickUser(id);
  res.status(201).json({ ban: toAdminBanDTO(ban!) });
});

const UnbanSchema = z.object({ reason: z.string().trim().max(500).optional().default("") });

adminRouter.post("/users/:id/unban", async (req, res) => {
  const id = String(req.params.id);
  if (!id.startsWith("user_")) throw new HttpError(400, "Invalid user id");
  const body = parseBody(UnbanSchema, req.body);
  const admin = currentUser(req);
  await ensureUser(id);
  const active = await findActiveBan(id);
  if (!active) throw new HttpError(404, "No active ban for this user");
  await db
    .update(bans)
    .set({ revokedAt: new Date(), revokedBy: admin.id, revokeReason: body.reason })
    .where(eq(bans.id, active.id));
  await recordAdminAction(admin.id, "revoke_ban", {
    targetUserId: id,
    banId: active.id,
    reason: body.reason || "Ban lifted",
  });
  res.json({ ok: true });
});

// ─── Audit log (admin-only) ────────────────────────────────────────────────

adminRouter.get("/actions", requireRole("admin"), async (req, res) => {
  const { limit, offset } = parseBody(Pagination, req.query);
  const [rows, [total]] = await Promise.all([
    db
      .select()
      .from(adminActions)
      .orderBy(desc(adminActions.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ n: count() }).from(adminActions),
  ]);
  const ids = [...new Set(rows.flatMap((a) => [a.adminId, ...(a.targetUserId ? [a.targetUserId] : [])]))];
  const names = new Map<string, string>();
  if (ids.length > 0) {
    const named = await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, ids));
    for (const u of named) names.set(u.id, u.name);
  }
  const list: AdminActionDTO[] = rows.map((r) => ({
    id: r.id,
    action: r.action,
    admin: { id: r.adminId, username: names.get(r.adminId) ?? "Unknown" },
    targetUser: r.targetUserId ? { id: r.targetUserId, username: names.get(r.targetUserId) ?? "Deleted user" } : null,
    reportId: r.reportId ?? null,
    reason: r.reason,
    metadata: r.metadata as Record<string, unknown>,
    createdAt: r.createdAt.toISOString(),
  }));
  res.json({ actions: list, total: total?.n ?? 0 });
});

// ─── Audit recording ───────────────────────────────────────────────────────

async function recordAdminAction(
  adminId: string,
  action: (typeof ADMIN_ACTIONS)[number],
  data: { targetUserId?: string; reportId?: number; banId?: number; reason?: string | null; metadata?: Record<string, unknown> },
) {
  await db.insert(adminActions).values({
    adminId,
    action,
    targetUserId: data.targetUserId,
    reportId: data.reportId,
    banId: data.banId,
    reason: data.reason ?? null,
    metadata: data.metadata ?? {},
  });
}