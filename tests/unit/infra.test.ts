import { describe, it, expect } from "vitest";

// Prove @-alias resolves by importing a pure constant with no side effects
import { DEFAULT_USER_ID } from "@/lib/constants";

describe("unit infra", () => {
  it("resolves @ alias and returns expected constant", () => {
    expect(DEFAULT_USER_ID).toBe("usr_default_single");
  });

  it("process.env.TZ is UTC", () => {
    expect(process.env.TZ).toBe("UTC");
  });

  it("@/lib/db mock is in place (no real DB needed)", async () => {
    const { db } = await import("@/lib/db");
    // The mock returns an object with user.findMany — it's a vi.fn(), not a real call
    expect(typeof db.user.findMany).toBe("function");
  });
});
