import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    action: {
      findMany: vi.fn(),
      createMany: vi.fn(),
      create: vi.fn(),
    },
    dataSource: {
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db";
import { createFinancialTools } from "@/lib/agent/tools";

const mocked = prisma as unknown as {
  action: {
    findMany: ReturnType<typeof vi.fn>;
    createMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  dataSource: {
    findMany: ReturnType<typeof vi.fn>;
  };
};

// Extract the create_actions tool handler from the tool factory.
function getCreateActionsHandler(userId: string) {
  const tools = createFinancialTools(userId);
  const tool = tools.find((t) => (t as { name: string }).name === "create_actions");
  if (!tool) throw new Error("create_actions tool not found");
  return (tool as { handler: (args: Record<string, unknown>) => Promise<{ text: string; details?: unknown }> }).handler;
}

describe("create_actions tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.action.findMany.mockResolvedValue([]);
    mocked.dataSource.findMany.mockResolvedValue([]);
    mocked.action.createMany.mockResolvedValue({ count: 0 });
    mocked.action.create.mockResolvedValue({});
  });

  it("creates the action with sourceDataSourceId=null when dataSourceId is omitted", async () => {
    // Exact shape the LLM sends from /monthly-close chat when asked to create
    // a variance-investigation action: no dataSourceId because variance
    // blockers are aggregated across multiple DataSources.
    const handler = getCreateActionsHandler("u1");
    const result = await handler({
      actions: [
        {
          type: "variance",
          severity: "warning",
          headline: "Investigate R&D (OpEx) 30% over budget for 2026-Q1",
          detail: "R&D OpEx actual $15,600 vs budget $12,000 — 30% over",
          driver: "unexplained variance",
        },
      ],
    });

    expect(mocked.action.createMany).toHaveBeenCalledTimes(1);
    const call = mocked.action.createMany.mock.calls[0][0] as { data: Array<{ sourceDataSourceId: string | null }> };
    expect(call.data).toHaveLength(1);
    expect(call.data[0].sourceDataSourceId).toBeNull();
    expect(result.text).toContain("Successfully created 1");
  });

  it("still links to DataSource when the LLM supplies a valid dataSourceId", async () => {
    mocked.dataSource.findMany.mockResolvedValue([{ id: "ds-42" }]);

    const handler = getCreateActionsHandler("u1");
    await handler({
      actions: [
        {
          type: "variance",
          severity: "warning",
          headline: "Marketing over budget",
          detail: "x",
          driver: "y",
          dataSourceId: "ds-42",
        },
      ],
    });

    const call = mocked.action.createMany.mock.calls[0][0] as { data: Array<{ sourceDataSourceId: string | null }> };
    expect(call.data[0].sourceDataSourceId).toBe("ds-42");
  });

  it("rejects a non-empty dataSourceId that doesn't belong to the user", async () => {
    // If the LLM fabricates a dataSourceId that doesn't exist, we must not
    // silently link to it. Action is dropped, not linked with a bogus id.
    mocked.dataSource.findMany.mockResolvedValue([]); // id not found in DB

    const handler = getCreateActionsHandler("u1");
    const result = await handler({
      actions: [
        {
          type: "variance",
          severity: "warning",
          headline: "Bogus",
          detail: "x",
          driver: "y",
          dataSourceId: "ds-fake",
        },
      ],
    });

    expect(mocked.action.createMany).not.toHaveBeenCalled();
    expect(result.text.toLowerCase()).toContain("no valid");
  });
});
