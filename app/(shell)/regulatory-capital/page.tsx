import { Suspense } from "react";
import { Landmark } from "lucide-react";
import Link from "next/link";
import { JourneyPage } from "@/components/journey/journey-page";
import { getSession } from "@/lib/auth";
import {
  listCapitalPeriods,
  resolveActivePeriod,
  safely,
  getCapitalSnapshot,
  getCapitalBreaches,
  getRwaBreakdown,
  effectiveMinimum,
  ratioStatus,
  type RatioKey,
  type Breach,
  type Snapshot,
  type RwaBreakdownRow,
} from "@/lib/capital";
import { PeriodPicker } from "./period-picker";
import { ExplainButton } from "./explain-button";

const JOURNEY_PROPS = {
  id: "regulatory-capital",
  title: "Regulatory Capital",
  description: "CET1, RWA, leverage ratios & Basel III compliance assessment",
  icon: Landmark,
  nudges: ["Are we above minimums?", "What drives RWA?", "CET1 trend"],
};

export default async function RegulatoryCapitalPage({
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
          <p className="mb-4">Sign in to see your regulatory capital position.</p>
        </div>
      </JourneyPage>
    );
  }

  const periods = await listCapitalPeriods(userId);
  const active = resolveActivePeriod(periods, requested);

  if (!active) {
    return (
      <JourneyPage {...JOURNEY_PROPS}>
        <div className="p-10 text-center text-muted-foreground">
          <p className="mb-4">
            Upload a capital components CSV to see your Basel III ratios.
          </p>
          <Link href="/data-sources?tab=capital" className="underline">
            Go to Data Sources
          </Link>
        </div>
      </JourneyPage>
    );
  }

  const [snapshot, breaches, rwa] = await Promise.all([
    safely(() => getCapitalSnapshot(userId, active), { hasData: false as const }),
    safely(() => getCapitalBreaches(userId, active), [] as Breach[]),
    safely(() => getRwaBreakdown(userId, active), [] as RwaBreakdownRow[]),
  ]);

  const header = (
    <div className="flex items-center justify-between gap-2 mb-6">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Period:</span>
        <Suspense fallback={<span className="text-xs text-muted-foreground">loading…</span>}>
          <PeriodPicker />
        </Suspense>
      </div>
    </div>
  );

  return (
    <JourneyPage {...JOURNEY_PROPS} periodKey={active}>
      {header}

      {/* Ratio cards */}
      <div className="grid grid-cols-3 gap-6 mb-6">
        <RatioCard
          label="CET1"
          ratioKey="cet1"
          snapshot={snapshot}
          period={active}
        />
        <RatioCard
          label="Tier 1"
          ratioKey="tier1"
          snapshot={snapshot}
          period={active}
        />
        <RatioCard
          label="Total Capital"
          ratioKey="total"
          snapshot={snapshot}
          period={active}
        />
      </div>

      {/* Breaches section */}
      {breaches.length > 0 && (
        <>
          <h3 className="text-sm font-semibold mb-3" style={{ fontFamily: "var(--font-playfair)" }}>
            Breaches & warnings
          </h3>
          <div className="bg-card border border-border rounded-[var(--radius)] p-4 mb-6">
            <ul className="space-y-2 text-sm">
              {breaches.map((b, i) => (
                <BreachRow key={i} breach={b} period={active} />
              ))}
            </ul>
          </div>
        </>
      )}

      {/* RWA breakdown */}
      {rwa.length > 0 && (
        <>
          <h3 className="text-sm font-semibold mb-3" style={{ fontFamily: "var(--font-playfair)" }}>
            RWA breakdown
          </h3>
          <RwaBreakdownTable rows={rwa} period={active} />
        </>
      )}

      {/* Hint when RWA not uploaded but snapshot exists */}
      {rwa.length === 0 && snapshot.hasData && (
        <div className="text-xs text-muted-foreground mt-4">
          Upload an RWA breakdown CSV at{" "}
          <Link href="/data-sources?tab=capital" className="underline">
            Data Sources
          </Link>{" "}
          to see what drives your RWA.
        </div>
      )}
    </JourneyPage>
  );
}

function RatioCard({
  label,
  ratioKey,
  snapshot,
  period,
}: {
  label: string;
  ratioKey: RatioKey;
  snapshot: Snapshot;
  period: string;
}) {
  const minimum = effectiveMinimum(ratioKey);
  const value = snapshot.hasData
    ? ratioKey === "cet1"
      ? snapshot.cet1Ratio
      : ratioKey === "tier1"
        ? snapshot.tier1Ratio
        : snapshot.totalRatio
    : null;
  const status = value !== null ? ratioStatus(value, ratioKey) : "below_minimum";
  const barColor =
    status === "above_buffer"
      ? "bg-success"
      : status === "above_minimum"
        ? "bg-amber-500"
        : "bg-danger";
  const displayValue = value !== null ? `${(value * 100).toFixed(2)}%` : "—";
  const displayMin = `${(minimum * 100).toFixed(1)}%`;
  const barPct = value !== null ? Math.min((value / 0.20) * 100, 100) : 0;

  return (
    <div className="bg-card border border-border rounded-[var(--radius)] p-6 text-center">
      <div className="flex items-start justify-between mb-2">
        <div className="text-sm font-medium text-foreground">{label}</div>
        {value !== null && (
          <ExplainButton
            prompt={`Explain why the ${label} ratio is ${displayValue} for period ${period}`}
          />
        )}
      </div>
      <div
        className="text-3xl font-semibold text-foreground"
        style={{ fontFamily: "var(--font-playfair)" }}
      >
        {displayValue}
      </div>
      <div className="text-xs text-muted-foreground mt-2">Min. required: {displayMin}</div>
      <div className="w-full bg-border/50 rounded-full h-2 mt-3">
        <div className={`${barColor} rounded-full h-2`} style={{ width: `${barPct}%` }} />
      </div>
    </div>
  );
}

function BreachRow({ breach, period }: { breach: Breach; period: string }) {
  if (breach.kind === "ratio_breach") {
    return (
      <li className="flex items-center justify-between gap-3">
        <span>
          <span className="font-medium uppercase">{breach.ratio}</span> is{" "}
          {(breach.value * 100).toFixed(2)}% — below {(breach.minimum * 100).toFixed(1)}% minimum
          (gap: {(breach.gap * 100).toFixed(2)}%)
        </span>
        <ExplainButton
          prompt={`Why is ${breach.ratio.toUpperCase()} below the regulatory minimum for ${period}? Suggest actions to restore it.`}
        />
      </li>
    );
  }
  if (breach.kind === "missing_source") {
    const label =
      breach.sourceType === "capital_components" ? "capital components" : "RWA breakdown";
    return (
      <li className="flex items-center justify-between gap-3">
        <span>No {label} uploaded for {period}</span>
        <Link href="/data-sources?tab=capital" className="text-xs underline">
          Upload
        </Link>
      </li>
    );
  }
  return (
    <li className="flex items-center justify-between gap-3">
      <span>
        Capital components report ${breach.capitalTotal.toLocaleString()} RWA, RWA breakdown sums
        to ${breach.rwaLineTotal.toLocaleString()} ({(breach.deltaPct * 100).toFixed(2)}% gap)
      </span>
      <ExplainButton
        prompt={`The capital components file shows $${breach.capitalTotal.toLocaleString()} total RWA but the RWA breakdown sums to $${breach.rwaLineTotal.toLocaleString()}. What could explain the discrepancy?`}
      />
    </li>
  );
}

function RwaBreakdownTable({
  rows,
  period,
}: {
  rows: RwaBreakdownRow[];
  period: string;
}) {
  return (
    <div className="bg-card border border-border rounded-[var(--radius)] overflow-hidden">
      <div className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-0 px-4 py-2.5 border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
        <div>Risk Type</div>
        <div className="text-right">Total RWA</div>
        <div className="text-right">Share</div>
        <div className="text-right"># classes</div>
        <div />
      </div>
      {rows.map((r) => (
        <RwaBreakdownRow key={r.riskType} row={r} period={period} />
      ))}
    </div>
  );
}

// Each row is a native <details> element. Collapsed by default; clicking the
// summary row expands it in-place to show the exposure-class lines. No client
// state — works with plain HTML.
function RwaBreakdownRow({ row, period }: { row: RwaBreakdownRow; period: string }) {
  return (
    <details className="border-b border-border last:border-b-0 group">
      <summary className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-0 px-4 py-2.5 text-sm cursor-pointer hover:bg-secondary/30 list-none [&::-webkit-details-marker]:hidden">
        <div className="font-medium capitalize flex items-center gap-2">
          <span className="text-muted-foreground group-open:rotate-90 transition-transform">›</span>
          {row.riskType}
        </div>
        <div className="text-right font-semibold">${row.totalRwa.toLocaleString()}</div>
        <div className="text-right text-muted-foreground">
          {(row.share * 100).toFixed(1)}%
        </div>
        <div className="text-right text-muted-foreground">{row.lineCount}</div>
        <div className="text-right" onClick={(e) => e.stopPropagation()}>
          <ExplainButton
            prompt={`What drives ${row.riskType} RWA for ${period}? Which exposure classes contribute most?`}
          />
        </div>
      </summary>
      <div className="bg-secondary/20 px-8 py-3">
        {row.lines.length === 0 ? (
          <p className="text-xs text-muted-foreground">No exposure-class detail.</p>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="text-muted-foreground">
                <th className="text-left py-1">Exposure Class</th>
                <th className="text-right py-1">Exposure</th>
                <th className="text-right py-1">Weight</th>
                <th className="text-right py-1">RWA</th>
              </tr>
            </thead>
            <tbody>
              {row.lines.map((l, i) => (
                <tr key={i}>
                  <td className="py-1">{l.exposureClass}</td>
                  <td className="py-1 text-right">${l.exposureAmount.toLocaleString()}</td>
                  <td className="py-1 text-right">{(l.riskWeight * 100).toFixed(1)}%</td>
                  <td className="py-1 text-right font-medium">${l.rwa.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </details>
  );
}
