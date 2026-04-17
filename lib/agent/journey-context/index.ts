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

const BUILDERS: Record<string, JourneyContextBuilder> = {
  "financial-reconciliation": buildReconciliationContext,
};

export async function buildJourneyContext(
  userId: string,
  journeyId: string | undefined
): Promise<string | null> {
  if (!journeyId) return null;
  const builder = BUILDERS[journeyId];
  if (builder) return builder(userId);
  const title = JOURNEY_TITLES[journeyId] ?? journeyId;
  return `## Current Journey: ${title}\nThis is a demo placeholder page — no live backing data. Answer conceptually or redirect the user to journeys with real data (Financial Reconciliation).`;
}
