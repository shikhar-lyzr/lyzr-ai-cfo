import { Suspense } from "react";
import { RefreshCw } from "lucide-react";
import Link from "next/link";
import { JourneyPage } from "@/components/journey/journey-page";
import { MetricCard } from "@/components/shared/metric-card";
import { DonutChart } from "@/components/shared/donut-chart";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getReconciliationStats, getTopBreaks } from "@/lib/reconciliation/stats";
import { PeriodPicker } from "./period-picker";
import { AskAiButton } from "./ask-ai-button";
import { HighlightOnMount } from "./highlight-on-mount";

type TopBreak = Awaited<ReturnType<typeof getTopBreaks>>[number];

const JOURNEY_PROPS = {
  id: "financial-reconciliation",
  title: "Financial Reconciliation",
  description: "GL vs sub-ledger matching, break identification & ageing analysis",
  icon: RefreshCw,
  nudges: [
    "Why is match rate below 90%?",
    "Show me breaks over $10K",
    "Propose adjustments for timing differences",
  ],
};

export default async function FinancialReconciliationPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; breakId?: string }>;
}) {
  const { period, breakId } = await searchParams;
  const session = await getSession();
  const userId = session?.userId ?? null;

  if (!userId) {
    return (
      <JourneyPage {...JOURNEY_PROPS}>
        <div className="p-10 text-center text-muted-foreground">
          <p className="mb-4">No reconciliation data yet.</p>
          <Link href="/data-sources?tab=reconciliation" className="underline">
            Upload GL + sub-ledger CSVs
          </Link>
        </div>
      </JourneyPage>
    );
  }

  const periods = await prisma.reconPeriod.findMany({
    where: { userId },
    orderBy: [{ createdAt: "desc" }, { periodKey: "desc" }],
  });

  if (periods.length === 0) {
    return (
      <JourneyPage {...JOURNEY_PROPS}>
        <div className="p-10 text-center text-muted-foreground">
          <p className="mb-4">No reconciliation data yet.</p>
          <Link href="/data-sources?tab=reconciliation" className="underline">
            Upload GL + sub-ledger CSVs
          </Link>
        </div>
      </JourneyPage>
    );
  }

  const active =
    period && periods.some((p) => p.periodKey === period) ? period : periods[0].periodKey;

  const [stats, glCount, subCount] = await Promise.all([
    getReconciliationStats(userId, active),
    prisma.gLEntry.count({ where: { dataSource: { userId }, periodKey: active } }),
    prisma.subLedgerEntry.count({ where: { dataSource: { userId }, periodKey: active } }),
  ]);
  const topBreaks: TopBreak[] = stats.hasData ? await getTopBreaks(userId, active, 10) : [];

  const header = (
    <div className="flex items-center gap-2 mb-6">
      <span className="text-xs text-muted-foreground">Period:</span>
      <Suspense
        fallback={<span className="text-xs text-muted-foreground">loading periods…</span>}
      >
        <PeriodPicker />
      </Suspense>
    </div>
  );

  if (!stats.hasData) {
    let message = "No reconciliation data for this period yet.";
    if (glCount > 0 && subCount === 0) {
      message =
        "This period has GL but not the sub-ledger yet. Upload the missing CSV to auto-match.";
    } else if (subCount > 0 && glCount === 0) {
      message =
        "This period has sub-ledger but not the GL yet. Upload the missing CSV to auto-match.";
    }
    return (
      <JourneyPage {...JOURNEY_PROPS} periodKey={active}>
        {header}
        <div className="p-10 text-center text-muted-foreground">
          <p className="mb-4">{message}</p>
          <Link href="/data-sources?tab=reconciliation" className="underline">
            Upload GL + sub-ledger CSVs
          </Link>
        </div>
      </JourneyPage>
    );
  }

  if (stats.openBreakCount === 0) {
    return (
      <JourneyPage {...JOURNEY_PROPS} periodKey={active}>
        {header}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <MetricCard value={`${(stats.matchRate * 100).toFixed(1)}%`} label="Match rate" />
          <MetricCard
            value={stats.openBreakCount.toLocaleString()}
            label="Open breaks"
            sublabel={`$${stats.openBreakValue.toLocaleString()}`}
          />
          <MetricCard value={`${stats.oldestBreakDays}d`} label="Oldest break" />
          <div className="flex items-center justify-center">
            <DonutChart
              slices={[
                { label: "GL only", value: stats.glOnly, color: "#ef4444" },
                { label: "Sub only", value: stats.subOnly, color: "#f59e0b" },
              ]}
            />
          </div>
        </div>
        <div className="p-10 text-center text-muted-foreground">
          <p>All breaks resolved for this period.</p>
        </div>
      </JourneyPage>
    );
  }

  return (
    <JourneyPage {...JOURNEY_PROPS} periodKey={active}>
      {header}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <MetricCard value={`${(stats.matchRate * 100).toFixed(1)}%`} label="Match rate" />
        <MetricCard
          value={stats.openBreakCount.toLocaleString()}
          label="Open breaks"
          sublabel={`$${stats.openBreakValue.toLocaleString()}`}
        />
        <MetricCard value={`${stats.oldestBreakDays}d`} label="Oldest break" />
        <div className="flex items-center justify-center">
          <DonutChart
            slices={[
              { label: "GL only", value: stats.glOnly, color: "#ef4444" },
              { label: "Sub only", value: stats.subOnly, color: "#f59e0b" },
            ]}
          />
        </div>
      </div>

      <h3 className="text-sm font-semibold mb-3" style={{ fontFamily: "var(--font-playfair)" }}>
        Top Exceptions
      </h3>
      <div className="bg-card border border-border rounded-[var(--radius)] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-4 py-2.5 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Ref</th>
              <th className="text-left px-4 py-2.5 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Amount</th>
              <th className="text-left px-4 py-2.5 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Type</th>
              <th className="text-left px-4 py-2.5 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Age</th>
              <th className="text-left px-4 py-2.5 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Counterparty</th>
              <th className="text-left px-4 py-2.5 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Severity</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {topBreaks.map((b) => (
              <tr key={b.id} id={`break-${b.id}`} className="border-b border-border last:border-b-0 hover:bg-secondary/30 transition-shadow">
                <td className="px-4 py-2.5 font-mono text-xs">{b.ref}</td>
                <td className="px-4 py-2.5 font-semibold">
                  ${Math.abs(b.amount).toLocaleString()} {b.currency}
                </td>
                <td className="px-4 py-2.5">{b.type}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{b.age}d</td>
                <td className="px-4 py-2.5 text-muted-foreground">{b.counterparty}</td>
                <td className="px-4 py-2.5">
                  <span className={`text-xs uppercase ${b.severity === "high" ? "text-red-600" : b.severity === "medium" ? "text-amber-600" : "text-muted-foreground"}`}>
                    {b.severity}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  <AskAiButton breakId={b.id} periodKey={active} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <HighlightOnMount targetId={breakId ? `break-${breakId}` : null} />
    </JourneyPage>
  );
}
