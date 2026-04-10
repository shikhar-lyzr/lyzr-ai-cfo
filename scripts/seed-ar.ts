/**
 * Seed AR aging demo data.
 * Run: npx tsx scripts/seed-ar.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const INVOICES = [
  // Friendly bucket (1-14 days overdue as of ~2026-04-10)
  { invoiceNumber: "INV-1007", customer: "Granite Tech", customerEmail: "billing@granitetech.com", amount: 3200, invoiceDate: "2026-03-25", dueDate: "2026-04-08" },
  { invoiceNumber: "INV-1008", customer: "Highland Services", customerEmail: "ar@highland.biz", amount: 15400, invoiceDate: "2026-03-20", dueDate: "2026-04-03" },
  // Firm bucket (15-44 days overdue)
  { invoiceNumber: "INV-1001", customer: "Acme Corp", customerEmail: "billing@acme.com", amount: 12500, invoiceDate: "2026-02-15", dueDate: "2026-03-01" },
  { invoiceNumber: "INV-1002", customer: "Beta Industries", customerEmail: "ap@beta-ind.com", amount: 8750, invoiceDate: "2026-02-20", dueDate: "2026-03-06" },
  { invoiceNumber: "INV-1003", customer: "Cascade LLC", customerEmail: "finance@cascade.io", amount: 34200, invoiceDate: "2026-01-10", dueDate: "2026-02-10" },
  // Escalation bucket (45+ days overdue)
  { invoiceNumber: "INV-1005", customer: "Evergreen Solutions", customerEmail: "pay@evergreen.co", amount: 21000, invoiceDate: "2025-12-01", dueDate: "2026-01-01" },
  { invoiceNumber: "INV-1006", customer: "Foxworth & Co", customerEmail: null, amount: 45800, invoiceDate: "2025-11-15", dueDate: "2025-12-15" },
  // Recently dunned (should be skipped by scan_ar_aging)
  { invoiceNumber: "INV-1004", customer: "Delta Partners", customerEmail: "accounts@deltap.com", amount: 5600, invoiceDate: "2026-01-15", dueDate: "2026-02-15" },
];

async function main() {
  // Find or create a demo user
  let user = await prisma.user.findFirst({ where: { email: "demo@lyzr.ai" } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: "demo@lyzr.ai",
        name: "Demo User",
        lyzrAccountId: "demo",
        credits: 100,
      },
    });
    console.log("Created demo user:", user.id);
  }

  // Create AR data source
  const ds = await prisma.dataSource.create({
    data: {
      userId: user.id,
      type: "csv",
      name: "sample-ar-aging.csv",
      status: "ready",
      recordCount: INVOICES.length,
      metadata: JSON.stringify({ shape: "ar", headers: ["invoice number", "customer", "customer email", "amount", "invoice date", "due date"] }),
    },
  });
  console.log("Created data source:", ds.id);

  // Insert invoices
  for (const inv of INVOICES) {
    await prisma.invoice.create({
      data: {
        dataSourceId: ds.id,
        invoiceNumber: inv.invoiceNumber,
        customer: inv.customer,
        customerEmail: inv.customerEmail,
        amount: inv.amount,
        invoiceDate: new Date(inv.invoiceDate),
        dueDate: new Date(inv.dueDate),
        // Mark INV-1004 as recently dunned so it gets skipped
        ...(inv.invoiceNumber === "INV-1004" ? { lastDunnedAt: new Date(Date.now() - 3 * 86400000) } : {}),
      },
    });
  }

  console.log(`Inserted ${INVOICES.length} invoices`);
  console.log("Done. AR seed data ready.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
