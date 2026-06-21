/**
 * guard.ts
 *
 * Safety guards for test database operations.
 * Exported for use in vitest global-setup and other test utilities.
 */

export function assertTestDatabase(url: string) {
  try {
    const urlObj = new URL(url);

    // Only localhost/127.0.0.1/[::1]. Note: WHATWG URL returns IPv6 hosts
    // bracketed, so the loopback literal here must be "[::1]", not "::1".
    const host = urlObj.hostname || "";
    if (!["localhost", "127.0.0.1", "[::1]"].includes(host)) {
      throw new Error(
        `FAIL: Test ops allowed only on localhost. Got host: ${host}`
      );
    }

    // Only _test databases
    const dbName = urlObj.pathname.split("/")[1];
    if (!dbName || !dbName.endsWith("_test")) {
      throw new Error(
        `FAIL: Test ops allowed only on _test databases. Got: ${dbName}`
      );
    }
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("FAIL:")) {
      throw err;
    }
    throw new Error(
      `Invalid DATABASE_URL format for test guard: ${url}. Error: ${err}`
    );
  }
}
