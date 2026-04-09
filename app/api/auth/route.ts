import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createSessionCookie } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { email } = body;

  if (!email) {
    return NextResponse.json({ error: "Email required" }, { status: 400 });
  }

  let user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    user = await prisma.user.create({
      data: {
        lyzrAccountId: `lyzr_${Date.now()}`,
        email,
        name: email.split("@")[0],
        credits: 1000,
      },
    });
  }

  const sessionValue = createSessionCookie(user.id, user.email, user.name);

  const response = NextResponse.json({
    user: { id: user.id, email: user.email, name: user.name, credits: user.credits },
  });

  response.cookies.set("lyzr-session", sessionValue, {
    httpOnly: true,
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete("lyzr-session");
  return response;
}
