import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { inferToneFromInvoice, buildDunningEmailBody } from "@/lib/agent/tools";

// ── GET — return (and lazily generate) draftBody ─────────────────────
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const action = await prisma.action.findUnique({
    where: { id },
    include: { invoice: true },
  });

  if (!action || action.type !== "ar_followup") {
    return NextResponse.json({ error: "AR action not found" }, { status: 404 });
  }

  // If draftBody already cached, return it
  if (action.draftBody) {
    return NextResponse.json({ draftBody: action.draftBody });
  }

  // Lazy-generate from invoice
  if (!action.invoice) {
    return NextResponse.json(
      { error: "No linked invoice — cannot generate draft" },
      { status: 422 }
    );
  }

  const tone = inferToneFromInvoice(action.invoice.dueDate);
  const body = buildDunningEmailBody(action.invoice, tone);

  await prisma.action.update({
    where: { id },
    data: { draftBody: body },
  });

  return NextResponse.json({ draftBody: body });
}

// ── POST — mark_sent | snooze | escalate ─────────────────────────────
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { op, days } = body as { op: string; days?: number };

  if (!op || !["mark_sent", "snooze", "escalate"].includes(op)) {
    return NextResponse.json(
      { error: "Invalid op. Must be: mark_sent, snooze, or escalate" },
      { status: 400 }
    );
  }

  const action = await prisma.action.findUnique({
    where: { id },
    include: { invoice: true },
  });

  if (!action || action.type !== "ar_followup") {
    return NextResponse.json({ error: "AR action not found" }, { status: 404 });
  }

  if (!action.invoice) {
    return NextResponse.json(
      { error: "No linked invoice for this action" },
      { status: 422 }
    );
  }

  const invoice = action.invoice;

  if (op === "mark_sent") {
    const [updatedAction] = await prisma.$transaction([
      prisma.action.update({
        where: { id },
        data: { status: "approved" },
      }),
      prisma.invoice.update({
        where: { id: invoice.id },
        data: { status: "sent", lastDunnedAt: new Date() },
      }),
      prisma.actionEvent.create({
        data: {
          actionId: id,
          userId: action.userId,
          fromStatus: action.status,
          toStatus: "approved",
        },
      }),
    ]);
    return NextResponse.json(updatedAction);
  }

  if (op === "snooze") {
    const snoozeDays = days ?? 7;
    const snoozedUntil = new Date(
      Date.now() + snoozeDays * 24 * 60 * 60 * 1000
    );

    const [updatedAction] = await prisma.$transaction([
      prisma.action.update({
        where: { id },
        data: { status: "dismissed" },
      }),
      prisma.invoice.update({
        where: { id: invoice.id },
        data: { status: "snoozed", snoozedUntil },
      }),
      prisma.actionEvent.create({
        data: {
          actionId: id,
          userId: action.userId,
          fromStatus: action.status,
          toStatus: "dismissed",
        },
      }),
    ]);
    return NextResponse.json(updatedAction);
  }

  // op === "escalate"
  const [updatedAction] = await prisma.$transaction([
    prisma.action.update({
      where: { id },
      data: { status: "flagged" },
    }),
    prisma.invoice.update({
      where: { id: invoice.id },
      data: { status: "escalated" },
    }),
    prisma.actionEvent.create({
      data: {
        actionId: id,
        userId: action.userId,
        fromStatus: action.status,
        toStatus: "flagged",
      },
    }),
  ]);

  // Generate fresh escalation draft
  const escalationBody = buildDunningEmailBody(invoice, "escalation");
  await prisma.action.update({
    where: { id },
    data: { draftBody: escalationBody },
  });

  return NextResponse.json({ ...updatedAction, draftBody: escalationBody });
}
