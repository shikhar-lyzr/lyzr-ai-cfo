import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { GET } from "./route";

const U = "test-user-periods-route";

beforeEach(async () => {
  await prisma.user.create({ data: { id: U, lyzrAccountId: U, email: `${U}@x`, name: "T" } });
  await prisma.reconPeriod.createMany({
    data: [
      { userId: U, periodKey: "2026-03", status: "open" },
      { userId: U, periodKey: "2026-04", status: "open" },
    ],
  });
});

afterEach(async () => {
  await prisma.reconPeriod.deleteMany({ where: { userId: U } });
  await prisma.user.deleteMany({ where: { id: U } });
});

describe("GET /api/reconciliation/periods", () => {
  it("returns periods newest-first", async () => {
    const req = new Request(`http://x/api/reconciliation/periods?userId=${U}`);
    const res = await GET(req as any);
    const json = await res.json();
    expect(json.map((p: any) => p.periodKey)).toEqual(["2026-04", "2026-03"]);
  });

  it("returns 400 when userId is missing", async () => {
    const req = new Request(`http://x/api/reconciliation/periods`);
    const res = await GET(req as any);
    expect(res.status).toBe(400);
  });

  it("returns [] for a user with no periods", async () => {
    const req = new Request(`http://x/api/reconciliation/periods?userId=nonexistent-user-xyz`);
    const res = await GET(req as any);
    const json = await res.json();
    expect(json).toEqual([]);
  });
});
