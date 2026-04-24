import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// AES-256-GCM encryption for integration credentials.
// Key must be a 64-char hex string (32 bytes).

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12; // 96-bit IV recommended for GCM
const TAG_BYTES = 16;

function getKey(): Buffer {
  const hex = process.env.INTEGRATIONS_ENC_KEY;
  if (!hex) {
    throw new Error(
      "INTEGRATIONS_ENC_KEY is not set. " +
        "Generate one with: openssl rand -hex 32",
    );
  }
  if (hex.length !== 64) {
    throw new Error(
      `INTEGRATIONS_ENC_KEY must be a 64-char hex string (32 bytes). Got length ${hex.length}.`,
    );
  }
  return Buffer.from(hex, "hex");
}

export type EncryptedBlob = {
  ciphertext: string; // base64
  iv: string; // base64
  tag: string; // base64
};

export function encrypt(plaintext: string): EncryptedBlob {
  const key = getKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return {
    ciphertext: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
  };
}

export function decrypt(
  ciphertext: string,
  iv: string,
  tag: string,
): string {
  const key = getKey();
  const ivBuf = Buffer.from(iv, "base64");
  const tagBuf = Buffer.from(tag, "base64");
  const ciphertextBuf = Buffer.from(ciphertext, "base64");

  if (tagBuf.length !== TAG_BYTES) {
    throw new Error(`Invalid auth tag length: expected ${TAG_BYTES}, got ${tagBuf.length}`);
  }

  const decipher = createDecipheriv(ALGORITHM, key, ivBuf);
  decipher.setAuthTag(tagBuf);

  const decrypted = Buffer.concat([
    decipher.update(ciphertextBuf),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}
