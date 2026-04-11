import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const action = await prisma.action.findUnique({ where: { id } });
  if (!action) {
    return NextResponse.json({ error: "Action not found" }, { status: 404 });
  }

  const events = await prisma.actionEvent.findMany({
    where: { actionId: id },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      fromStatus: true,
      toStatus: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ events });
}
