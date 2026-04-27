import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { listDecisions } from "@/lib/decisions/service";
import { DecisionInboxClient } from "./decision-inbox-client";

export const dynamic = "force-dynamic";

export default async function DecisionInboxPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [pending, approved, rejected] = await Promise.all([
    listDecisions(session.userId, "pending"),
    listDecisions(session.userId, "approved"),
    listDecisions(session.userId, "rejected"),
  ]);

  return (
    <DecisionInboxClient
      pending={pending}
      approved={approved}
      rejected={rejected}
    />
  );
}
