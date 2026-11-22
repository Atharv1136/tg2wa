DO $$ BEGIN
 CREATE TYPE "forward_status" AS ENUM('queued', 'sent', 'failed', 'skipped');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "telegram_status" AS ENUM('not_connected', 'code_sent', 'password_required', 'connected', 'session_expired', 'error');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "whatsapp_status" AS ENUM('unverified', 'pending_confirmation', 'verified', 'degraded');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "accounts" (
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "accounts_provider_provider_account_id_pk" PRIMARY KEY("provider","provider_account_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sessions" (
	"session_token" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"expires" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"email" text NOT NULL,
	"email_verified" timestamp,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "verification_tokens" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp NOT NULL,
	CONSTRAINT "verification_tokens_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "forwarded_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"tg_chat_id" text NOT NULL,
	"tg_message_id" bigint NOT NULL,
	"status" "forward_status" DEFAULT 'queued' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "forwarding_settings" (
	"user_id" text PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"include_sender_name" boolean DEFAULT true NOT NULL,
	"forward_own_messages" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "monitored_chats" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"tg_chat_id" text NOT NULL,
	"title" text NOT NULL,
	"chat_type" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "telegram_connections" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"status" "telegram_status" DEFAULT 'not_connected' NOT NULL,
	"session_encrypted" text,
	"phone_masked" text,
	"tg_user_id" text,
	"tg_display_name" text,
	"tg_username" text,
	"last_error" text,
	"connected_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "whatsapp_destinations" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"status" "whatsapp_status" DEFAULT 'unverified' NOT NULL,
	"phone_e164" text NOT NULL,
	"api_key_encrypted" text NOT NULL,
	"verified_at" timestamp with time zone,
	"last_test_at" timestamp with time zone,
	"consecutive_failures" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "worker_heartbeats" (
	"user_id" text PRIMARY KEY NOT NULL,
	"state" text NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"worker_version" text
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "fwd_msg_uq" ON "forwarded_messages" ("user_id","tg_chat_id","tg_message_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fwd_user_time_idx" ON "forwarded_messages" ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "mon_chat_user_chat_uq" ON "monitored_chats" ("user_id","tg_chat_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mon_chat_user_idx" ON "monitored_chats" ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "tg_conn_user_uq" ON "telegram_connections" ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "wa_dest_user_uq" ON "whatsapp_destinations" ("user_id");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "forwarded_messages" ADD CONSTRAINT "forwarded_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "forwarding_settings" ADD CONSTRAINT "forwarding_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "monitored_chats" ADD CONSTRAINT "monitored_chats_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "telegram_connections" ADD CONSTRAINT "telegram_connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "whatsapp_destinations" ADD CONSTRAINT "whatsapp_destinations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "worker_heartbeats" ADD CONSTRAINT "worker_heartbeats_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
