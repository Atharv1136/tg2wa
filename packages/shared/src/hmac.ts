import crypto from "node:crypto";
import { MAX_TIMESTAMP_SKEW_MS } from "./constants";

/**
 * Generates an SHA-256 hash of a payload (or empty string if none).
 */
export function sha256(content: string = ""): string {
  return crypto.createHash("sha256").update(content, "utf8").digest("hex");
}

/**
 * Signs an internal HTTP request using HMAC-SHA256.
 * Signature message format: `${timestamp}.${method.toUpperCase()}.${path}.${sha256(body)}`
 */
export function signRequest(
  secret: string,
  method: string,
  path: string,
  body: string = "",
  timestampMs: number = Date.now()
): { timestamp: string; signature: string } {
  if (!secret) {
    throw new Error("HMAC secret is required for signing");
  }
  const timestamp = timestampMs.toString();
  const bodyHash = sha256(body);
  const payload = `${timestamp}.${method.toUpperCase()}.${path}.${bodyHash}`;
  const signature = crypto.createHmac("sha256", secret).update(payload, "utf8").digest("hex");

  return { timestamp, signature };
}

/**
 * Verifies the signature of an incoming internal HTTP request.
 * Enforces constant-time comparison and timestamp skew verification.
 */
export function verifySignature(
  secret: string,
  method: string,
  path: string,
  body: string = "",
  timestampHeader: string | undefined,
  signatureHeader: string | undefined,
  nowMs: number = Date.now()
): { valid: boolean; reason?: string } {
  if (!secret) {
    return { valid: false, reason: "MISSING_SECRET" };
  }
  if (!timestampHeader || !signatureHeader) {
    return { valid: false, reason: "MISSING_HEADERS" };
  }

  const timestamp = parseInt(timestampHeader, 10);
  if (isNaN(timestamp)) {
    return { valid: false, reason: "INVALID_TIMESTAMP" };
  }

  const skew = Math.abs(nowMs - timestamp);
  if (skew > MAX_TIMESTAMP_SKEW_MS) {
    return { valid: false, reason: "TIMESTAMP_EXPIRED" };
  }

  const bodyHash = sha256(body);
  const expectedPayload = `${timestampHeader}.${method.toUpperCase()}.${path}.${bodyHash}`;
  const expectedSignature = crypto.createHmac("sha256", secret).update(expectedPayload, "utf8").digest("hex");

  const sigBuffer = Buffer.from(signatureHeader, "hex");
  const expectedBuffer = Buffer.from(expectedSignature, "hex");

  if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
    return { valid: false, reason: "INVALID_SIGNATURE" };
  }

  return { valid: true };
}
