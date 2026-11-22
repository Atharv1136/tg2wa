import { describe, it, expect } from "vitest";
import crypto from "node:crypto";
import { encrypt, decrypt, parseEncryptionKey } from "../crypto";

describe("AES-256-GCM Crypto Module", () => {
  const validKey = crypto.randomBytes(32).toString("base64");
  const anotherKey = crypto.randomBytes(32).toString("base64");

  it("parses valid 32-byte base64 keys and rejects invalid keys", () => {
    const keyBuf = parseEncryptionKey(validKey);
    expect(keyBuf.length).toBe(32);

    expect(() => parseEncryptionKey("")).toThrow("Encryption key is required");
    expect(() => parseEncryptionKey(Buffer.from("too-short").toString("base64"))).toThrow(
      "Invalid encryption key length"
    );
  });

  it("successfully performs encryption and decryption round-trip", () => {
    const secret = "telegram-session-string-example-123456789";
    const encrypted = encrypt(secret, validKey);

    expect(encrypted.startsWith("v1:")).toBe(true);
    const decrypted = decrypt(encrypted, validKey);
    expect(decrypted).toBe(secret);
  });

  it("throws when decrypting with a different valid key", () => {
    const secret = "sensitive-api-token";
    const encrypted = encrypt(secret, validKey);

    expect(() => decrypt(encrypted, anotherKey)).toThrow();
  });

  it("detects tampered ciphertext and throws", () => {
    const secret = "test-tamper-detection";
    const encrypted = encrypt(secret, validKey);

    const parts = encrypted.split("v1:")[1];
    const buf = Buffer.from(parts, "base64");
    // Flip a bit in the ciphertext / tag
    buf[buf.length - 1] ^= 0x01;
    const tampered = `v1:${buf.toString("base64")}`;

    expect(() => decrypt(tampered, validKey)).toThrow();
  });

  it("rejects ciphertexts with unsupported or missing key version prefix", () => {
    const secret = "hello-world";
    const encrypted = encrypt(secret, validKey);
    const withoutPrefix = encrypted.replace("v1:", "");

    expect(() => decrypt(withoutPrefix, validKey)).toThrow("Unsupported key version");
  });
});
