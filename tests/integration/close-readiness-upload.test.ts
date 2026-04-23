// tests/integration/close-readiness-upload.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/db";
import { getCloseReadiness, getCloseBlockers } from "@/lib/close/stats";
import { deriveTaskCounts } from "@/lib/close/tasks";
import { deleteTestUser } from "./cleanup";

// Neon pooler round-trips add up across seed + the three read functions; 5s
// vitest default is not enough. Matches existing integration tests.
describe("close-readiness upload integration", { timeout: 30_000 }, () => {
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
  });

  afterEach(async () => {
    await deleteTestUser(userId);
  });

  it("cold state returns hasData=false with isEmpty task cards", async () => {
    const readiness = await getCloseReadiness(userId, "2026-04");
    expect(readiness.hasData).toBe(false);

    const blockers = await getCloseBlockers(userId, "2026-04");
    // With no sources at all, every required source is "missing"
    expect(blockers.length).toBe(3);
    expect(blockers.every((b) => b.kind === "missing_source")).toBe(true);

    const tasks = await deriveTaskCounts(userId, "2026-04");
    expect(tasks).toHaveLength(5);
    // All ledger-backed cards empty; variance + package cards total=1 with completed=0
    expect(tasks[0].isEmpty).toBe(true); // subledger
    expect(tasks[1].isEmpty).toBe(true); // gl
    expect(tasks[2].total).toBe(1); // variance (special: total always 1)
  });
});
