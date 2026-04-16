import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const userId = searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  const type = searchParams.get("type");
  const severity = searchParams.get("severity");
  const status = searchParams.get("status");

  const where: Record<string, unknown> = { userId };
  if (type && type !== "all") where.type = type;
  if (severity && severity !== "all") where.severity = severity;
  if (status && status !== "all") where.status = status;

  const actions = await prisma.action.findMany({
    where,
    include: { dataSource: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });

  const formatted = actions.map((a: any) => ({
    ...a,
    sourceName: a.dataSource?.name,
    dataSource: undefined,
  }));

  return NextResponse.json(formatted);
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  const { userId, type, severity, headline, detail, driver, sourceDataSourceId } = body;

  if (!userId || !type || !severity || !headline || !sourceDataSourceId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const action = await prisma.action.create({
    data: {
      userId,
      type,
      severity,
      headline,
      detail: detail ?? "",
      driver: driver ?? "",
      sourceDataSourceId,
    },
  });

  return NextResponse.json(action, { status: 201 });
}
