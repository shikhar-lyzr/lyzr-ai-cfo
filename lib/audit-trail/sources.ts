import type {
  ActionEvent, DecisionEvent, DataSource, Document, MatchRun,
} from "@prisma/client";
import type { AuditTimelineRow } from "./types";

export function fromActionEvent(e: ActionEvent & { action?: { headline?: string | null } | null }): AuditTimelineRow {
  return {
    id: `action:${e.id}`,
    source: "action",
    timestamp: e.createdAt.toISOString(),
    actorId: e.userId,
    summary: `Action ${e.fromStatus} → ${e.toStatus}${e.action?.headline ? ` (${e.action.headline})` : ""}`,
    refType: "Action",
    refId: e.actionId,
    metadata: { fromStatus: e.fromStatus, toStatus: e.toStatus },
  };
}

export function fromDecisionEvent(e: DecisionEvent & { decision?: { headline?: string | null } | null }): AuditTimelineRow {
  return {
    id: `decision:${e.id}`,
    source: "decision",
    timestamp: e.createdAt.toISOString(),
    actorId: e.actorId,
    summary: `Decision ${e.fromStatus} → ${e.toStatus}${e.decision?.headline ? ` (${e.decision.headline})` : ""}`,
    refType: "Decision",
    refId: e.decisionId,
    metadata: { fromStatus: e.fromStatus, toStatus: e.toStatus, reason: e.reason ?? null },
  };
}

export function fromDataSource(d: DataSource): AuditTimelineRow {
  return {
    id: `data_source:${d.id}`,
    source: "data_source",
    timestamp: d.createdAt.toISOString(),
    actorId: d.userId,
    summary: `Uploaded ${d.name} (${d.type}, ${d.recordCount} rows, status=${d.status})`,
    refType: "DataSource",
    refId: d.id,
    metadata: { type: d.type, status: d.status, recordCount: d.recordCount },
  };
}

export function fromDocument(d: Document): AuditTimelineRow {
  return {
    id: `document:${d.id}`,
    source: "document",
    timestamp: d.createdAt.toISOString(),
    actorId: d.userId,
    summary: `Generated ${d.type}: ${d.title}${d.period ? ` (period ${d.period})` : ""}`,
    refType: "Document",
    refId: d.id,
    metadata: { type: d.type, period: d.period ?? null },
  };
}

export function fromMatchRun(m: MatchRun): AuditTimelineRow {
  // Caller filters out runs where completedAt is null; we still guard.
  const ts = (m.completedAt ?? m.startedAt).toISOString();
  return {
    id: `match_run:${m.id}`,
    source: "match_run",
    timestamp: ts,
    actorId: m.userId,
    summary: `Match run for ${m.periodKey} — ${m.matched}/${m.totalGL + m.totalSub} matched, ${m.unmatched + m.partial} unmatched`,
    refType: "MatchRun",
    refId: m.id,
    metadata: {
      periodKey: m.periodKey,
      matched: m.matched, partial: m.partial, unmatched: m.unmatched,
      totalGL: m.totalGL, totalSub: m.totalSub,
    },
  };
}
