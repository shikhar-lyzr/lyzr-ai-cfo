import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listDecisions } from "@/lib/decisions/service";
import type { DecisionStatus } from "@/lib/decisions/transitions";

const STATUSES = new Set<DecisionStatus>(["pending", "approved", "rejected", "needs_info"]);

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const statusParam = request.nextUrl.searchParams.get("status") ?? "pending";
  if (!STATUSES.has(statusParam as DecisionStatus)) {
    return NextResponse.json({ error: "invalid status" }, { status: 400 });
  }

  const limitParam = request.nextUrl.searchParams.get("limit");
  const limit = limitParam ? Math.min(parseInt(limitParam, 10) || 50, 100) : 50;

  const decisions = await listDecisions(session.userId, statusParam as DecisionStatus, limit);
  return NextResponse.json({ decisions });
}
