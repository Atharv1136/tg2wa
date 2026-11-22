import { z } from "zod";
import { TelegramStatus, WhatsAppStatus, ForwardStatus, ForwardingState, WorkerState } from "./status";

export const PhoneSchema = z
  .string()
  .regex(/^\+[1-9]\d{6,14}$/, "Must be a valid international phone number in E.164 format (e.g. +1234567890)");

export const SendCodeInputSchema = z.object({
  phone: PhoneSchema,
});

export const VerifyCodeInputSchema = z.object({
  code: z.string().min(3).max(10).trim(),
});

export const VerifyPasswordInputSchema = z.object({
  password: z.string().min(1, "Password cannot be empty"),
});

export const MonitoredChatInputSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  type: z.enum(["group", "supergroup", "channel"]),
});

export const SaveGroupsInputSchema = z.object({
  chats: z.array(MonitoredChatInputSchema),
});

export const WhatsAppDestinationSchema = z
  .string()
  .min(3)
  .trim()
  .refine(
    (val) => {
      // E.164 or international phone number
      if (/^\+?[1-9]\d{6,14}$/.test(val)) return true;
      // WhatsApp Group JID ending in @g.us (format: 120363xxxxxx@g.us)
      if (/^[0-9a-zA-Z_\-]+@g\.us$/i.test(val)) return true;
      return false;
    },
    {
      message: "Must be a valid international phone number (e.g. +919561706020) or numeric WhatsApp Group ID (e.g. 120363xxxxxx@g.us)",
    }
  );

export const SaveWhatsAppInputSchema = z.object({
  phone: WhatsAppDestinationSchema,
  apiKey: z.string().min(1).trim(),
  provider: z.enum(["callmebot", "textmebot"]).optional().default("callmebot"),
});

export const ConfirmWhatsAppInputSchema = z.object({
  received: z.boolean(),
});

export const ForwardingSettingsInputSchema = z.object({
  includeSenderName: z.boolean().optional(),
  forwardOwnMessages: z.boolean().optional(),
});

export const DeleteAccountInputSchema = z.object({
  confirm: z.literal("DELETE"),
});

export const StatusResponseSchema = z.object({
  telegram: z.object({
    status: z.nativeEnum(TelegramStatus),
    displayName: z.string().nullable().optional(),
    username: z.string().nullable().optional(),
    phoneMasked: z.string().nullable().optional(),
    lastError: z.string().nullable().optional(),
  }),
  whatsapp: z.object({
    status: z.nativeEnum(WhatsAppStatus),
    phoneMasked: z.string().nullable().optional(),
    verifiedAt: z.string().nullable().optional(),
    lastError: z.string().nullable().optional(),
  }),
  forwarding: z.object({
    status: z.nativeEnum(ForwardingState),
    enabled: z.boolean(),
  }),
  worker: z.object({
    state: z.nativeEnum(WorkerState),
    lastSeenAt: z.string().nullable().optional(),
  }),
  counters: z.object({
    sentToday: z.number(),
    failedToday: z.number(),
    lastSentAt: z.string().nullable().optional(),
  }),
  setup: z.object({
    telegram: z.boolean(),
    groups: z.boolean(),
    whatsapp: z.boolean(),
  }),
});
