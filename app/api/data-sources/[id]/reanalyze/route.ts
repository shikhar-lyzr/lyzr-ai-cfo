import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { analyzeUpload, analyzeArUpload } from "@/lib/agent";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;

  const dataSource = await prisma.dataSource.findUnique({ where: { id } });
  if (!dataSource) {
    return NextResponse.json({ error: "Data source not found" }, { status: 404 });
  }
  if (dataSource.userId !== session.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (dataSource.status !== "ready") {
    return NextResponse.json({ error: "Data source is not ready" }, { status: 409 });
  }

  let shape = "variance";
  try {
    shape = JSON.parse(dataSource.metadata ?? "{}").shape ?? "variance";
  } catch {
    // default to variance
  }

  await prisma.dataSource.update({
    where: { id },
    data: { status: "processing" },
  });

  if (shape === "ar") {
    const invoiceCount = await prisma.invoice.count({ where: { dataSourceId: id } });
    analyzeArUpload(session.userId, id, dataSource.name, invoiceCount)
      .catch((err) => console.error("[reanalyze] AR agent failed:", err));
  } else {
    analyzeUpload(session.userId, id, dataSource.name, dataSource.recordCount)
      .catch((err) => console.error("[reanalyze] Variance agent failed:", err));
  }

  return NextResponse.json({ status: "processing" });
}
