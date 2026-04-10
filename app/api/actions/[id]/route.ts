import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { status } = body;

  if (!status || !["pending", "flagged", "dismissed", "approved"].includes(status)) {
    return NextResponse.json(
      { error: "Invalid status. Must be: pending, flagged, dismissed, or approved" },
      { status: 400 }
    );
  }

  const existing = await prisma.action.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Action not found" }, { status: 404 });
  }

  // Write audit trail
  await prisma.actionEvent.create({
    data: {
      actionId: id,
      userId: existing.userId,
      fromStatus: existing.status,
      toStatus: status,
    },
  });

  const action = await prisma.action.update({
    where: { id },
    data: { status },
  });

  return NextResponse.json(action);
}
