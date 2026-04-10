import { runAgentProbe } from "./lib/agent/probe";
import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();

async function test() {
  const userId = "test_user_123";
  const ds = await p.dataSource.create({
      data: {
          userId,
          name: "test.csv",
          status: "ready",
          type: "csv",
          recordCount: 15,
          metadata: "{}"
      }
  })

  // create some dummy records so the agent has something to analyze
  await p.financialRecord.create({ data: { dataSourceId: ds.id, account: "Test", period: "Q1", actual: 500, budget: 100, category: "G&A" } });

  console.log("Starting probe...");
  const res = await runAgentProbe(userId, ds.id, "test.csv", 1);
  console.log(JSON.stringify(res, null, 2));

  await p.$disconnect();
}

test().catch(console.error);
