import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { safely } from "@/lib/close/period";
import { getCloseReadiness, getCloseBlockers } from "@/lib/close/stats";
import { deriveTaskCounts } from "@/lib/close/tasks";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const period = request.nextUrl.searchParams.get("period");
  if (!period) return NextResponse.json({ error: "period required" }, { status: 400 });

  const [readiness, blockers, tasks] = await Promise.all([
    safely(() => getCloseReadiness(session.userId, period), { hasData: false as const }),
    safely(() => getCloseBlockers(session.userId, period), []),
    safely(() => deriveTaskCounts(session.userId, period), []),
  ]);

  return NextResponse.json({ readiness, blockers, tasks });
}
