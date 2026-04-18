import { prisma } from "@/lib/db";
import { buildReconciliationContext } from "./financial-reconciliation";

export type JourneyContextBuilder = (userId: string) => Promise<string>;

export const JOURNEY_TITLES: Record<string, string> = {
  "financial-reconciliation": "Financial Reconciliation",
  "monthly-close": "Monthly Close",
  "daily-liquidity": "Daily Liquidity",
  "ifrs9-ecl": "IFRS 9 ECL",
  "regulatory-capital": "Regulatory Capital",
  "regulatory-returns": "Regulatory Returns",
};

export async function buildJourneyContext(
  userId: string,
  journeyId: string | undefined
): Promise<string | null> {
  if (!journeyId) return null;
  if (journeyId === "financial-reconciliation") {
    // Temporary: resolve newest period. Task 10 will thread an explicit periodKey.
    const newest = await prisma.reconPeriod.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    const periodKey = newest?.periodKey ?? "";
    return buildReconciliationContext(userId, periodKey);
  }
  const title = JOURNEY_TITLES[journeyId] ?? journeyId;
  return `## Current Journey: ${title}\nThis is a demo placeholder page — no live backing data. Answer conceptually or redirect the user to journeys with real data (Financial Reconciliation).`;
}
