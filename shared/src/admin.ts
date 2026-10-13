import type { CefrLevel } from "./cefr";

/** Account role. Only "admin" can open /admin or call /api/admin. */
export type UserRole = "user" | "admin";

/** Moderation workflow state of a report. */
export type ReportStatus = "open" | "reviewed" | "dismissed" | "actioned";

/** Which safety check raised the report: automatic nudity detection, speech, or a human tap. */
export type ReportAiFlag = "none" | "nudity" | "speech";

/** Everything an admin can do to a report. Each one is written to AdminAction. */
export type AdminActionType =
  | "dismiss"
  | "warn"
  | "ban_24h"
  | "ban_7d"
  | "ban_permanent"
  | "unban"
  | "role_change"
  | "settings_update"
  | "auto_suspend";

/** A single blurred video frame kept as evidence. Frames are blurred on the client before upload. */
export interface EvidenceFrame {
  /** Base64 data URL (`data:image/jpeg;base64,...`). */
  url: string;
  capturedAt: string;
}

export interface EvidenceTranscriptLine {
  userId: string;
  text: string;
  spokenAt: string;
}

export interface AdminDashboard {
  usersOnline: number;
  inQueue: number;
  callsToday: number;
  openReports: number;
  bansThisWeek: number;
}

/** One language + level row in the queue, so admins can see where people wait too long. */
export interface QueueBucket {
  targetLanguage: string;
  level: CefrLevel;
  waiting: number;
  longestWaitSeconds: number;
}

export interface AdminActionDTO {
  id: string;
  adminId: string | null;
  adminUsername: string | null;
  action: AdminActionType;
  targetUserId: string | null;
  reportId: string | null;
  note: string | null;
  createdAt: string;
}

export interface AdminUserSummary {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  strikes: number;
  conversations: number;
  reportsAgainst: number;
  moderation: {
    status: "active" | "suspended" | "banned";
    suspendedUntil: string | null;
    reason: string | null;
  };
  createdAt: string;
}

export interface AdminReportSummary {
  id: string;
  reason: string;
  reporter: { id: string; username: string };
  reported: { id: string; username: string; strikes: number };
  conversationId: string;
  aiFlag: ReportAiFlag;
  status: ReportStatus;
  createdAt: string;
}

export interface AdminReportDetail extends AdminReportSummary {
  details: string;
  evidence: {
    frames: EvidenceFrame[];
    transcript: EvidenceTranscriptLine[];
    expiresAt: string | null;
  };
  reportedUser: AdminUserSummary;
  /** Past warn/ban actions against the reported user. */
  strikesHistory: AdminActionDTO[];
  actions: AdminActionDTO[];
}

export interface BanDTO {
  id: string;
  userId: string;
  username: string;
  deviceFingerprint: string | null;
  reason: string;
  /** null means a permanent ban. */
  endsAt: string | null;
  active: boolean;
  createdBy: string | null;
  reportId: string | null;
  createdAt: string;
}

export interface AdminSessionSummary {
  id: string;
  targetLanguage: string;
  level: CefrLevel;
  participants: { id: string; username: string }[];
  startTime: string;
  endTime: string | null;
  durationSeconds: number;
  endReason: string | null;
}

export interface AdminSettingsDTO {
  languages: { code: string; enabled: boolean }[];
  topicsByLevel: Record<CefrLevel, string[]>;
  nudityThreshold: number;
  updatedAt: string | null;
}

export const ADMIN_ACTION_TYPES: readonly AdminActionType[] = [
  "dismiss",
  "warn",
  "ban_24h",
  "ban_7d",
  "ban_permanent",
  "unban",
  "role_change",
  "settings_update",
  "auto_suspend",
];

/** Bans applied when a user reaches a strike count (1st = warning only). */
export const STRIKE_BAN_HOURS: Record<number, number | null> = { 1: null, 2: 24, 3: 7 * 24 };
