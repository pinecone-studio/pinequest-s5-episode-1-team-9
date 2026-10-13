-- Align column names with the team's table spec and add the spec's missing columns.
-- Renames keep every row; new columns are nullable or have defaults.

-- users
ALTER TABLE "users" RENAME COLUMN "username" TO "name";--> statement-breakpoint
ALTER TABLE "users" RENAME COLUMN "native_language" TO "native_lang";--> statement-breakpoint
ALTER TABLE "users" RENAME COLUMN "active_target_language" TO "target_lang";--> statement-breakpoint
ALTER INDEX "users_username_lower_key" RENAME TO "users_name_lower_key";--> statement-breakpoint
ALTER TABLE "users" RENAME CONSTRAINT "users_username_format" TO "users_name_format";--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_adult" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- Accepting the rules has always included confirming 18+.
UPDATE "users" SET "is_adult" = true WHERE "rules_accepted_at" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "level" text GENERATED ALWAYS AS (jsonb_path_query_first(target_languages, '$[*] ? (@.language == $l).level', jsonb_object(ARRAY['l', target_lang])) #>> '{}') STORED;--> statement-breakpoint

-- queue
ALTER TABLE "queue" RENAME COLUMN "target_language" TO "lang";--> statement-breakpoint
ALTER TABLE "queue" ADD COLUMN "mode" text DEFAULT 'video' NOT NULL;--> statement-breakpoint
ALTER TABLE "queue" ADD CONSTRAINT "queue_mode_check" CHECK ("queue"."mode" in ('video', 'voice'));--> statement-breakpoint

-- sessions
ALTER TABLE "sessions" RENAME COLUMN "user_a_id" TO "user_a";--> statement-breakpoint
ALTER TABLE "sessions" RENAME COLUMN "user_b_id" TO "user_b";--> statement-breakpoint
ALTER TABLE "sessions" RENAME COLUMN "target_language" TO "lang";--> statement-breakpoint
ALTER TABLE "sessions" RENAME CONSTRAINT "sessions_user_a_id_users_id_fk" TO "sessions_user_a_users_id_fk";--> statement-breakpoint
ALTER TABLE "sessions" RENAME CONSTRAINT "sessions_user_b_id_users_id_fk" TO "sessions_user_b_users_id_fk";--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "room_name" text NOT NULL GENERATED ALWAYS AS ('lm-' || id::text) STORED;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_room_name_key" UNIQUE("room_name");--> statement-breakpoint

-- recent_partners
ALTER TABLE "recent_partners" RENAME COLUMN "last_matched_at" TO "met_at";--> statement-breakpoint

-- transcript_lines
ALTER TABLE "transcript_lines" RENAME COLUMN "speaker_id" TO "user_id";--> statement-breakpoint
ALTER TABLE "transcript_lines" RENAME COLUMN "started_at" TO "spoken_at";--> statement-breakpoint
ALTER TABLE "transcript_lines" RENAME CONSTRAINT "transcript_lines_speaker_id_users_id_fk" TO "transcript_lines_user_id_users_id_fk";--> statement-breakpoint
ALTER INDEX "transcript_lines_session_speaker_idx" RENAME TO "transcript_lines_session_user_idx";--> statement-breakpoint
ALTER INDEX "transcript_lines_speaker_idx" RENAME TO "transcript_lines_user_idx";--> statement-breakpoint

-- mistakes
ALTER TABLE "mistakes" RENAME COLUMN "original_text" TO "original";--> statement-breakpoint
ALTER TABLE "mistakes" RENAME COLUMN "corrected_text" TO "fixed";--> statement-breakpoint
ALTER TABLE "mistakes" RENAME COLUMN "explanation" TO "reason";--> statement-breakpoint

-- feedback_reports
ALTER TABLE "feedback_reports" RENAME COLUMN "grammar_score" TO "grammar";--> statement-breakpoint
ALTER TABLE "feedback_reports" RENAME COLUMN "vocabulary_score" TO "vocabulary";--> statement-breakpoint
ALTER TABLE "feedback_reports" RENAME COLUMN "fluency_score" TO "fluency";--> statement-breakpoint
ALTER TABLE "feedback_reports" RENAME COLUMN "details" TO "summary_json";--> statement-breakpoint
ALTER TABLE "feedback_reports" RENAME CONSTRAINT "feedback_reports_details_is_object" TO "feedback_reports_summary_json_is_object";--> statement-breakpoint

-- reports
ALTER TABLE "reports" RENAME COLUMN "reported_user_id" TO "reported_id";--> statement-breakpoint
ALTER TABLE "reports" RENAME CONSTRAINT "reports_reported_user_id_users_id_fk" TO "reports_reported_id_users_id_fk";--> statement-breakpoint
ALTER INDEX "reports_reported_user_created_idx" RENAME TO "reports_reported_created_idx";--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "ai_flag" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "reports_ai_flag_idx" ON "reports" USING btree ("created_at") WHERE "reports"."ai_flag";--> statement-breakpoint
-- evidence_keys (text[]) becomes a single evidence_url. Refuse rather than drop extra keys.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "reports" WHERE cardinality("evidence_keys") > 1) THEN
    RAISE EXCEPTION 'reports with more than one evidence key exist; migrate them by hand first';
  END IF;
END;
$$;--> statement-breakpoint
ALTER TABLE "reports" DROP CONSTRAINT "reports_evidence_limit";--> statement-breakpoint
ALTER TABLE "reports" ALTER COLUMN "evidence_keys" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "reports" ALTER COLUMN "evidence_keys" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "reports" ALTER COLUMN "evidence_keys" SET DATA TYPE text USING "evidence_keys"[1];--> statement-breakpoint
ALTER TABLE "reports" RENAME COLUMN "evidence_keys" TO "evidence_url";--> statement-breakpoint

-- bans
ALTER TABLE "bans" RENAME COLUMN "expires_at" TO "ends_at";--> statement-breakpoint
ALTER TABLE "bans" ADD COLUMN "device_id" text;--> statement-breakpoint
CREATE INDEX "bans_device_idx" ON "bans" USING btree ("device_id") WHERE "bans"."device_id" is not null;--> statement-breakpoint

-- Triggers from 0001 that name renamed columns.
CREATE OR REPLACE FUNCTION enforce_session_participant() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  member_id text := to_jsonb(NEW) ->> TG_ARGV[0];
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM sessions s
    WHERE s.id = NEW.session_id AND member_id IN (s.user_a, s.user_b)
  ) THEN
    RAISE EXCEPTION '%.% (%) is not a participant of session %', TG_TABLE_NAME, TG_ARGV[0], member_id, NEW.session_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint
DROP TRIGGER "transcript_lines_1_speaker_is_participant" ON "transcript_lines";--> statement-breakpoint
-- Triggers fire in name order: participant check (1) runs before the consent check (2).
CREATE TRIGGER transcript_lines_1_user_is_participant
  BEFORE INSERT OR UPDATE OF session_id, user_id ON transcript_lines
  FOR EACH ROW EXECUTE FUNCTION enforce_session_participant('user_id');--> statement-breakpoint
CREATE OR REPLACE FUNCTION enforce_transcript_consent() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM sessions s
    WHERE s.id = NEW.session_id
      AND ((NEW.user_id = s.user_a AND s.user_a_transcription_consent)
        OR (NEW.user_id = s.user_b AND s.user_b_transcription_consent))
  ) THEN
    RAISE EXCEPTION 'user % did not consent to transcription in session %', NEW.user_id, NEW.session_id
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
