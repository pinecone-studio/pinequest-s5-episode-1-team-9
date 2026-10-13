import type { AdminActionType, ReportStatus, UserRole } from "@linguamatch/shared";
import { Router } from "express";
import { Types } from "mongoose";
import { z } from "zod";
import { currentUser, requireAdmin, requireAuth } from "../middleware/auth";
import * as adminService from "../services/admin/adminService";
import { HttpError, parseBody } from "../utils/http";

export const adminRouter = Router();

// Every route in this router is admin-only. requireAuth first so req.user exists, then the role gate.
adminRouter.use(requireAuth, requireAdmin);

const REPORT_STATUSES = ["open", "reviewed", "dismissed", "actioned", "all"] as const;

const ReportActionSchema = z.object({
  action: z.enum(["dismiss", "warn", "ban_24h", "ban_7d", "ban_permanent"]),
  note: z.string().trim().max(1000).default(""),
});

const BanBodySchema = z.object({
  userId: z.string().min(1),
  reason: z.string().trim().min(1).max(500),
  /** null = permanent. */
  durationHours: z.number().int().positive().max(24 * 365).nullable().default(null),
  deviceFingerprint: z.string().trim().max(200).optional(),
  reportId: z.string().optional(),
});

const BanForUserSchema = BanBodySchema.omit({ userId: true });

const RoleSchema = z.object({ role: z.enum(["user", "admin"]) });

const SettingsSchema = z.object({
  languages: z.array(z.object({ code: z.string(), enabled: z.boolean() })).optional(),
  topicsByLevel: z.record(z.string(), z.array(z.string().trim().max(200))).optional(),
  nudityThreshold: z.number().min(0).max(1).optional(),
});

/** Only pass an id to Mongoose when it's a valid ObjectId, so a bad reference is a 400 not a cast crash. */
function optionalId(id: string | undefined): string | null {
  if (!id) return null;
  if (!Types.ObjectId.isValid(id)) throw new HttpError(400, "Invalid id");
  return id;
}

// ─── Dashboard + queue ───────────────────────────────────────────────────────

adminRouter.get("/dashboard", async (_req, res) => {
  res.json({ dashboard: await adminService.getDashboard() });
});

adminRouter.get("/queue", (_req, res) => {
  res.json({ buckets: adminService.getQueueBuckets() });
});

// ─── Reports ─────────────────────────────────────────────────────────────────

adminRouter.get("/reports", async (req, res) => {
  const status = (typeof req.query.status === "string" ? req.query.status : "open") as ReportStatus | "all";
  if (!REPORT_STATUSES.includes(status as (typeof REPORT_STATUSES)[number])) throw new HttpError(400, "Invalid status");
  res.json({ reports: await adminService.listReports(status) });
});

adminRouter.get("/reports/:id", async (req, res) => {
  res.json({ report: await adminService.getReportDetail(req.params.id as string) });
});

adminRouter.post("/reports/:id/action", async (req, res) => {
  const body = parseBody(ReportActionSchema, req.body);
  const report = await adminService.applyReportAction(
    currentUser(req),
    req.params.id as string,
    body.action as AdminActionType,
    body.note,
  );
  res.json({ report });
});

// ─── Users ───────────────────────────────────────────────────────────────────

adminRouter.get("/users", async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q : "";
  res.json({ users: await adminService.searchUsers(q) });
});

adminRouter.get("/users/:id", async (req, res) => {
  res.json({ user: await adminService.getUserSummary(req.params.id as string) });
});

adminRouter.patch("/users/:id", async (req, res) => {
  const body = parseBody(RoleSchema, req.body);
  const user = await adminService.updateUserRole(currentUser(req), req.params.id as string, body.role as UserRole);
  res.json({ user });
});

adminRouter.post("/users/:id/ban", async (req, res) => {
  const body = parseBody(BanForUserSchema, req.body);
  const ban = await adminService.banUserByAdmin(currentUser(req), req.params.id as string, {
    reason: body.reason,
    durationHours: body.durationHours,
    deviceFingerprint: body.deviceFingerprint,
    reportId: optionalId(body.reportId),
  });
  res.status(201).json({ ban });
});

adminRouter.post("/users/:id/unban", async (req, res) => {
  await adminService.unbanByAdmin(currentUser(req), req.params.id as string);
  res.json({ ok: true });
});

// ─── Bans ────────────────────────────────────────────────────────────────────

adminRouter.get("/bans", async (req, res) => {
  const activeOnly = req.query.active === "0" ? false : true;
  res.json({ bans: await adminService.listBans(activeOnly) });
});

adminRouter.post("/bans", async (req, res) => {
  const body = parseBody(BanBodySchema, req.body);
  const ban = await adminService.banUserByAdmin(currentUser(req), body.userId, {
    reason: body.reason,
    durationHours: body.durationHours,
    deviceFingerprint: body.deviceFingerprint,
    reportId: optionalId(body.reportId),
  });
  res.status(201).json({ ban });
});

adminRouter.delete("/bans/:id", async (req, res) => {
  await adminService.liftBan(currentUser(req), req.params.id as string);
  res.json({ ok: true });
});

// ─── Sessions + settings ─────────────────────────────────────────────────────

adminRouter.get("/sessions", async (_req, res) => {
  res.json({ sessions: await adminService.listSessions() });
});

adminRouter.get("/settings", async (_req, res) => {
  res.json({ settings: await adminService.getSettings() });
});

adminRouter.put("/settings", async (req, res) => {
  const body = parseBody(SettingsSchema, req.body);
  const settings = await adminService.updateSettings(currentUser(req), body);
  res.json({ settings });
});
