import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  redact: {
    paths: [
      "session",
      "sessionEncrypted",
      "apiKey",
      "apiKeyEncrypted",
      "password",
      "code",
      "phone",
      "text",
      "*.session",
      "*.apiKey",
      "*.password",
      "*.code",
      "*.text",
    ],
    censor: "[REDACTED]",
  },
});
