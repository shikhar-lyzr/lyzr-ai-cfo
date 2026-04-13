import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  const sources = await prisma.dataSource.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  const shape = searchParams.get("shape");
  const filtered = shape
    ? sources.filter((s) => {
        try {
          return JSON.parse(s.metadata ?? "{}").shape === shape;
        } catch {
          return false;
        }
      })
    : sources;

  return NextResponse.json(filtered);
}
