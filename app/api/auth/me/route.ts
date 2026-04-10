import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Fetch fresh user data (credits may have changed)
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { credits: true, name: true, email: true },
  });

  if (!user) {
    // Session token exists but user was deleted from DB (e.g., after force-reset)
    const response = NextResponse.json({ error: "User no longer exists" }, { status: 401 });
    response.cookies.delete("lyzr-session");
    return response;
  }

  return NextResponse.json({
    ...session,
    name: user?.name ?? session.name,
    email: user?.email ?? session.email,
    credits: user?.credits ?? 0,
  });
}
