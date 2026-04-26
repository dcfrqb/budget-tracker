/**
 * rotate-integrations-key.ts
 *
 * One-shot key rotation script. Re-encrypts all IntegrationCredential rows
 * that are below the current key version using the latest available key.
 *
 * Usage:
 *   tsx scripts/rotate-integrations-key.ts
 *
 * Prerequisites:
 *   1. Set the new key as INTEGRATIONS_ENC_KEY_V<N> in your .env.
 *   2. Ensure the OLD key(s) are still present in .env (needed for decryption).
 *   3. Run this script to migrate all rows.
 *   4. After confirming success, old key env vars may be removed.
 *
 * Output:
 *   - Per-credential: id + status (rotated | skipped | failed)
 *   - Summary: total / rotated / skipped / failed
 *   NO payloads, secrets, or decrypted content are logged.
 */

import "dotenv/config";
import { db } from "@/lib/db";
import {
  encrypt,
  decrypt,
  getCurrentKeyVersion,
  _resetKeyCache,
} from "@/lib/integrations/crypto";

async function main() {
  // Force fresh key cache (picks up env vars set after module load in dev).
  _resetKeyCache();

  const currentVersion = getCurrentKeyVersion();
  process.stdout.write(
    `[rotate-integrations-key] Target version: ${currentVersion}\n`,
  );

  // Find credentials that are not yet on the current key version.
  const credentials = await db.integrationCredential.findMany({
    where: { keyVersion: { lt: currentVersion } },
    select: {
      id: true,
      keyVersion: true,
      encryptedPayload: true,
      encryptionIv: true,
      encryptionTag: true,
    },
  });

  process.stdout.write(
    `[rotate-integrations-key] Found ${credentials.length} credential(s) to migrate.\n`,
  );

  let rotated = 0;
  let skipped = 0;
  let failed = 0;

  for (const cred of credentials) {
    // Skip rows with empty payload (already disconnected / no secrets).
    if (!cred.encryptedPayload) {
      process.stdout.write(`  [skip] ${cred.id} — empty payload\n`);
      skipped++;
      continue;
    }

    try {
      // Decrypt with the old key version stored on the row.
      const plaintext = decrypt({
        ciphertext: cred.encryptedPayload,
        iv: cred.encryptionIv,
        tag: cred.encryptionTag,
        keyVersion: cred.keyVersion,
      });

      // Skip trivially empty secrets (no real data to protect).
      if (plaintext === "{}" || plaintext.trim() === "") {
        process.stdout.write(`  [skip] ${cred.id} — empty secrets object\n`);
        skipped++;
        continue;
      }

      // Re-encrypt with the current key.
      const newBlob = encrypt(plaintext);

      await db.integrationCredential.update({
        where: { id: cred.id },
        data: {
          encryptedPayload: newBlob.ciphertext,
          encryptionIv: newBlob.iv,
          encryptionTag: newBlob.tag,
          keyVersion: newBlob.keyVersion,
        },
      });

      process.stdout.write(
        `  [ok] ${cred.id} — v${cred.keyVersion} → v${newBlob.keyVersion}\n`,
      );
      rotated++;
    } catch (e) {
      const msg =
        e instanceof Error ? e.message.slice(0, 120) : "unknown error";
      process.stdout.write(
        `  [fail] ${cred.id} — ${msg}\n`,
      );
      failed++;
    }
  }

  process.stdout.write(
    `\n[rotate-integrations-key] Done. ` +
      `total=${credentials.length} rotated=${rotated} skipped=${skipped} failed=${failed}\n`,
  );

  if (failed > 0) {
    process.exit(1);
  }
}

main()
  .catch((e) => {
    process.stderr.write(
      `[rotate-integrations-key] Fatal: ${e instanceof Error ? e.message : String(e)}\n`,
    );
    process.exit(1);
  })
  .finally(() => db.$disconnect());
