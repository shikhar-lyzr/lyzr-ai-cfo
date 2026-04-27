"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Bot, FileText, Upload, FileSignature, GitMerge } from "lucide-react";
import type { AuditTimelineRow, AuditSource } from "@/lib/audit-trail/types";

type Props = {
  rows: AuditTimelineRow[];
  errors: Partial<Record<AuditSource, string>>;
  activeSources: AuditSource[];
  activeFrom: string;
  activeTo: string;
};

const ICONS: Record<AuditSource, React.ComponentType<{ size?: number; className?: string }>> = {
  action: Bot,
  decision: FileSignature,
  data_source: Upload,
  document: FileText,
  match_run: GitMerge,
};

const SOURCE_LABELS: Record<AuditSource, string> = {
  action: "Action events",
  decision: "Decisions",
  data_source: "Uploads",
  document: "Documents",
  match_run: "Match runs",
};

export function AuditTrailClient({ rows, errors, activeSources, activeFrom, activeTo }: Props) {
  const router = useRouter();
  const params = useSearchParams();

  function setQuery(updates: Record<string, string | string[] | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(updates)) {
      next.delete(k);
      if (v == null) continue;
      if (Array.isArray(v)) v.forEach((vv) => next.append(k, vv));
      else if (v !== "") next.set(k, v);
    }
    router.push(`/audit-trail?${next.toString()}`);
  }

  function toggleSource(source: AuditSource) {
    const has = activeSources.includes(source);
    const next = has ? activeSources.filter((s) => s !== source) : [...activeSources, source];
    setQuery({ source: next });
  }

  const exportHref = (() => {
    const next = new URLSearchParams();
    activeSources.forEach((s) => next.append("source", s));
    if (activeFrom) next.set("from", activeFrom);
    if (activeTo) next.set("to", activeTo);
    return `/api/audit-trail/export.csv?${next.toString()}`;
  })();

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-[28px] font-bold text-foreground" style={{ fontFamily: "var(--font-playfair)" }}>
          Audit Trail
        </h1>
        <p className="text-sm text-muted-foreground">
          User-facing state changes across data, decisions, and runs
        </p>
      </div>

      {Object.keys(errors).length > 0 && (
        <div className="border border-amber-300 bg-amber-50 text-amber-900 rounded p-3 text-xs">
          Some sources failed to load: {Object.entries(errors).map(([s, m]) => `${s}: ${m}`).join("; ")}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(SOURCE_LABELS) as AuditSource[]).map((s) => {
            const active = activeSources.includes(s);
            return (
              <button
                key={s}
                onClick={() => toggleSource(s)}
                className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${
                  active
                    ? "bg-foreground text-background border-foreground"
                    : "bg-card text-muted-foreground border-border hover:text-foreground"
                }`}
              >
                {SOURCE_LABELS[s]}
              </button>
            );
          })}
          <input
            type="date"
            value={activeFrom}
            onChange={(e) => setQuery({ from: e.target.value || null })}
            className="px-3 py-1.5 bg-card border border-border rounded text-xs"
          />
          <input
            type="date"
            value={activeTo}
            onChange={(e) => setQuery({ to: e.target.value || null })}
            className="px-3 py-1.5 bg-card border border-border rounded text-xs"
          />
        </div>
        <a
          href={exportHref}
          className="px-4 py-2 bg-card border border-border rounded text-sm font-medium hover:bg-accent"
        >
          Export CSV
        </a>
      </div>

      {rows.length === 0 ? (
        <div className="text-center py-16 text-sm text-muted-foreground">
          No audit events match the current filters.
        </div>
      ) : (
        <div className="relative pl-6">
          <div className="absolute left-[7px] top-0 bottom-0 w-px bg-border" />
          <div className="space-y-6">
            {rows.map((row) => {
              const Icon = ICONS[row.source];
              return (
                <div key={row.id} className="flex gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 rounded-full bg-card flex items-center justify-center border border-border">
                      <Icon size={18} className="text-muted-foreground" />
                    </div>
                  </div>
                  <div className="flex-1 bg-card border border-border rounded-[var(--radius)] p-4 space-y-2">
                    <div className="flex items-baseline justify-between">
                      <p className="text-sm font-semibold text-foreground">{row.actorId}</p>
                      <p className="text-xs text-muted-foreground text-right">
                        {new Date(row.timestamp).toLocaleString()}
                      </p>
                    </div>
                    <p className="text-sm text-foreground">{row.summary}</p>
                    <div className="pt-2 flex gap-2">
                      <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                        {SOURCE_LABELS[row.source]}
                      </span>
                      {row.refType && row.refId && (
                        <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium font-mono text-muted-foreground">
                          {row.refType}:{row.refId.slice(-8)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
