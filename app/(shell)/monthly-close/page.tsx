import { Suspense } from "react";
import { ClipboardCheck } from "lucide-react";
import Link from "next/link";
import { JourneyPage } from "@/components/journey/journey-page";
import { getSession } from "@/lib/auth";
import { listClosePeriods, resolveActivePeriod, safely } from "@/lib/close/period";
import { getCloseReadiness, getCloseBlockers } from "@/lib/close/stats";
import { deriveTaskCounts } from "@/lib/close/tasks";
import { PeriodPicker } from "./period-picker";
import { ExplainButton } from "./explain-button";
import { GeneratePackageButton } from "./generate-package-button";

const JOURNEY_PROPS = {
  id: "monthly-close",
  title: "Monthly Close",
  description: "Period-aware close readiness, blockers, and package generation",
  icon: ClipboardCheck,
  nudges: [
    "Why is the close readiness score what it is?",
    "What's blocking close for this period?",
    "Generate the close package",
  ],
};

export default async function MonthlyClosePage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { period: requested } = await searchParams;
  const session = await getSession();
  const userId = session?.userId ?? null;

  if (!userId) {
    return (
      <JourneyPage {...JOURNEY_PROPS}>
        <div className="p-10 text-center text-muted-foreground">
          <p className="mb-4">Sign in to see your close status.</p>
        </div>
      </JourneyPage>
    );
  }

  const periods = await listClosePeriods(userId);
  const active = resolveActivePeriod(periods, requested);

  if (!active) {
    return (
      <JourneyPage {...JOURNEY_PROPS}>
        <div className="p-10 text-center text-muted-foreground">
          <p className="mb-4">Upload your first GL, sub-ledger, or budget CSV to see close status.</p>
          <Link href="/data-sources" className="underline">Go to Data Sources</Link>
        </div>
      </JourneyPage>
    );
  }

  const [readiness, blockers, tasks] = await Promise.all([
    safely(() => getCloseReadiness(userId, active), { hasData: false as const }),
    safely(() => getCloseBlockers(userId, active), []),
    safely(() => deriveTaskCounts(userId, active), []),
  ]);

  const header = (
    <div className="flex items-center justify-between gap-2 mb-6">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Period:</span>
        <Suspense fallback={<span className="text-xs text-muted-foreground">loading…</span>}>
          <PeriodPicker />
        </Suspense>
      </div>
      <GeneratePackageButton period={active} />
    </div>
  );

  return (
    <JourneyPage {...JOURNEY_PROPS} periodKey={active}>
      {header}

      {/* Score */}
      <div className="bg-card border border-border rounded-[var(--radius)] p-6 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-5xl font-semibold" style={{ fontFamily: "var(--font-playfair)" }}>
              {readiness.hasData ? `${readiness.score}%` : "—"}
            </div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground mt-1">
              {readiness.hasData ? readiness.tier : "No data"}
            </div>
            <p className="text-sm text-muted-foreground mt-3 max-w-xl">
              {readiness.hasData ? readiness.narrative : "No signals yet for this period."}
            </p>
          </div>
          <ExplainButton
            prompt={`Explain why the close readiness score is ${
              readiness.hasData ? readiness.score : "unavailable"
            }% for period ${active}`}
          />
        </div>
      </div>

      {/* Blockers */}
      <h3 className="text-sm font-semibold mb-3" style={{ fontFamily: "var(--font-playfair)" }}>
        Blockers
      </h3>
      <div className="bg-card border border-border rounded-[var(--radius)] p-4 mb-6">
        {blockers.length === 0 ? (
          <p className="text-sm text-emerald-700">No outstanding blockers for this period.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {blockers.map((b, i) => {
              if (b.kind === "break") {
                return (
                  <li key={`break-${b.breakId}`} className="flex items-center justify-between">
                    <span>
                      Break <span className="font-mono text-xs">{b.ref}</span> · $
                      {Math.abs(b.amount).toLocaleString()} · {b.ageDays}d · {b.severity}
                    </span>
                    <ExplainButton prompt={`investigate break ${b.breakId} for period ${active}`} />
                  </li>
                );
              }
              if (b.kind === "missing_source") {
                return (
                  <li key={`src-${b.sourceType}-${i}`} className="flex items-center justify-between">
                    <span>No {humanSourceType(b.sourceType)} uploaded for {active}</span>
                    <Link href="/data-sources?tab=reconciliation" className="text-xs underline">
                      Upload
                    </Link>
                  </li>
                );
              }
              return (
                <li
                  key={`var-${b.category}-${b.account}-${i}`}
                  className="flex items-center justify-between gap-3"
                >
                  <span className="truncate">
                    <span className="font-medium">{b.account}</span>
                    <span className="text-muted-foreground"> ({b.category})</span>
                    : ${b.actual.toLocaleString()} actual vs ${b.budget.toLocaleString()} budget
                    <span className={b.pct >= 0 ? "text-red-700" : "text-emerald-700"}>
                      {" "}({b.pct >= 0 ? "+" : ""}{(b.pct * 100).toFixed(0)}%)
                    </span>
                  </span>
                  <ExplainButton
                    prompt={`Why did ${b.account} (${b.category}) deviate ${(b.pct * 100).toFixed(
                      0
                    )}% from budget in ${active}? Actual was $${b.actual.toLocaleString()} vs budget $${b.budget.toLocaleString()}.`}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Task cards */}
      <h3 className="text-sm font-semibold mb-3" style={{ fontFamily: "var(--font-playfair)" }}>
        Task Progress
      </h3>
      <div className="grid grid-cols-5 gap-3 mb-6">
        {tasks.map((t) => (
          <div
            key={t.key}
            className="bg-card border border-border rounded-[var(--radius)] p-4"
          >
            <div className="text-xs uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              <span>{t.label}</span>
              <ExplainButton
                prompt={`Why is ${t.label} at ${t.completed}/${t.total} for period ${active}?`}
              />
            </div>
            {t.isEmpty ? (
              <div className="mt-2">
                <p className="text-xs text-muted-foreground">No data yet.</p>
                {t.cta && (
                  <Link href={t.cta.href} className="text-xs underline">
                    {t.cta.label}
                  </Link>
                )}
              </div>
            ) : (
              <div className="mt-2 text-2xl font-semibold">
                {t.completed}
                <span className="text-muted-foreground text-base"> / {t.total}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </JourneyPage>
  );
}

function humanSourceType(t: string): string {
  if (t === "sub_ledger") return "sub-ledger";
  if (t === "gl") return "GL";
  return t;
}
