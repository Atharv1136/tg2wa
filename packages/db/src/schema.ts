import {
  pgTable,
  pgEnum,
  text,
  boolean,
  integer,
  timestamp,
  bigint,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { users } from "./auth";

export const telegramStatus = pgEnum("telegram_status", [
  "not_connected",
  "code_sent",
  "password_required",
  "connected",
  "session_expired",
  "error",
]);

export const whatsappStatus = pgEnum("whatsapp_status", [
  "unverified",
  "pending_confirmation",
  "verified",
  "degraded",
]);

export const forwardStatus = pgEnum("forward_status", [
  "queued",
  "sent",
  "failed",
  "skipped",
]);

export const telegramConnections = pgTable(
  "telegram_connections",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: telegramStatus("status").notNull().default("not_connected"),
    sessionEncrypted: text("session_encrypted"), // AES-256-GCM: base64(iv|tag|ciphertext)
    phoneMasked: text("phone_masked"), // e.g. "••••• 4821"
    tgUserId: text("tg_user_id"),
    tgDisplayName: text("tg_display_name"),
    tgUsername: text("tg_username"),
    lastError: text("last_error"), // short code/message, never secrets
    connectedAt: timestamp("connected_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    uniqUser: uniqueIndex("tg_conn_user_uq").on(t.userId),
  })
);

export const monitoredChats = pgTable(
  "monitored_chats",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tgChatId: text("tg_chat_id").notNull(), // string: ids exceed JS safe ints (e.g. -100…)
    title: text("title").notNull(),
    chatType: text("chat_type").notNull(), // group | supergroup | channel
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    uniqUserChat: uniqueIndex("mon_chat_user_chat_uq").on(t.userId, t.tgChatId),
    byUser: index("mon_chat_user_idx").on(t.userId),
  })
);

export const whatsappDestinations = pgTable(
  "whatsapp_destinations",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: whatsappStatus("status").notNull().default("unverified"),
    provider: text("provider").notNull().default("callmebot"),
    phoneE164: text("phone_e164").notNull(), // user's own number; treat as PII
    apiKeyEncrypted: text("api_key_encrypted").notNull(),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    lastTestAt: timestamp("last_test_at", { withTimezone: true }),
    consecutiveFailures: integer("consecutive_failures").notNull().default(0),
    lastError: text("last_error"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    uniqUser: uniqueIndex("wa_dest_user_uq").on(t.userId),
  })
);

export const forwardingSettings = pgTable("forwarding_settings", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  enabled: boolean("enabled").notNull().default(false),
  includeSenderName: boolean("include_sender_name").notNull().default(true),
  forwardOwnMessages: boolean("forward_own_messages").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const forwardedMessages = pgTable(
  "forwarded_messages",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tgChatId: text("tg_chat_id").notNull(),
    tgMessageId: bigint("tg_message_id", { mode: "number" }).notNull(),
    status: forwardStatus("status").notNull().default("queued"),
    attempts: integer("attempts").notNull().default(0),
    error: text("error"), // short reason, no content
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
  },
  (t) => ({
    uniqMsg: uniqueIndex("fwd_msg_uq").on(t.userId, t.tgChatId, t.tgMessageId), // exactly-once
    byUserTime: index("fwd_user_time_idx").on(t.userId, t.createdAt),
  })
);

export const workerHeartbeats = pgTable("worker_heartbeats", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  state: text("state").notNull(), // running | stopped | error
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  workerVersion: text("worker_version"),
});
