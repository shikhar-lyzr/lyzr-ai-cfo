import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { status } = body;

  if (!status || !["pending", "flagged", "dismissed"].includes(status)) {
    return NextResponse.json(
      { error: "Invalid status. Must be: pending, flagged, or dismissed" },
      { status: 400 }
    );
  }

  const action = await prisma.action.update({
    where: { id },
    data: { status },
  });

  return NextResponse.json(action);
}
