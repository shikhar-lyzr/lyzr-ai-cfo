export type AuditSource = "action" | "decision" | "data_source" | "document" | "match_run";

export type AuditTimelineRow = {
  id: string;                          // composite: `${source}:${nativeId}`
  source: AuditSource;
  timestamp: string;                   // ISO
  actorId: string;
  summary: string;
  refType: string | null;
  refId: string | null;
  metadata: Record<string, unknown>;
};
