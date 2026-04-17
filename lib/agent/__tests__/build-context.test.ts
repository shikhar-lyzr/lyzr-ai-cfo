import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/db";
import { buildContext } from "../index";

describe("buildContext journey wiring", { timeout: 30_000 }, () => {
  let userId = "";

  beforeEach(async () => {
    const u = await prisma.user.create({
      data: {
        lyzrAccountId: `t_${Date.now()}_${Math.random()}`,
        email: `t_${Date.now()}_${Math.random()}@test.local`,
        name: "Test",
      },
    });
    userId = u.id;
    await prisma.action.createMany({
      data: [
        { userId, type: "variance", severity: "high",   headline: "A1", detail: "d", driver: "x" },
        { userId, type: "variance", severity: "medium", headline: "A2", detail: "d", driver: "x" },
        { userId, type: "variance", severity: "low",    headline: "A3", detail: "d", driver: "x" },
      ],
    });
  });

  it("without journeyId: full Open Actions list, no journey header", async () => {
    const ctx = await buildContext(userId);
    expect(ctx).not.toContain("## Current Journey");
    expect(ctx).toContain("## Open Actions (3)");
    expect(ctx).toContain("A1");
    expect(ctx).toContain("A2");
    expect(ctx).toContain("A3");
  });

  it("with journeyId: journey header first, Open Actions collapsed to counts", async () => {
    const ctx = await buildContext(userId, undefined, "financial-reconciliation");
    expect(ctx).toMatch(/^## Current Journey: Financial Reconciliation/);
    expect(ctx).toContain("## Open Actions (3)");
    expect(ctx).toContain("high: 1");
    expect(ctx).toContain("medium: 1");
    expect(ctx).toContain("low: 1");
    expect(ctx).not.toContain("A1");
    expect(ctx).not.toContain("A2");
    expect(ctx).not.toContain("A3");
  });

  it("with unknown journeyId: placeholder header, Open Actions still collapsed", async () => {
    const ctx = await buildContext(userId, undefined, "monthly-close");
    expect(ctx).toContain("## Current Journey: Monthly Close");
    expect(ctx).toContain("## Open Actions (3)");
    expect(ctx).toContain("high: 1");
    expect(ctx).not.toContain("A1");
  });
});
