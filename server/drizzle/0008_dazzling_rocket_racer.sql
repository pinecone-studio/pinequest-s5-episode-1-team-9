ALTER TABLE "xp_events" DROP CONSTRAINT "xp_events_reason_check";--> statement-breakpoint
DROP INDEX "xp_events_user_session_reason_key";--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "chat_evidence" jsonb;--> statement-breakpoint
ALTER TABLE "xp_events" ADD COLUMN "detail" text;--> statement-breakpoint
CREATE UNIQUE INDEX "xp_events_user_session_reason_key" ON "xp_events" USING btree ("user_id","session_id","reason",coalesce("detail", ''));--> statement-breakpoint
ALTER TABLE "xp_events" ADD CONSTRAINT "xp_events_reason_check" CHECK ("xp_events"."reason" in ('call', 'streak', 'skip_penalty', 'word', 'quiz'));