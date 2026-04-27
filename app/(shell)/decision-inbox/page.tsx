import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { listDecisions } from "@/lib/decisions/service";
import { decisionToRow, actionToRow, type InboxRow } from "./inbox-row";
import { DecisionInboxClient } from "./decision-inbox-client";

export const dynamic = "force-dynamic";

export default async function DecisionInboxPage() {
  const session = await getSession();
  if (!session) redirect("/login");

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

  const rows: InboxRow[] = (
    [
      ...pendingDecisions.map((d) => decisionToRow(d as any)),
      ...pendingActions.map(actionToRow),
    ] as InboxRow[]
  ).sort((x, y) => y.createdAt.getTime() - x.createdAt.getTime());

  return <DecisionInboxClient rows={rows} />;
}
