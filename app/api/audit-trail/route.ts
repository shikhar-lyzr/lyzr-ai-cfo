import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { queryAuditTrail } from "@/lib/audit-trail/query";
import type { AuditSource } from "@/lib/audit-trail/types";

const VALID: AuditSource[] = ["action", "decision", "data_source", "document", "match_run"];

function parseSources(req: NextRequest): AuditSource[] | undefined {
  const params = req.nextUrl.searchParams.getAll("source");
  if (params.length === 0) return undefined;
  const filtered = params.filter((s): s is AuditSource => VALID.includes(s as AuditSource));
  return filtered.length === 0 ? undefined : filtered;
}

function parseDate(s: string | null): Date | undefined {
  if (!s) return undefined;
  const d = new Date(s);
  return isNaN(d.getTime()) ? undefined : d;
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const limitParam = request.nextUrl.searchParams.get("limit");
  const limit = limitParam ? Math.min(parseInt(limitParam, 10) || 200, 1000) : 200;

  const result = await queryAuditTrail({
    userId: session.userId,
    sources: parseSources(request),
    from: parseDate(request.nextUrl.searchParams.get("from")),
    to: parseDate(request.nextUrl.searchParams.get("to")),
    limit,
  });

  return NextResponse.json(result);
}
