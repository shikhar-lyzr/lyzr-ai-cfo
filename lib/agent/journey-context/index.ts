import { prisma } from "@/lib/db";
import { buildReconciliationContext } from "./financial-reconciliation";
import { buildMonthlyCloseContext } from "./monthly-close";
import { buildCapitalContext } from "./regulatory-capital";

export type JourneyContextBuilder = (userId: string, periodKey: string) => Promise<string>;

export const JOURNEY_TITLES: Record<string, string> = {
  "financial-reconciliation": "Financial Reconciliation",
  "monthly-close": "Monthly Close",
  "daily-liquidity": "Daily Liquidity",
  "ifrs9-ecl": "IFRS 9 ECL",
  "regulatory-capital": "Regulatory Capital",
  "regulatory-returns": "Regulatory Returns",
};

const BUILDERS: Record<string, JourneyContextBuilder> = {
  "financial-reconciliation": buildReconciliationContext,
  "monthly-close": buildMonthlyCloseContext,
  "regulatory-capital": buildCapitalContext,
};

export async function buildJourneyContext(
  userId: string,
  journeyId: string | undefined,
  periodKey?: string,
): Promise<string | null> {
  if (!journeyId) return null;

  const builder = BUILDERS[journeyId];
  if (builder) {
    let resolvedPeriodKey = periodKey ?? "";
    if (!resolvedPeriodKey) {
      if (journeyId === "financial-reconciliation") {
        const newest = await prisma.reconPeriod.findFirst({
          where: { userId },
          orderBy: { createdAt: "desc" },
        });
        resolvedPeriodKey = newest?.periodKey ?? "";
      } else if (journeyId === "regulatory-capital") {
        const newest = await prisma.capitalPeriod.findFirst({
          where: { userId },
          orderBy: { createdAt: "desc" },
        });
        resolvedPeriodKey = newest?.periodKey ?? "";
      }
    }
    return builder(userId, resolvedPeriodKey);
  }

  const title = JOURNEY_TITLES[journeyId] ?? journeyId;
  return `## Current Journey: ${title}\nThis is a demo placeholder page — no live backing data. Answer conceptually or redirect the user to journeys with real data (Financial Reconciliation).`;
}
