import { describe, it, expect } from "vitest";
import { signRequest, verifySignature, sha256 } from "../hmac";

describe("HMAC Request Signer & Verifier", () => {
  const secret = "super-secret-internal-key-1234";
  const method = "POST";
  const path = "/internal/telegram/send-code";
  const body = JSON.stringify({ userId: "u123", phone: "+1234567890" });

  it("creates valid signature and verifies correctly", () => {
    const now = Date.now();
    const { timestamp, signature } = signRequest(secret, method, path, body, now);

    const result = verifySignature(secret, method, path, body, timestamp, signature, now);
    expect(result.valid).toBe(true);
  });

  it("rejects requests exceeding timestamp skew tolerance (> 60 seconds)", () => {
    const now = Date.now();
    const staleTime = now - 65 * 1000; // 65 seconds ago
    const { timestamp, signature } = signRequest(secret, method, path, body, staleTime);

    const result = verifySignature(secret, method, path, body, timestamp, signature, now);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("TIMESTAMP_EXPIRED");
  });

  it("rejects tampered request body", () => {
    const now = Date.now();
    const { timestamp, signature } = signRequest(secret, method, path, body, now);
    const tamperedBody = JSON.stringify({ userId: "u123", phone: "+9999999999" });

    const result = verifySignature(secret, method, path, tamperedBody, timestamp, signature, now);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("INVALID_SIGNATURE");
  });

  it("rejects request signed with incorrect secret", () => {
    const now = Date.now();
    const { timestamp, signature } = signRequest("wrong-secret", method, path, body, now);

    const result = verifySignature(secret, method, path, body, timestamp, signature, now);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("INVALID_SIGNATURE");
  });

  it("rejects requests with missing headers", () => {
    const result = verifySignature(secret, method, path, body, undefined, undefined);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("MISSING_HEADERS");
  });
});
