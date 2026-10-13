CREATE TABLE "admin_actions" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "admin_actions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"admin_id" text NOT NULL,
	"action" text NOT NULL,
	"target_user_id" text,
	"report_id" bigint,
	"ban_id" bigint,
	"session_id" uuid,
	"reason" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_actions_action_check" CHECK ("admin_actions"."action" in ('ban_user', 'revoke_ban', 'review_report', 'dismiss_report', 'change_role', 'view_transcript', 'view_evidence', 'delete_user_data')),
	CONSTRAINT "admin_actions_metadata_is_object" CHECK (jsonb_typeof("admin_actions"."metadata") = 'object'),
	CONSTRAINT "admin_actions_has_subject" CHECK (num_nonnulls("admin_actions"."target_user_id", "admin_actions"."report_id", "admin_actions"."ban_id", "admin_actions"."session_id") > 0)
);
--> statement-breakpoint
CREATE TABLE "bans" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "bans_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" text NOT NULL,
	"source" text NOT NULL,
	"reason" text NOT NULL,
	"report_id" bigint,
	"created_by" text,
	"starts_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"revoked_by" text,
	"revoke_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bans_source_check" CHECK ("bans"."source" in ('automatic', 'moderator')),
	CONSTRAINT "bans_moderator_has_author" CHECK ("bans"."source" <> 'moderator' or "bans"."created_by" is not null),
	CONSTRAINT "bans_expiry_after_start" CHECK ("bans"."expires_at" is null or "bans"."expires_at" > "bans"."starts_at"),
	CONSTRAINT "bans_revocation_complete" CHECK (("bans"."revoked_at" is null) = ("bans"."revoked_by" is null)),
	CONSTRAINT "bans_reason_not_blank" CHECK (length(trim("bans"."reason")) > 0)
);
--> statement-breakpoint
CREATE TABLE "feedback_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"status_message" text,
	"target_language" text NOT NULL,
	"level" text NOT NULL,
	"estimated_performance" text,
	"grammar_score" smallint,
	"vocabulary_score" smallint,
	"fluency_score" smallint,
	"pronunciation_score" smallint,
	"overall_score" smallint,
	"summary" text,
	"details" jsonb,
	"metrics" jsonb,
	"ai_model" text,
	"generated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "feedback_reports_session_user_key" UNIQUE("session_id","user_id"),
	CONSTRAINT "feedback_reports_status_check" CHECK ("feedback_reports"."status" in ('pending', 'ready', 'insufficient_data', 'no_consent', 'failed')),
	CONSTRAINT "feedback_reports_level_check" CHECK ("feedback_reports"."level" in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
	CONSTRAINT "feedback_reports_scores_range" CHECK ("feedback_reports"."grammar_score" between 0 and 100 and "feedback_reports"."vocabulary_score" between 0 and 100
        and "feedback_reports"."fluency_score" between 0 and 100 and "feedback_reports"."pronunciation_score" between 0 and 100
        and "feedback_reports"."overall_score" between 0 and 100),
	CONSTRAINT "feedback_reports_ready_complete" CHECK ("feedback_reports"."status" <> 'ready' or ("feedback_reports"."overall_score" is not null and "feedback_reports"."details" is not null and "feedback_reports"."generated_at" is not null)),
	CONSTRAINT "feedback_reports_details_is_object" CHECK ("feedback_reports"."details" is null or jsonb_typeof("feedback_reports"."details") = 'object'),
	CONSTRAINT "feedback_reports_metrics_is_object" CHECK ("feedback_reports"."metrics" is null or jsonb_typeof("feedback_reports"."metrics") = 'object')
);
--> statement-breakpoint
CREATE TABLE "mistakes" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "mistakes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"session_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"transcript_line_id" bigint,
	"category" text NOT NULL,
	"original_text" text NOT NULL,
	"corrected_text" text NOT NULL,
	"explanation" text DEFAULT '' NOT NULL,
	"position" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mistakes_category_check" CHECK ("mistakes"."category" in ('grammar', 'vocabulary', 'sentence_structure', 'word_choice')),
	CONSTRAINT "mistakes_original_length" CHECK (char_length("mistakes"."original_text") between 1 and 2000)
);
--> statement-breakpoint
CREATE TABLE "queue" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "queue_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" text NOT NULL,
	"target_language" text NOT NULL,
	"level" text NOT NULL,
	"native_language" text,
	"matching_mode" text DEFAULT 'flexible_level' NOT NULL,
	"status" text DEFAULT 'waiting' NOT NULL,
	"session_id" uuid,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	CONSTRAINT "queue_level_check" CHECK ("queue"."level" in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
	CONSTRAINT "queue_matching_mode_check" CHECK ("queue"."matching_mode" in ('exact_level', 'flexible_level')),
	CONSTRAINT "queue_status_check" CHECK ("queue"."status" in ('waiting', 'matched', 'cancelled', 'expired')),
	CONSTRAINT "queue_resolved_consistency" CHECK (("queue"."status" = 'waiting') = ("queue"."resolved_at" is null)),
	CONSTRAINT "queue_matched_has_session" CHECK ("queue"."status" <> 'matched' or "queue"."session_id" is not null)
);
--> statement-breakpoint
CREATE TABLE "recent_partners" (
	"user_id" text NOT NULL,
	"partner_id" text NOT NULL,
	"last_session_id" uuid,
	"last_matched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"match_count" bigint DEFAULT 1 NOT NULL,
	CONSTRAINT "recent_partners_user_id_partner_id_pk" PRIMARY KEY("user_id","partner_id"),
	CONSTRAINT "recent_partners_not_self" CHECK ("recent_partners"."user_id" <> "recent_partners"."partner_id"),
	CONSTRAINT "recent_partners_match_count_positive" CHECK ("recent_partners"."match_count" > 0)
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "reports_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"reporter_id" text NOT NULL,
	"reported_user_id" text NOT NULL,
	"session_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"details" text DEFAULT '' NOT NULL,
	"evidence_keys" text[] DEFAULT '{}'::text[] NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"reviewed_by" text,
	"reviewed_at" timestamp with time zone,
	"resolution_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reports_reporter_session_key" UNIQUE("reporter_id","session_id"),
	CONSTRAINT "reports_not_self" CHECK ("reports"."reporter_id" <> "reports"."reported_user_id"),
	CONSTRAINT "reports_reason_check" CHECK ("reports"."reason" in ('harassment', 'sexual', 'hate', 'minor', 'spam', 'not_practicing', 'other')),
	CONSTRAINT "reports_status_check" CHECK ("reports"."status" in ('open', 'under_review', 'actioned', 'dismissed')),
	CONSTRAINT "reports_details_length" CHECK (char_length("reports"."details") <= 1000),
	CONSTRAINT "reports_evidence_limit" CHECK (cardinality("reports"."evidence_keys") <= 10),
	CONSTRAINT "reports_review_complete" CHECK ("reports"."status" not in ('actioned', 'dismissed') or ("reports"."reviewed_by" is not null and "reports"."reviewed_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_a_id" text NOT NULL,
	"user_b_id" text NOT NULL,
	"target_language" text NOT NULL,
	"user_a_level" text NOT NULL,
	"user_b_level" text NOT NULL,
	"matching_mode" text NOT NULL,
	"level_distance" smallint DEFAULT 0 NOT NULL,
	"user_a_transcription_consent" boolean DEFAULT false NOT NULL,
	"user_b_transcription_consent" boolean DEFAULT false NOT NULL,
	"topics" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"end_reason" text,
	"ended_by" text,
	"user_a_joined_at" timestamp with time zone,
	"user_b_joined_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"transcript_purged_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_distinct_users" CHECK ("sessions"."user_a_id" <> "sessions"."user_b_id"),
	CONSTRAINT "sessions_user_a_level_check" CHECK ("sessions"."user_a_level" in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
	CONSTRAINT "sessions_user_b_level_check" CHECK ("sessions"."user_b_level" in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
	CONSTRAINT "sessions_matching_mode_check" CHECK ("sessions"."matching_mode" in ('exact_level', 'flexible_level')),
	CONSTRAINT "sessions_level_distance_range" CHECK ("sessions"."level_distance" between 0 and 5),
	CONSTRAINT "sessions_status_check" CHECK ("sessions"."status" in ('pending', 'active', 'ended')),
	CONSTRAINT "sessions_end_reason_check" CHECK ("sessions"."end_reason" in ('ended', 'next', 'partner_left', 'disconnected', 'blocked', 'reported')),
	CONSTRAINT "sessions_ended_consistency" CHECK (("sessions"."status" = 'ended') = ("sessions"."ended_at" is not null and "sessions"."end_reason" is not null)),
	CONSTRAINT "sessions_started_when_active" CHECK ("sessions"."status" <> 'active' or "sessions"."started_at" is not null),
	CONSTRAINT "sessions_ended_by_participant" CHECK ("sessions"."ended_by" is null or "sessions"."ended_by" in ("sessions"."user_a_id", "sessions"."user_b_id")),
	CONSTRAINT "sessions_topics_is_array" CHECK (jsonb_typeof("sessions"."topics") = 'array')
);
--> statement-breakpoint
CREATE TABLE "transcript_lines" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "transcript_lines_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"session_id" uuid NOT NULL,
	"speaker_id" text NOT NULL,
	"text" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone NOT NULL,
	"confidence" real,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transcript_lines_text_length" CHECK (char_length("transcript_lines"."text") between 1 and 2000),
	CONSTRAINT "transcript_lines_time_order" CHECK ("transcript_lines"."ended_at" >= "transcript_lines"."started_at"),
	CONSTRAINT "transcript_lines_confidence_range" CHECK ("transcript_lines"."confidence" is null or ("transcript_lines"."confidence" > 0 and "transcript_lines"."confidence" <= 1))
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"role" text DEFAULT 'user' NOT NULL,
	"native_language" text,
	"target_languages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"active_target_language" text,
	"transcription_consent" boolean DEFAULT false NOT NULL,
	"retain_transcripts" boolean DEFAULT false NOT NULL,
	"rules_accepted_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_id_not_blank" CHECK (length("users"."id") > 0),
	CONSTRAINT "users_username_format" CHECK ("users"."username" ~ '^[A-Za-z0-9_]{3,24}$'),
	CONSTRAINT "users_role_check" CHECK ("users"."role" in ('user', 'moderator', 'admin')),
	CONSTRAINT "users_target_languages_is_array" CHECK (jsonb_typeof("users"."target_languages") = 'array')
);
--> statement-breakpoint
ALTER TABLE "admin_actions" ADD CONSTRAINT "admin_actions_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_actions" ADD CONSTRAINT "admin_actions_target_user_id_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_actions" ADD CONSTRAINT "admin_actions_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_actions" ADD CONSTRAINT "admin_actions_ban_id_bans_id_fk" FOREIGN KEY ("ban_id") REFERENCES "public"."bans"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_actions" ADD CONSTRAINT "admin_actions_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bans" ADD CONSTRAINT "bans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bans" ADD CONSTRAINT "bans_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bans" ADD CONSTRAINT "bans_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bans" ADD CONSTRAINT "bans_revoked_by_users_id_fk" FOREIGN KEY ("revoked_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_reports" ADD CONSTRAINT "feedback_reports_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_reports" ADD CONSTRAINT "feedback_reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mistakes" ADD CONSTRAINT "mistakes_transcript_line_id_transcript_lines_id_fk" FOREIGN KEY ("transcript_line_id") REFERENCES "public"."transcript_lines"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mistakes" ADD CONSTRAINT "mistakes_feedback_report_fk" FOREIGN KEY ("session_id","user_id") REFERENCES "public"."feedback_reports"("session_id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "queue" ADD CONSTRAINT "queue_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "queue" ADD CONSTRAINT "queue_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recent_partners" ADD CONSTRAINT "recent_partners_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recent_partners" ADD CONSTRAINT "recent_partners_partner_id_users_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recent_partners" ADD CONSTRAINT "recent_partners_last_session_id_sessions_id_fk" FOREIGN KEY ("last_session_id") REFERENCES "public"."sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reported_user_id_users_id_fk" FOREIGN KEY ("reported_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_a_id_users_id_fk" FOREIGN KEY ("user_a_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_b_id_users_id_fk" FOREIGN KEY ("user_b_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_ended_by_users_id_fk" FOREIGN KEY ("ended_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transcript_lines" ADD CONSTRAINT "transcript_lines_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transcript_lines" ADD CONSTRAINT "transcript_lines_speaker_id_users_id_fk" FOREIGN KEY ("speaker_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_actions_admin_created_idx" ON "admin_actions" USING btree ("admin_id","created_at");--> statement-breakpoint
CREATE INDEX "admin_actions_target_created_idx" ON "admin_actions" USING btree ("target_user_id","created_at");--> statement-breakpoint
CREATE INDEX "admin_actions_report_idx" ON "admin_actions" USING btree ("report_id");--> statement-breakpoint
CREATE INDEX "bans_user_created_idx" ON "bans" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "feedback_reports_user_created_idx" ON "feedback_reports" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "mistakes_session_user_idx" ON "mistakes" USING btree ("session_id","user_id","position");--> statement-breakpoint
CREATE INDEX "mistakes_user_category_idx" ON "mistakes" USING btree ("user_id","category","created_at");--> statement-breakpoint
CREATE INDEX "mistakes_transcript_line_idx" ON "mistakes" USING btree ("transcript_line_id");--> statement-breakpoint
CREATE UNIQUE INDEX "queue_one_waiting_entry_per_user" ON "queue" USING btree ("user_id") WHERE "queue"."status" = 'waiting';--> statement-breakpoint
CREATE INDEX "queue_waiting_match_idx" ON "queue" USING btree ("target_language","level","joined_at") WHERE "queue"."status" = 'waiting';--> statement-breakpoint
CREATE INDEX "queue_resolved_at_idx" ON "queue" USING btree ("resolved_at");--> statement-breakpoint
CREATE INDEX "recent_partners_user_recent_idx" ON "recent_partners" USING btree ("user_id","last_matched_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "recent_partners_partner_idx" ON "recent_partners" USING btree ("partner_id");--> statement-breakpoint
CREATE INDEX "reports_reported_user_created_idx" ON "reports" USING btree ("reported_user_id","created_at");--> statement-breakpoint
CREATE INDEX "reports_session_idx" ON "reports" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "reports_open_queue_idx" ON "reports" USING btree ("created_at") WHERE "reports"."status" in ('open', 'under_review');--> statement-breakpoint
CREATE INDEX "sessions_user_a_created_idx" ON "sessions" USING btree ("user_a_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "sessions_user_b_created_idx" ON "sessions" USING btree ("user_b_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "sessions_open_idx" ON "sessions" USING btree ("status") WHERE "sessions"."status" in ('pending', 'active');--> statement-breakpoint
CREATE INDEX "sessions_purge_idx" ON "sessions" USING btree ("ended_at") WHERE "sessions"."status" = 'ended' and "sessions"."transcript_purged_at" is null;--> statement-breakpoint
CREATE INDEX "transcript_lines_session_speaker_idx" ON "transcript_lines" USING btree ("session_id","speaker_id","started_at");--> statement-breakpoint
CREATE INDEX "transcript_lines_speaker_idx" ON "transcript_lines" USING btree ("speaker_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_lower_key" ON "users" USING btree (lower("username"));