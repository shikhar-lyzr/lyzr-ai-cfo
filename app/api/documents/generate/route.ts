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
  const { type } = body as { type: string };

  if (!type || !["variance_report", "ar_summary"].includes(type)) {
    return NextResponse.json(
      { error: "Invalid type. Must be: variance_report or ar_summary" },
      { status: 400 }
    );
  }

  try {
    await generateReport(session.userId, type as "variance_report" | "ar_summary");

    // Find the most recently created document of this type
    const doc = await prisma.document.findFirst({
      where: { userId: session.userId, type },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, createdAt: true },
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
