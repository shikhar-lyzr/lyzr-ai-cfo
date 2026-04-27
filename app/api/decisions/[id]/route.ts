import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDecision } from "@/lib/decisions/service";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await params;
  const decision = await getDecision(session.userId, id);
  if (!decision) return NextResponse.json({ error: "Decision not found" }, { status: 404 });
  return NextResponse.json({ decision });
}
