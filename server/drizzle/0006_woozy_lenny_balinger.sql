ALTER TABLE "xp_events" DROP CONSTRAINT "xp_events_session_id_sessions_id_fk";
--> statement-breakpoint
ALTER TABLE "xp_events" ADD CONSTRAINT "xp_events_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;