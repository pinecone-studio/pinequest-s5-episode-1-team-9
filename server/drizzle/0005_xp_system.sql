CREATE TABLE "xp_events" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "xp_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" text NOT NULL,
	"session_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "xp_events_reason_check" CHECK ("xp_events"."reason" in ('call', 'streak', 'skip_penalty'))
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "xp" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "xp_level" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "streak_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_call_date" date;--> statement-breakpoint
ALTER TABLE "xp_events" ADD CONSTRAINT "xp_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "xp_events" ADD CONSTRAINT "xp_events_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "xp_events_user_session_reason_key" ON "xp_events" USING btree ("user_id","session_id","reason");--> statement-breakpoint
CREATE INDEX "xp_events_user_created_idx" ON "xp_events" USING btree ("user_id","created_at");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_xp_nonnegative" CHECK ("users"."xp" >= 0);--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_xp_level_positive" CHECK ("users"."xp_level" >= 1);--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_streak_nonnegative" CHECK ("users"."streak_count" >= 0);