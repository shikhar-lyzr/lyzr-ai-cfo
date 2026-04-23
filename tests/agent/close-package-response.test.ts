// tests/agent/close-package-response.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { prisma } from "@/lib/db";
import { deleteTestUser } from "../integration/cleanup";
import {
  deltaMsg,
  scriptedQuery,
} from "./mock-query";

// Mock gitclaw so query() returns our scripted sequence. The `tool` export
// is called at module-load time by lib/agent/tools.ts, so it must return a
// plausible shape even though we don't exercise any tools in these tests.
vi.mock("gitclaw", () => ({
  query: vi.fn(),
  tool: (name: string, description: string, inputSchema: unknown, handler: unknown) => ({
    name,
    description,
    inputSchema,
    handler,
  }),
}));

// Import AFTER vi.mock so the module picks up the mocked gitclaw
import { query } from "gitclaw";
import { generateReport } from "@/lib/agent";

process.env.LYZR_API_KEY = process.env.LYZR_API_KEY ?? "test-dummy";
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? "test-dummy";

describe("close_package response handling", { timeout: 30_000 }, () => {
  let userId = "";

  beforeEach(async () => {
    vi.clearAllMocks();
    const u = await prisma.user.create({
      data: {
        lyzrAccountId: `t_${Date.now()}_${Math.random()}`,
        email: `t_${Date.now()}_${Math.random()}@test.local`,
        name: "Test",
      },
    });
    userId = u.id;
    // Minimal seed: getCloseReadiness needs SOMETHING to return hasData: true.
    // A single FinancialRecord under the target period is enough.
    const ds = await prisma.dataSource.create({
      data: {
        userId, type: "csv", name: "seed.csv", status: "ready",
        metadata: JSON.stringify({ shape: "variance" }),
      },
    });
    await prisma.financialRecord.create({
      data: {
        dataSourceId: ds.id, account: "Marketing", period: "2026-Q1",
        actual: 100, budget: 100, category: "OpEx",
      },
    });
  });

  afterEach(async () => {
    await deleteTestUser(userId);
  });

  it("strips Lyzr agent-narration preamble from the saved body", async () => {
    // Matches the real prod preamble shape: "has been generated and saved."
    // and the artifact-ID sentence land on the SAME line (the Lyzr router
    // emits one run-on paragraph). Verified against the real saved
    // Document.body at commit 7510b19 via scripts/audit.ts.
    const dirty =
      "The **2026-Q1 Monthly Close Package Report** has been generated and saved. You can refer to artifact ID `2711d04f-ef12-4660-ad5f-028f79a2d993` for the full markdown content.\n\n# Monthly Close Package — 2026-Q1\n\n## Executive Summary\nReal content here.";
    vi.mocked(query).mockReturnValue(scriptedQuery([deltaMsg(dirty)]) as ReturnType<typeof query>);

    await generateReport(userId, "close_package", "2026-Q1");

    const saved = await prisma.document.findFirst({
      where: { userId, type: "close_package", period: "2026-Q1" },
    });
    expect(saved).not.toBeNull();
    expect(saved!.body).not.toContain("artifact ID");
    expect(saved!.body).not.toContain("has been generated and saved");
    expect(saved!.body).toContain("# Monthly Close Package — 2026-Q1");
    expect(saved!.body).toContain("Real content here");
  });
});
