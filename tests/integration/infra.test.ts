import { describe, it, expect } from "vitest";
import { db } from "@/lib/db";

describe("integration infra", () => {
  it("connects to test DB and default user exists after seed", async () => {
    const user = await db.user.findMany();
    // seedReferenceData (run in beforeEach) creates exactly one user
    expect(user).toHaveLength(1);
    expect(user[0].id).toBe("usr_default_single");
  });

  it("base currencies RUB and USD are seeded", async () => {
    const currencies = await db.currency.findMany({
      orderBy: { code: "asc" },
    });
    const codes = currencies.map((c) => c.code);
    expect(codes).toContain("RUB");
    expect(codes).toContain("USD");
  });
});
