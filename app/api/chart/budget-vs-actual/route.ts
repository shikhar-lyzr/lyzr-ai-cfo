import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const records = await prisma.financialRecord.findMany({
    where: { dataSource: { userId: session.userId } },
    select: { category: true, actual: true, budget: true },
  });

  // Group by category, sum actual and budget
  const categoryMap = new Map<string, { actual: number; budget: number }>();
  for (const r of records) {
    const prev = categoryMap.get(r.category) ?? { actual: 0, budget: 0 };
    categoryMap.set(r.category, {
      actual: prev.actual + r.actual,
      budget: prev.budget + r.budget,
    });
  }

  // Sort by budget descending, top 8
  const data = [...categoryMap.entries()]
    .sort((a, b) => b[1].budget - a[1].budget)
    .slice(0, 8)
    .map(([category, { actual, budget }]) => ({
      category,
      actual: Math.round(actual),
      budget: Math.round(budget),
      variance: Math.round(actual - budget),
    }));

  return NextResponse.json(data);
}
