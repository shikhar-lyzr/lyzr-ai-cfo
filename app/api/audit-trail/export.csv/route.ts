import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { queryAuditTrail } from "@/lib/audit-trail/query";
import { toCsv } from "@/lib/audit-trail/csv";
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

  const result = await queryAuditTrail({
    userId: session.userId,
    sources: parseSources(request),
    from: parseDate(request.nextUrl.searchParams.get("from")),
    to: parseDate(request.nextUrl.searchParams.get("to")),
    limit: 1000,
  });

  const warnings = Object.entries(result.errors).map(([s, m]) => `${s} failed: ${m}`);
  if (result.rows.length === 1000) {
    warnings.push("export truncated at 1000 rows");
  }
  const csv = toCsv(result.rows, { warnings });
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="audit-trail-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
