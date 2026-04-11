import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEMO_USER_ID = "cmnqrhkym0000lg6wyy2pkyy0";

const VARIANCE_REPORT_BODY = `# Monthly Variance Report — April 2026

## Executive Summary

Overall performance for the period shows a net favorable variance of +2.3% ($47.2K above budget of $2,052K). While revenue exceeded targets driven by strong SaaS subscription growth, several expense categories require attention.

## Top Variances by Impact

### Critical
- **Marketing Spend Over Budget (+28.4%)**: $184.2K actual vs $143.5K budget. Driven by unplanned Q2 campaign acceleration. Recommend reviewing ROI metrics before approving additional spend.
- **Cloud Infrastructure (+22.1%)**: $67.8K actual vs $55.5K budget. Auto-scaling costs exceeded forecasts due to traffic spike from product launch.

### Warning
- **Travel & Entertainment (+15.7%)**: $23.4K actual vs $20.2K budget. Conference season drove higher-than-expected travel costs.
- **Professional Services (-12.3%)**: $41.2K actual vs $47.0K budget. Favorable — delayed consulting engagement pushed to Q3.

### Info
- **SaaS Revenue (+8.2%)**: $892K actual vs $824K budget. Strong upsell performance in enterprise segment.

## Category Breakdown

| Category | Actual | Budget | Variance | % |
|----------|--------|--------|----------|---|
| Revenue | $1,245K | $1,182K | +$63K | +5.3% |
| OpEx | $834K | $782K | +$52K | +6.6% |
| Personnel | $412K | $408K | +$4K | +1.0% |
| G&A | $156K | $148K | +$8K | +5.4% |

## Recommended Actions

- Review Marketing ROI report before approving Q3 campaign budget
- Investigate cloud cost optimization (reserved instances, right-sizing)
- No action needed on T&E — seasonal pattern expected to normalize
- Follow up on delayed Professional Services engagement timeline`;

const AR_SUMMARY_BODY = `# AR Aging Summary — April 2026

## Total Outstanding

**$127.4K** across 8 open invoices.

## Aging Breakdown

| Bucket | Count | Amount | % of Total |
|--------|-------|--------|------------|
| Current (not yet due) | 1 | $12.5K | 9.8% |
| 1-14 days overdue | 2 | $28.3K | 22.2% |
| 15-44 days overdue | 3 | $45.6K | 35.8% |
| 45+ days overdue | 2 | $41.0K | 32.2% |

## Dunning Activity

- **3** follow-up emails sent this period
- **1** invoice snoozed (payment plan confirmed)
- **1** escalated to management
- **3** pending first contact

## Escalation Candidates

1. **INV-2024-089** — Acme Corp, $25.0K, 67 days overdue. No response to prior outreach. Recommend management escalation.
2. **INV-2024-092** — TechFlow Inc, $16.0K, 52 days overdue. Partial payment received ($5K). Follow up on remaining balance.

## Recommended Next Steps

- Escalate Acme Corp to VP Sales for relationship-level intervention
- Send firm follow-up to 15-44 day bucket invoices
- Monitor TechFlow payment plan compliance
- No action on current invoices until due date passes`;

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

  const userId = user.id;

  await prisma.document.deleteMany({ where: { userId } });

  await prisma.document.createMany({
    data: [
      {
        userId,
        type: "variance_report",
        title: "Monthly Variance Report — April 2026",
        body: VARIANCE_REPORT_BODY,
      },
      {
        userId,
        type: "ar_summary",
        title: "AR Aging Summary — April 2026",
        body: AR_SUMMARY_BODY,
      },
    ],
  });

  console.log("Seeded 2 documents (variance report + AR summary).");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
