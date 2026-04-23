import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // The client passes `userId` for backwards compatibility with older clients,
  // but we always authoritate against the session — never trust the query
  // param. Reject requests for a different user rather than silently leaking.
  const { searchParams } = new URL(request.url);
  const requestedUserId = searchParams.get("userId");
  if (requestedUserId && requestedUserId !== session.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sources = await prisma.dataSource.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
  });

  const shape = searchParams.get("shape");
  const filtered = shape
    ? sources.filter((s: { metadata?: string | null }) => {
        try {
          return JSON.parse(s.metadata ?? "{}").shape === shape;
        } catch {
          return false;
        }
      })
    : sources;

  return NextResponse.json(filtered);
}
