import { describe, it, expect } from "vitest";
import { getTableColumns } from "drizzle-orm";
import {
  forwardedMessages,
  telegramConnections,
  monitoredChats,
  whatsappDestinations,
  forwardingSettings,
  workerHeartbeats,
} from "../schema";

describe("Database Schema Verification", () => {
  it("strictly enforces that NO table contains message body columns", () => {
    const forwardedCols = Object.keys(getTableColumns(forwardedMessages));
    expect(forwardedCols).not.toContain("body");
    expect(forwardedCols).not.toContain("text");
    expect(forwardedCols).not.toContain("message");
    expect(forwardedCols).not.toContain("content");
    expect(forwardedCols).not.toContain("caption");

    // Check all tables
    const allTables = [
      forwardedMessages,
      telegramConnections,
      monitoredChats,
      whatsappDestinations,
      forwardingSettings,
      workerHeartbeats,
    ];

    for (const table of allTables) {
      const cols = Object.keys(getTableColumns(table));
      expect(cols).not.toContain("body");
      expect(cols).not.toContain("message_text");
    }
  });

  it("has exactly-once deduplication metadata columns on forwarded_messages", () => {
    const cols = getTableColumns(forwardedMessages);
    expect(cols.userId).toBeDefined();
    expect(cols.tgChatId).toBeDefined();
    expect(cols.tgMessageId).toBeDefined();
    expect(cols.status).toBeDefined();
    expect(cols.attempts).toBeDefined();
    expect(cols.error).toBeDefined();
  });
});
