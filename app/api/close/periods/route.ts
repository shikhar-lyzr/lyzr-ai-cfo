import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listClosePeriods, safely } from "@/lib/close/period";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  // Keep this lightweight: the picker only needs periodKey + source. Per-period
  // score/tier would mean N readiness computations (~3–4 Prisma round-trips
  // each) every time the dropdown opens. Callers that need the score for a
  // specific period hit /api/close/readiness?period=<key>.
  const periods = await safely(() => listClosePeriods(session.userId), []);
  return NextResponse.json({ periods });
}
