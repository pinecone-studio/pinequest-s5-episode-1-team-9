import {
  CEFR_LEVELS,
  REPORT_REASONS,
  USER_ROLES,
  type Exercise,
  type FluencyMetrics,
  type LanguageProfile,
  type Topic,
  type VocabularySuggestion,
} from "@linguamatch/shared";
import { sql, type SQL } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

export const MATCHING_MODES = ["exact_level", "flexible_level"] as const;
export const CALL_MODES = ["video", "voice"] as const;
export const QUEUE_STATUSES = ["waiting", "matched", "cancelled", "expired"] as const;
export const SESSION_STATUSES = ["pending", "active", "ended"] as const;
export const SESSION_END_REASONS = ["ended", "next", "partner_left", "disconnected", "blocked", "reported"] as const;
export const MISTAKE_CATEGORIES = ["grammar", "vocabulary", "sentence_structure", "word_choice"] as const;
export const FEEDBACK_STATUSES = ["pending", "ready", "insufficient_data", "no_consent", "failed"] as const;
export const REPORT_STATUSES = ["open", "under_review", "actioned", "dismissed"] as const;
export const BAN_SOURCES = ["automatic", "moderator"] as const;
export const XP_REASONS = ["call", "streak", "skip_penalty"] as const;
export const ADMIN_ACTIONS = [
  "ban_user",
  "revoke_ban",
  "review_report",
  "dismiss_report",
  "change_role",
  "view_transcript",
  "view_evidence",
  "delete_user_data",
] as const;
const REPORT_REASON_VALUES = REPORT_REASONS.map((r) => r.value);

/** `col IN ('a', 'b')` for CHECK constraints. Values are compile-time constants, never user input. */
const oneOf = (col: AnyPgColumn | SQL, values: readonly string[]) =>
  sql`${col} in (${sql.raw(values.map((v) => `'${v}'`).join(", "))})`;

const tz = (name: string) => timestamp(name, { withTimezone: true });
const createdAt = () => tz("created_at").notNull().defaultNow();
const updatedAt = () =>
  tz("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());
const id = () => bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity();

/** Clerk user id (`user_…`) is the primary key. Passwords and sessions stay in Clerk; email is a copy. */
export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    /** Public username, the only name partners see. */
    name: text("name").notNull(),
    email: text("email"),
    role: text("role", { enum: USER_ROLES }).notNull().default("user"),
    nativeLang: text("native_lang"),
    targetLanguages: jsonb("target_languages").$type<LanguageProfile[]>().notNull().default([]),
    /** The language currently practiced; matching uses it and `level`. */
    targetLang: text("target_lang"),
    /** Level for `target_lang`, derived from `target_languages` so the two can't disagree. */
    level: text("level").generatedAlwaysAs(
      sql`jsonb_path_query_first(target_languages, '$[*] ? (@.language == $l).level', jsonb_object(ARRAY['l', target_lang])) #>> '{}'`,
    ),
    xp: integer("xp").notNull().default(0),
    xpLevel: integer("xp_level").notNull().default(1),
    streakCount: integer("streak_count").notNull().default(0),
    lastCallDate: date("last_call_date"),
    /** Confirmed 18+ together with the community rules. */
    isAdult: boolean("is_adult").notNull().default(false),
    transcriptionConsent: boolean("transcription_consent").notNull().default(false),
    retainTranscripts: boolean("retain_transcripts").notNull().default(false),
    rulesAcceptedAt: tz("rules_accepted_at"),
    /** Accounts are soft-deleted so sessions, reports and bans keep their history. */
    deletedAt: tz("deleted_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("users_name_lower_key").on(sql`lower(${t.name})`),
    check("users_id_not_blank", sql`length(${t.id}) > 0`),
    check("users_name_format", sql`${t.name} ~ '^[A-Za-z0-9_]{3,24}$'`),    check("users_role_check", oneOf(t.role, USER_ROLES)),
    check("users_target_languages_is_array", sql`jsonb_typeof(${t.targetLanguages}) = 'array'`),
    check("users_xp_nonnegative", sql`${t.xp} >= 0`),
    check("users_xp_level_positive", sql`${t.xpLevel} >= 1`),
    check("users_streak_nonnegative", sql`${t.streakCount} >= 0`),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Name of the call room; clients join it by the session id. */
    roomName: text("room_name")
      .notNull()
      .generatedAlwaysAs(sql`'lm-' || id::text`),
    /** user_a is the WebRTC caller. */
    userA: text("user_a")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    userB: text("user_b")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    lang: text("lang").notNull(),
    userALevel: text("user_a_level").notNull(),
    userBLevel: text("user_b_level").notNull(),
    matchingMode: text("matching_mode", { enum: MATCHING_MODES }).notNull(),
    levelDistance: smallint("level_distance").notNull().default(0),
    /** Consent is snapshotted at match time; without it nothing a user says is stored. */
    userATranscriptionConsent: boolean("user_a_transcription_consent").notNull().default(false),
    userBTranscriptionConsent: boolean("user_b_transcription_consent").notNull().default(false),
    topics: jsonb("topics")
      .$type<(Topic & { shownAt: string })[]>()
      .notNull()
      .default([]),
    status: text("status", { enum: SESSION_STATUSES }).notNull().default("pending"),
    endReason: text("end_reason", { enum: SESSION_END_REASONS }),
    endedBy: text("ended_by").references(() => users.id, { onDelete: "restrict" }),
    userAJoinedAt: tz("user_a_joined_at"),
    userBJoinedAt: tz("user_b_joined_at"),
    startedAt: tz("started_at"),
    endedAt: tz("ended_at"),
    transcriptPurgedAt: tz("transcript_purged_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique("sessions_room_name_key").on(t.roomName),
    check("sessions_distinct_users", sql`${t.userA} <> ${t.userB}`),
    check("sessions_user_a_level_check", oneOf(t.userALevel, CEFR_LEVELS)),
    check("sessions_user_b_level_check", oneOf(t.userBLevel, CEFR_LEVELS)),
    check("sessions_matching_mode_check", oneOf(t.matchingMode, MATCHING_MODES)),
    check("sessions_level_distance_range", sql`${t.levelDistance} between 0 and 5`),
    check("sessions_status_check", oneOf(t.status, SESSION_STATUSES)),
    check("sessions_end_reason_check", oneOf(t.endReason, SESSION_END_REASONS)),
    check(
      "sessions_ended_consistency",
      sql`(${t.status} = 'ended') = (${t.endedAt} is not null and ${t.endReason} is not null)`,
    ),
    check("sessions_started_when_active", sql`${t.status} <> 'active' or ${t.startedAt} is not null`),
    check("sessions_ended_by_participant", sql`${t.endedBy} is null or ${t.endedBy} in (${t.userA}, ${t.userB})`),
    check("sessions_topics_is_array", sql`jsonb_typeof(${t.topics}) = 'array'`),
    index("sessions_user_a_created_idx").on(t.userA, t.createdAt.desc()),
    index("sessions_user_b_created_idx").on(t.userB, t.createdAt.desc()),
    index("sessions_open_idx")
      .on(t.status)
      .where(sql`${t.status} in ('pending', 'active')`),
    index("sessions_purge_idx")
      .on(t.endedAt)
      .where(sql`${t.status} = 'ended' and ${t.transcriptPurgedAt} is null`),
  ],
);

export const queue = pgTable(
  "queue",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lang: text("lang").notNull(),
    level: text("level").notNull(),
    nativeLanguage: text("native_language"),
    mode: text("mode", { enum: CALL_MODES }).notNull().default("video"),
    matchingMode: text("matching_mode", { enum: MATCHING_MODES }).notNull().default("flexible_level"),
    status: text("status", { enum: QUEUE_STATUSES }).notNull().default("waiting"),
    sessionId: uuid("session_id").references(() => sessions.id, { onDelete: "set null" }),
    joinedAt: tz("joined_at").notNull().defaultNow(),
    resolvedAt: tz("resolved_at"),
  },
  (t) => [
    /** One waiting entry per user; finished entries stay as history. */
    uniqueIndex("queue_one_waiting_entry_per_user")
      .on(t.userId)
      .where(sql`${t.status} = 'waiting'`),
    check("queue_level_check", oneOf(t.level, CEFR_LEVELS)),
    check("queue_mode_check", oneOf(t.mode, CALL_MODES)),
    check("queue_matching_mode_check", oneOf(t.matchingMode, MATCHING_MODES)),
    check("queue_status_check", oneOf(t.status, QUEUE_STATUSES)),
    check("queue_resolved_consistency", sql`(${t.status} = 'waiting') = (${t.resolvedAt} is null)`),
    check("queue_matched_has_session", sql`${t.status} <> 'matched' or ${t.sessionId} is not null`),
    index("queue_waiting_match_idx")
      .on(t.lang, t.level, t.joinedAt)
      .where(sql`${t.status} = 'waiting'`),
    index("queue_resolved_at_idx").on(t.resolvedAt),
  ],
);

/** One row per (user, partner) direction, upserted on every match. */
export const recentPartners = pgTable(
  "recent_partners",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    partnerId: text("partner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lastSessionId: uuid("last_session_id").references(() => sessions.id, { onDelete: "set null" }),
    metAt: tz("met_at").notNull().defaultNow(),
    matchCount: bigint("match_count", { mode: "number" }).notNull().default(1),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.partnerId] }),
    check("recent_partners_not_self", sql`${t.userId} <> ${t.partnerId}`),
    check("recent_partners_match_count_positive", sql`${t.matchCount} > 0`),
    index("recent_partners_user_recent_idx").on(t.userId, t.metAt.desc()),
    index("recent_partners_partner_idx").on(t.partnerId),
  ],
);

/** "Never match me with this person again." Checked in both directions by the matchmaker. */
export const userBlocks = pgTable(
  "user_blocks",
  {
    blockerId: text("blocker_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    blockedId: text("blocked_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Session the block was made from, so the UI can say where you met. */
    sessionId: uuid("session_id").references(() => sessions.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.blockerId, t.blockedId] }),
    check("user_blocks_not_self", sql`${t.blockerId} <> ${t.blockedId}`),
    index("user_blocks_blocked_idx").on(t.blockedId),
  ],
);

/** Each user's own recognized speech. Text only: audio/video is never stored. */
export const transcriptLines = pgTable(
  "transcript_lines",
  {
    id: id(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    /** The speaker. */
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    /** When the recognizer first heard the phrase. */
    spokenAt: tz("spoken_at").notNull(),
    endedAt: tz("ended_at").notNull(),
    confidence: real("confidence"),
    createdAt: createdAt(),
  },
  (t) => [
    check("transcript_lines_text_length", sql`char_length(${t.text}) between 1 and 2000`),
    check("transcript_lines_time_order", sql`${t.endedAt} >= ${t.spokenAt}`),
    check("transcript_lines_confidence_range", sql`${t.confidence} is null or (${t.confidence} > 0 and ${t.confidence} <= 1)`),
    index("transcript_lines_session_user_idx").on(t.sessionId, t.userId, t.spokenAt),
    index("transcript_lines_user_idx").on(t.userId),
  ],
);

export interface FeedbackDetails {
  pronunciationNote: string | null;
  vocabularySuggestions: VocabularySuggestion[];
  fluencyNotes: string[];
  strengths: string[];
  weaknesses: string[];
  exercises: Exercise[];
}

/** One AI report per participant per session, built only from that participant's own speech. */
export const feedbackReports = pgTable(
  "feedback_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: text("status", { enum: FEEDBACK_STATUSES }).notNull().default("pending"),
    statusMessage: text("status_message"),
    targetLanguage: text("target_language").notNull(),
    level: text("level").notNull(),
    estimatedPerformance: text("estimated_performance"),
    grammar: smallint("grammar"),
    vocabulary: smallint("vocabulary"),
    fluency: smallint("fluency"),
    pronunciationScore: smallint("pronunciation_score"),
    overallScore: smallint("overall_score"),
    summary: text("summary"),
    summaryJson: jsonb("summary_json").$type<FeedbackDetails>(),
    metrics: jsonb("metrics").$type<FluencyMetrics>(),
    aiModel: text("ai_model"),
    generatedAt: tz("generated_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique("feedback_reports_session_user_key").on(t.sessionId, t.userId),
    check("feedback_reports_status_check", oneOf(t.status, FEEDBACK_STATUSES)),
    check("feedback_reports_level_check", oneOf(t.level, CEFR_LEVELS)),
    check(
      "feedback_reports_scores_range",
      sql`${t.grammar} between 0 and 100 and ${t.vocabulary} between 0 and 100
        and ${t.fluency} between 0 and 100 and ${t.pronunciationScore} between 0 and 100
        and ${t.overallScore} between 0 and 100`,
    ),
    check(
      "feedback_reports_ready_complete",
      sql`${t.status} <> 'ready' or (${t.overallScore} is not null and ${t.summaryJson} is not null and ${t.generatedAt} is not null)`,
    ),
    check("feedback_reports_summary_json_is_object", sql`${t.summaryJson} is null or jsonb_typeof(${t.summaryJson}) = 'object'`),
    check("feedback_reports_metrics_is_object", sql`${t.metrics} is null or jsonb_typeof(${t.metrics}) = 'object'`),
    index("feedback_reports_user_created_idx").on(t.userId, t.createdAt),
  ],
);

/** Individual corrections from a feedback report, kept relational for progress queries. */
export const mistakes = pgTable(
  "mistakes",
  {
    id: id(),
    sessionId: uuid("session_id").notNull(),
    userId: text("user_id").notNull(),
    /** Null once the transcript is purged; the correction itself is kept. */
    transcriptLineId: bigint("transcript_line_id", { mode: "number" }).references(() => transcriptLines.id, {
      onDelete: "set null",
    }),
    category: text("category", { enum: MISTAKE_CATEGORIES }).notNull(),
    original: text("original").notNull(),
    fixed: text("fixed").notNull(),
    reason: text("reason").notNull().default(""),
    position: smallint("position").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [
    /** Ties every mistake to the feedback report of the same session and user. */
    foreignKey({
      name: "mistakes_feedback_report_fk",
      columns: [t.sessionId, t.userId],
      foreignColumns: [feedbackReports.sessionId, feedbackReports.userId],
    }).onDelete("cascade"),
    check("mistakes_category_check", oneOf(t.category, MISTAKE_CATEGORIES)),
    check("mistakes_original_length", sql`char_length(${t.original}) between 1 and 2000`),
    index("mistakes_session_user_idx").on(t.sessionId, t.userId, t.position),
    index("mistakes_user_category_idx").on(t.userId, t.category, t.createdAt),
    index("mistakes_transcript_line_idx").on(t.transcriptLineId),
  ],
);

export const xpEvents = pgTable(
  "xp_events",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    amount: integer("amount").notNull(),
    reason: text("reason", { enum: XP_REASONS }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("xp_events_user_session_reason_key").on(t.userId, t.sessionId, t.reason),
    check("xp_events_reason_check", oneOf(t.reason, XP_REASONS)),
    index("xp_events_user_created_idx").on(t.userId, t.createdAt),
  ],
);

export const reports = pgTable(
  "reports",
  {
    id: id(),
    reporterId: text("reporter_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    reportedId: text("reported_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "restrict" }),
    reason: text("reason").notNull(),
    details: text("details").notNull().default(""),
    /** Set when automated (AI) moderation flags the report. */
    aiFlag: boolean("ai_flag").notNull().default(false),
    /** Evidence location in private storage; moderators get it through a short-lived signed URL. */
    evidenceUrl: text("evidence_url"),
    status: text("status", { enum: REPORT_STATUSES }).notNull().default("open"),
    reviewedBy: text("reviewed_by").references(() => users.id, { onDelete: "restrict" }),
    reviewedAt: tz("reviewed_at"),
    resolutionNote: text("resolution_note"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    // One report per reporter per reported user per session. Automated (AI) moderation always
    // reports as the same system user, so this still allows one AI report per offender per call
    // while letting both participants be reported in the same session.
    unique("reports_reporter_reported_session_key").on(t.reporterId, t.reportedId, t.sessionId),
    check("reports_not_self", sql`${t.reporterId} <> ${t.reportedId}`),
    check("reports_reason_check", oneOf(t.reason, REPORT_REASON_VALUES)),
    check("reports_status_check", oneOf(t.status, REPORT_STATUSES)),
    check("reports_details_length", sql`char_length(${t.details}) <= 1000`),
    check(
      "reports_review_complete",
      sql`${t.status} not in ('actioned', 'dismissed') or (${t.reviewedBy} is not null and ${t.reviewedAt} is not null)`,
    ),
    index("reports_reported_created_idx").on(t.reportedId, t.createdAt),
    index("reports_ai_flag_idx")
      .on(t.createdAt)
      .where(sql`${t.aiFlag}`),
    index("reports_session_idx").on(t.sessionId),
    index("reports_open_queue_idx")
      .on(t.createdAt)
      .where(sql`${t.status} in ('open', 'under_review')`),
  ],
);

/** Append-mostly ban history. A ban is active while not revoked and not expired. */
export const bans = pgTable(
  "bans",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    /** Device fingerprint, so a banned person can't simply sign up again on the same device. */
    deviceId: text("device_id"),
    source: text("source", { enum: BAN_SOURCES }).notNull(),
    reason: text("reason").notNull(),
    reportId: bigint("report_id", { mode: "number" }).references(() => reports.id, { onDelete: "restrict" }),
    createdBy: text("created_by").references(() => users.id, { onDelete: "restrict" }),
    startsAt: tz("starts_at").notNull().defaultNow(),
    /** Null means permanent. */
    endsAt: tz("ends_at"),
    revokedAt: tz("revoked_at"),
    revokedBy: text("revoked_by").references(() => users.id, { onDelete: "restrict" }),
    revokeReason: text("revoke_reason"),
    createdAt: createdAt(),
  },
  (t) => [
    check("bans_source_check", oneOf(t.source, BAN_SOURCES)),
    check("bans_moderator_has_author", sql`${t.source} <> 'moderator' or ${t.createdBy} is not null`),
    check("bans_expiry_after_start", sql`${t.endsAt} is null or ${t.endsAt} > ${t.startsAt}`),
    check("bans_revocation_complete", sql`(${t.revokedAt} is null) = (${t.revokedBy} is null)`),
    check("bans_reason_not_blank", sql`length(trim(${t.reason})) > 0`),
    index("bans_user_created_idx").on(t.userId, t.createdAt),
    index("bans_device_idx")
      .on(t.deviceId)
      .where(sql`${t.deviceId} is not null`),
  ],
);

/** Immutable audit log of moderator/admin activity, including access to private data. */
export const adminActions = pgTable(
  "admin_actions",
  {
    id: id(),
    adminId: text("admin_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    action: text("action", { enum: ADMIN_ACTIONS }).notNull(),
    targetUserId: text("target_user_id").references(() => users.id, { onDelete: "restrict" }),
    reportId: bigint("report_id", { mode: "number" }).references(() => reports.id, { onDelete: "restrict" }),
    banId: bigint("ban_id", { mode: "number" }).references(() => bans.id, { onDelete: "restrict" }),
    sessionId: uuid("session_id").references(() => sessions.id, { onDelete: "restrict" }),
    reason: text("reason"),
    /** Before/after values or other context. Never store transcript text or credentials here. */
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [
    check("admin_actions_action_check", oneOf(t.action, ADMIN_ACTIONS)),
    check("admin_actions_metadata_is_object", sql`jsonb_typeof(${t.metadata}) = 'object'`),
    check(
      "admin_actions_has_subject",
      sql`num_nonnulls(${t.targetUserId}, ${t.reportId}, ${t.banId}, ${t.sessionId}) > 0`,
    ),
    index("admin_actions_admin_created_idx").on(t.adminId, t.createdAt),
    index("admin_actions_target_created_idx").on(t.targetUserId, t.createdAt),
    index("admin_actions_report_idx").on(t.reportId),
  ],
);
