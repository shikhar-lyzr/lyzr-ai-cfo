import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { decideOnProposal } from "@/lib/decisions/service";
import type { DecisionOutcome } from "@/lib/decisions/transitions";

const OUTCOMES = new Set<DecisionOutcome>(["approve", "reject", "needs_info"]);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const { outcome, reason } = body as { outcome?: string; reason?: string };

  if (!outcome || !OUTCOMES.has(outcome as DecisionOutcome)) {
    return NextResponse.json({ error: "outcome must be approve | reject | needs_info" }, { status: 400 });
  }

  const result = await decideOnProposal({
    userId: session.userId,
    decisionId: id,
    outcome: outcome as DecisionOutcome,
    reason,
  });

  if (!result.ok) {
    const status = result.code === "not_found" ? 404 : result.code === "illegal_transition" ? 409 : 422;
    return NextResponse.json({ error: result.message, code: result.code }, { status });
  }
  return NextResponse.json(result);
}
