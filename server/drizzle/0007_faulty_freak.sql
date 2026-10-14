CREATE TABLE "friendships" (
	"user_id" text NOT NULL,
	"friend_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "friendships_user_id_friend_id_pk" PRIMARY KEY("user_id","friend_id"),
	CONSTRAINT "friendships_not_self" CHECK ("friendships"."user_id" <> "friendships"."friend_id"),
	CONSTRAINT "friendships_status_check" CHECK ("friendships"."status" in ('pending', 'accepted'))
);
--> statement-breakpoint
ALTER TABLE "queue" DROP CONSTRAINT "queue_matching_mode_check";--> statement-breakpoint
ALTER TABLE "sessions" DROP CONSTRAINT "sessions_matching_mode_check";--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_friend_id_users_id_fk" FOREIGN KEY ("friend_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "friendships_pair_key" ON "friendships" USING btree (least("user_id", "friend_id"),greatest("user_id", "friend_id"));--> statement-breakpoint
CREATE INDEX "friendships_friend_status_idx" ON "friendships" USING btree ("friend_id","status");--> statement-breakpoint
ALTER TABLE "queue" ADD CONSTRAINT "queue_matching_mode_check" CHECK ("queue"."matching_mode" in ('exact_level', 'flexible_level', 'friend'));--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_matching_mode_check" CHECK ("sessions"."matching_mode" in ('exact_level', 'flexible_level', 'friend'));