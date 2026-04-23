import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listCapitalPeriods, safely } from "@/lib/capital/period";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const periods = await safely(() => listCapitalPeriods(session.userId), []);
  return NextResponse.json({ periods });
}
