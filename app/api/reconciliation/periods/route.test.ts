import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";

const U = "test-user-periods-route";
let sessionUserId: string | null = U;

vi.mock("@/lib/auth", () => ({
  getSession: async () =>
    sessionUserId ? { userId: sessionUserId, email: `${sessionUserId}@x`, name: "T" } : null,
}));

const { GET } = await import("./route");

beforeEach(async () => {
  sessionUserId = U;
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
  it("returns periods newest-first for the authenticated user", async () => {
    const res = await GET();
    const json = await res.json();
    expect(json.map((p: { periodKey: string }) => p.periodKey)).toEqual(["2026-04", "2026-03"]);
  });

  it("returns 401 when unauthenticated", async () => {
    sessionUserId = null;
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns [] for an authenticated user with no periods", async () => {
    sessionUserId = "other-user-with-no-periods";
    const res = await GET();
    const json = await res.json();
    expect(json).toEqual([]);
  });
});
