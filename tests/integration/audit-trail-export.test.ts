import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/db";
import { queryAuditTrail } from "@/lib/audit-trail/query";
import { toCsv } from "@/lib/audit-trail/csv";
import { deleteTestUser } from "./cleanup";

describe("audit trail CSV export", { timeout: 30_000 }, () => {
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

  it("CSV contains expected header and one row per timeline entry", async () => {
    await prisma.dataSource.create({
      data: { userId, type: "ar", name: "ar.csv", status: "ready", recordCount: 5 },
    });
    await prisma.document.create({
      data: { userId, type: "ar_summary", title: "AR Summary, with comma", body: "..." },
    });

    const result = await queryAuditTrail({ userId });
    const csv = toCsv(result.rows);
    const lines = csv.trim().split("\n");
    expect(lines[0]).toBe("timestamp,source,actorId,summary,refType,refId");
    expect(lines).toHaveLength(1 + result.rows.length);

    // Title with comma must be quoted
    const docLine = lines.find((l) => l.includes("ar_summary"));
    expect(docLine).toContain('"');
  });
});
