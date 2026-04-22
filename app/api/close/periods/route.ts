import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listClosePeriods } from "@/lib/close/period";
import { getCloseReadiness } from "@/lib/close/stats";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const periods = await listClosePeriods(session.userId);
  const enriched = await Promise.all(
    periods.map(async (p) => {
      const r = await getCloseReadiness(session.userId, p.periodKey);
      return {
        periodKey: p.periodKey,
        source: p.source,
        score: r.hasData ? r.score : null,
        tier: r.hasData ? r.tier : null,
      };
    })
  );
  return NextResponse.json({ periods: enriched });
}
