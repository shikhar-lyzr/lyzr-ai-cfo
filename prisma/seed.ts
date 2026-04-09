import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.upsert({
    where: { email: "demo@lyzr.ai" },
    update: {},
    create: {
      lyzrAccountId: "lyzr_demo_001",
      email: "demo@lyzr.ai",
      name: "Demo User",
      credits: 1000,
    },
  });

  const dataSource = await prisma.dataSource.upsert({
    where: { id: "ds_seed_001" },
    update: {},
    create: {
      id: "ds_seed_001",
      userId: user.id,
      type: "csv",
      name: "Q1_budget_vs_actual.csv",
      status: "ready",
      recordCount: 6,
    },
  });

  const existingRecords = await prisma.financialRecord.count({
    where: { dataSourceId: dataSource.id },
  });

  if (existingRecords === 0) {
    const records = [
      { account: "Marketing", period: "2026-Q1", actual: 14200, budget: 11500, category: "OpEx" },
      { account: "Engineering", period: "2026-Q1", actual: 45000, budget: 46000, category: "OpEx" },
      { account: "Sales", period: "2026-Q1", actual: 22800, budget: 20000, category: "OpEx" },
      { account: "Revenue", period: "2026-Q1", actual: 52000, budget: 50000, category: "Revenue" },
      { account: "Infrastructure", period: "2026-Q1", actual: 8900, budget: 9000, category: "OpEx" },
      { account: "Customer Support", period: "2026-Q1", actual: 6200, budget: 5500, category: "OpEx" },
    ];

    for (const record of records) {
      await prisma.financialRecord.create({
        data: { dataSourceId: dataSource.id, ...record },
      });
    }
  }

  const existingActions = await prisma.action.count({
    where: { userId: user.id },
  });

  if (existingActions === 0) {
    const actions = [
      {
        userId: user.id,
        type: "variance",
        severity: "critical",
        headline: "Marketing spend 23% over budget",
        detail: "$14.2K actual vs $11.5K planned",
        driver: "Primary driver: $4.1K unplanned contractor spend in week 3",
        status: "pending",
        sourceDataSourceId: dataSource.id,
      },
      {
        userId: user.id,
        type: "variance",
        severity: "warning",
        headline: "Sales spend 14% over budget",
        detail: "$22.8K actual vs $20.0K planned",
        driver: "Overage from Q1 trade show registration fees booked late",
        status: "pending",
        sourceDataSourceId: dataSource.id,
      },
      {
        userId: user.id,
        type: "variance",
        severity: "warning",
        headline: "Customer Support spend 12.7% over budget",
        detail: "$6.2K actual vs $5.5K planned",
        driver: "Additional part-time hire for ticket backlog in February",
        status: "pending",
        sourceDataSourceId: dataSource.id,
      },
      {
        userId: user.id,
        type: "recommendation",
        severity: "info",
        headline: "Revenue tracking 4% above plan",
        detail: "$52.0K actual vs $50.0K planned",
        driver: "Strong performance in enterprise segment, 2 deals closed early",
        status: "pending",
        sourceDataSourceId: dataSource.id,
      },
      {
        userId: user.id,
        type: "anomaly",
        severity: "info",
        headline: "Engineering spend 2.2% under budget",
        detail: "$45.0K actual vs $46.0K planned",
        driver: "One contractor invoice delayed to Q2, no action needed",
        status: "pending",
        sourceDataSourceId: dataSource.id,
      },
    ];

    for (const action of actions) {
      await prisma.action.create({ data: action });
    }
  }

  console.log("Seed complete: 1 user, 1 data source, 6 records, 5 actions");
}

main()
  .then(async () => await prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
