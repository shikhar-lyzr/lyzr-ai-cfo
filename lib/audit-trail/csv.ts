import type { AuditTimelineRow } from "./types";

const HEADER = ["timestamp", "source", "actorId", "summary", "refType", "refId"] as const;

function escape(v: string | null | undefined): string {
  if (v == null) return "";
  if (/[,"\n]/.test(v)) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

export function toCsv(
  rows: AuditTimelineRow[],
  opts: { warnings?: string[] } = {},
): string {
  const out: string[] = [];
  if (opts.warnings && opts.warnings.length > 0) {
    out.push(`# warnings: ${opts.warnings.join("; ")}`);
  }
  out.push(HEADER.join(","));
  for (const r of rows) {
    out.push([
      escape(r.timestamp),
      escape(r.source),
      escape(r.actorId),
      escape(r.summary),
      escape(r.refType),
      escape(r.refId),
    ].join(","));
  }
  return out.join("\n") + "\n";
}
