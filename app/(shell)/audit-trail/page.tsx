import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { queryAuditTrail } from "@/lib/audit-trail/query";
import { AuditTrailClient } from "./audit-trail-client";

export const dynamic = "force-dynamic";

export default async function AuditTrailPage({
  searchParams,
}: {
  searchParams: Promise<{ source?: string | string[]; from?: string; to?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const sp = await searchParams;
  const sourcesParam = Array.isArray(sp.source) ? sp.source : sp.source ? [sp.source] : [];
  const valid = ["action", "decision", "data_source", "document", "match_run"] as const;
  const sources = sourcesParam.filter((s): s is typeof valid[number] => (valid as readonly string[]).includes(s));

  const result = await queryAuditTrail({
    userId: session.userId,
    sources: sources.length > 0 ? sources : undefined,
    from: sp.from ? new Date(sp.from) : undefined,
    to: sp.to ? new Date(sp.to) : undefined,
    limit: 200,
  });

  return (
    <AuditTrailClient
      rows={result.rows}
      errors={result.errors}
      activeSources={sources}
      activeFrom={sp.from ?? ""}
      activeTo={sp.to ?? ""}
    />
  );
}
