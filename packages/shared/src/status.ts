export const TelegramStatus = {
  NOT_CONNECTED: "not_connected",
  CODE_SENT: "code_sent",
  PASSWORD_REQUIRED: "password_required",
  CONNECTED: "connected",
  SESSION_EXPIRED: "session_expired",
  ERROR: "error",
} as const;
export type TelegramStatusType = (typeof TelegramStatus)[keyof typeof TelegramStatus];

export const WhatsAppStatus = {
  UNVERIFIED: "unverified",
  PENDING_CONFIRMATION: "pending_confirmation",
  VERIFIED: "verified",
  DEGRADED: "degraded",
} as const;
export type WhatsAppStatusType = (typeof WhatsAppStatus)[keyof typeof WhatsAppStatus];

export const ForwardStatus = {
  QUEUED: "queued",
  SENT: "sent",
  FAILED: "failed",
  SKIPPED: "skipped",
} as const;
export type ForwardStatusType = (typeof ForwardStatus)[keyof typeof ForwardStatus];

export const WorkerState = {
  ONLINE: "online",
  OFFLINE: "offline",
} as const;
export type WorkerStateType = (typeof WorkerState)[keyof typeof WorkerState];

export const ForwardingState = {
  STOPPED: "stopped",
  RUNNING: "running",
  BLOCKED: "blocked",
} as const;
export type ForwardingStateType = (typeof ForwardingState)[keyof typeof ForwardingState];
