import { describe, it, expect } from "vitest";
import { formatMessage, splitMessage } from "../delivery/format";

describe("Message Formatter & Splitter", () => {
  it("formats messages according to PRD with group title and sender name", () => {
    const formatted = formatMessage("Hello world alert", {
      groupTitle: "Crypto Alerts",
      senderName: "Alice",
      includeSenderName: true,
      hasMedia: false,
    });

    expect(formatted).toBe("📩 Crypto Alerts\n👤 Alice\n\nHello world alert");
  });

  it("appends paperclip note when media is present with caption", () => {
    const formatted = formatMessage("Chart image caption", {
      groupTitle: "Stock Discussions",
      hasMedia: true,
    });

    expect(formatted).toContain("📎 (media not forwarded)");
  });

  it("splits messages exceeding 1500 characters cleanly with part numbers", () => {
    const longText = "A".repeat(3200);
    const parts = splitMessage(longText, 1500);

    expect(parts.length).toBeGreaterThan(1);
    expect(parts[0]).toContain("(1/");
    expect(parts[parts.length - 1]).toContain(`(${parts.length}/${parts.length})`);
  });
});
