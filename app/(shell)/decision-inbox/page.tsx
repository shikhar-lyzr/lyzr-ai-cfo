import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { listDecisions } from "@/lib/decisions/service";
import { decisionToRow, actionToRow, type InboxRow } from "./inbox-row";
import { parseFilters } from "./inbox-filters";
import { DecisionInboxClient } from "./decision-inbox-client";

export const dynamic = "force-dynamic";

export default async function DecisionInboxPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const sp = await searchParams;
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const initialFilters = parseFilters({
    kind: first(sp.kind),
    severity: first(sp.severity),
    age: first(sp.age),
  });

  const [pendingDecisions, pendingActionsRaw] = await Promise.all([
    listDecisions(session.userId, "pending"),
    prisma.action.findMany({
      where: { userId: session.userId, status: "pending" },
      orderBy: { createdAt: "desc" },
      include: { dataSource: { select: { name: true } } },
    }),
  ]);

  const pendingActions = pendingActionsRaw.map((a) => ({
    ...a,
    sourceName: a.dataSource?.name ?? null,
  }));

  const reconBreakActionIds = pendingActions
    .filter((a) => a.type === "reconciliation_break")
    .map((a) => a.id);

  const breakRows = reconBreakActionIds.length === 0
    ? []
    : await prisma.break.findMany({
        where: { actionId: { in: reconBreakActionIds } },
        select: { id: true, actionId: true },
      });

  const breakIdByActionId = new Map(
    breakRows.filter((b) => b.actionId).map((b) => [b.actionId as string, b.id]),
  );

  const rows: InboxRow[] = (
    [
      ...pendingDecisions.map((d) => decisionToRow(d as any)),
      ...pendingActions.map((a) => actionToRow(a, breakIdByActionId.get(a.id))),
    ] as InboxRow[]
  ).sort((x, y) => y.createdAt.getTime() - x.createdAt.getTime());

  return <DecisionInboxClient rows={rows} initialFilters={initialFilters} />;
}
