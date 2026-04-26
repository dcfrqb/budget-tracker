import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// AES-256-GCM encryption for integration credentials.
// Primary key: INTEGRATIONS_ENC_KEY (version 1) — 64-char hex string (32 bytes).
// Additional versions: INTEGRATIONS_ENC_KEY_V2, INTEGRATIONS_ENC_KEY_V3, etc.
//
// Key rotation:
//   1. Generate new key: openssl rand -hex 32
//   2. Add as INTEGRATIONS_ENC_KEY_V<N+1> in .env
//   3. Run: tsx scripts/rotate-integrations-key.ts
//   4. After all rows migrated, old key can be removed.

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12; // 96-bit IV recommended for GCM
const TAG_BYTES = 16;

// ── Key registry ─────────────────────────────────────────────

let _keyCache: Map<number, Buffer> | null = null;

/**
 * Build a version → Buffer map from environment variables.
 * INTEGRATIONS_ENC_KEY → version 1
 * INTEGRATIONS_ENC_KEY_V2 → version 2
 * INTEGRATIONS_ENC_KEY_V3 → version 3
 * … continues until env var is absent.
 */
export function getKeys(): Map<number, Buffer> {
  if (_keyCache) return _keyCache;

  const map = new Map<number, Buffer>();

  // Version 1 — primary key
  const primary = process.env.INTEGRATIONS_ENC_KEY;
  if (!primary) {
    throw new Error(
      "INTEGRATIONS_ENC_KEY is not set. " +
        "Generate one with: openssl rand -hex 32",
    );
  }
  if (primary.length !== 64) {
    throw new Error(
      `INTEGRATIONS_ENC_KEY must be a 64-char hex string (32 bytes). Got length ${primary.length}.`,
    );
  }
  map.set(1, Buffer.from(primary, "hex"));

  // Versions 2..N — optional rotation keys
  let version = 2;
  while (true) {
    const hex = process.env[`INTEGRATIONS_ENC_KEY_V${version}`];
    if (!hex) break;
    if (hex.length !== 64) {
      throw new Error(
        `INTEGRATIONS_ENC_KEY_V${version} must be a 64-char hex string. Got length ${hex.length}.`,
      );
    }
    map.set(version, Buffer.from(hex, "hex"));
    version++;
  }

  _keyCache = map;
  return map;
}

/**
 * Returns the highest key version available in env.
 * New encryptions always use this version.
 */
export function getCurrentKeyVersion(): number {
  const keys = getKeys();
  return Math.max(...keys.keys());
}

// Exported for testing / rotation script — reset cache when env changes.
export function _resetKeyCache(): void {
  _keyCache = null;
}

// ── Encrypt / Decrypt ─────────────────────────────────────────

export type EncryptedBlob = {
  ciphertext: string; // base64
  iv: string; // base64
  tag: string; // base64
  keyVersion: number;
};

/**
 * Encrypt plaintext using the current (highest) key version.
 * Returns blob with keyVersion so decrypt can select the correct key.
 */
export function encrypt(plaintext: string): EncryptedBlob {
  const keys = getKeys();
  const keyVersion = getCurrentKeyVersion();
  const key = keys.get(keyVersion)!;

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
    keyVersion,
  };
}

/**
 * Decrypt a blob, selecting the key by keyVersion.
 * Throws a classified error if the key version is unknown.
 */
export function decrypt(blob: {
  ciphertext: string;
  iv: string;
  tag: string;
  keyVersion: number;
}): string {
  const keys = getKeys();
  const key = keys.get(blob.keyVersion);
  if (!key) {
    throw new Error(
      `unknown_key_version: ${blob.keyVersion}. ` +
        `Available versions: ${[...keys.keys()].join(", ")}.`,
    );
  }

  const ivBuf = Buffer.from(blob.iv, "base64");
  const tagBuf = Buffer.from(blob.tag, "base64");
  const ciphertextBuf = Buffer.from(blob.ciphertext, "base64");

  if (tagBuf.length !== TAG_BYTES) {
    throw new Error(
      `decrypt_failure: invalid auth tag length: expected ${TAG_BYTES}, got ${tagBuf.length}`,
    );
  }

  const decipher = createDecipheriv(ALGORITHM, key, ivBuf);
  decipher.setAuthTag(tagBuf);

  const decrypted = Buffer.concat([
    decipher.update(ciphertextBuf),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}
