import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96-bit IV for AES-GCM
const AUTH_TAG_LENGTH = 16;
const KEY_VERSION_PREFIX = "v1:";

/**
 * Validates and converts the base64 or hex encryption key into a 32-byte Buffer.
 */
export function parseEncryptionKey(base64Key: string): Buffer {
  if (!base64Key) {
    throw new Error("Encryption key is required");
  }
  // Support 64-character hex strings (32 bytes)
  if (/^[0-9a-fA-F]{64}$/.test(base64Key)) {
    return Buffer.from(base64Key, "hex");
  }
  const key = Buffer.from(base64Key, "base64");
  if (key.length !== 32) {
    if (Buffer.byteLength(base64Key, "utf8") === 32) {
      return Buffer.from(base64Key, "utf8");
    }
    throw new Error(`Invalid encryption key length: expected 32 bytes, got ${key.length}`);
  }
  return key;
}

/**
 * Encrypts plaintext string using AES-256-GCM.
 * Output format: "v1:<base64(iv || authTag || ciphertext)>"
 */
export function encrypt(plaintext: string, base64Key: string): string {
  if (typeof plaintext !== "string") {
    throw new Error("Plaintext must be a string");
  }
  const key = parseEncryptionKey(base64Key);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });

  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  const combined = Buffer.concat([iv, authTag, ciphertext]);
  return `${KEY_VERSION_PREFIX}${combined.toString("base64")}`;
}

/**
 * Decrypts ciphertext previously encrypted with encrypt().
 */
export function decrypt(encryptedValue: string, base64Key: string): string {
  if (!encryptedValue) {
    throw new Error("Encrypted value is required");
  }
  if (!encryptedValue.startsWith(KEY_VERSION_PREFIX)) {
    throw new Error(`Unsupported key version in ciphertext: ${encryptedValue.slice(0, 5)}`);
  }

  const rawBase64 = encryptedValue.slice(KEY_VERSION_PREFIX.length);
  const combined = Buffer.from(rawBase64, "base64");

  if (combined.length < IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error("Invalid ciphertext payload: buffer too short");
  }

  const key = parseEncryptionKey(base64Key);
  const iv = combined.subarray(0, IV_LENGTH);
  const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString("utf8");
}
