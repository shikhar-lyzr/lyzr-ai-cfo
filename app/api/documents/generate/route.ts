import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { generateReport } from "@/lib/agent";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json();
  const { type, period } = body as { type: string; period?: string };

  const allowed = ["variance_report", "ar_summary", "close_package"] as const;
  if (!type || !(allowed as readonly string[]).includes(type)) {
    return NextResponse.json(
      { error: `Invalid type. Must be one of: ${allowed.join(", ")}` },
      { status: 400 }
    );
  }

  try {
    await generateReport(
      session.userId,
      type as (typeof allowed)[number],
      period ?? undefined
    );

    const doc = await prisma.document.findFirst({
      where: { userId: session.userId, type, ...(period ? { period } : {}) },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, createdAt: true, period: true },
    });

    if (!doc) {
      return NextResponse.json(
        { error: "Report generation completed but no document was saved" },
        { status: 500 }
      );
    }

    return NextResponse.json(doc, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Report generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
