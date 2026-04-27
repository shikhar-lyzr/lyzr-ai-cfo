import { prisma } from "@/lib/db";
import {
  fromActionEvent, fromDecisionEvent, fromDataSource, fromDocument, fromMatchRun,
} from "./sources";
import type { AuditSource, AuditTimelineRow } from "./types";

export type AuditQueryArgs = {
  userId: string;
  sources?: AuditSource[];          // default: all five
  from?: Date;
  to?: Date;
  limit?: number;                   // default 200, max 1000
};

export type AuditQueryResult = {
  rows: AuditTimelineRow[];
  errors: Partial<Record<AuditSource, string>>;
};

const ALL: AuditSource[] = ["action", "decision", "data_source", "document", "match_run"];

async function safe<T>(fn: () => Promise<T>): Promise<{ ok: true; value: T } | { ok: false; error: string }> {
  try {
    return { ok: true, value: await fn() };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function queryAuditTrail(args: AuditQueryArgs): Promise<AuditQueryResult> {
  const { userId, from, to, limit = 200 } = args;
  const sources = args.sources && args.sources.length > 0 ? args.sources : ALL;
  const cap = Math.min(limit, 1000);
  const errors: Partial<Record<AuditSource, string>> = {};

  const dateFilter = (col: string) => {
    const f: Record<string, unknown> = {};
    if (from) f.gte = from;
    if (to) f.lte = to;
    return Object.keys(f).length === 0 ? {} : { [col]: f };
  };

  const tasks: Array<Promise<AuditTimelineRow[]>> = [];

  if (sources.includes("action")) {
    tasks.push((async () => {
      const r = await safe(() => prisma.actionEvent.findMany({
        where: { userId, ...dateFilter("createdAt") },
        orderBy: { createdAt: "desc" },
        take: cap,
        include: { action: { select: { headline: true } } },
      }));
      if (!r.ok) { errors.action = r.error; return []; }
      return r.value.map(fromActionEvent);
    })());
  }
  if (sources.includes("decision")) {
    tasks.push((async () => {
      const r = await safe(() => prisma.decisionEvent.findMany({
        where: { decision: { userId }, ...dateFilter("createdAt") },
        orderBy: { createdAt: "desc" },
        take: cap,
        include: { decision: { select: { headline: true } } },
      }));
      if (!r.ok) { errors.decision = r.error; return []; }
      return r.value.map(fromDecisionEvent);
    })());
  }
  if (sources.includes("data_source")) {
    tasks.push((async () => {
      const r = await safe(() => prisma.dataSource.findMany({
        where: { userId, ...dateFilter("createdAt") },
        orderBy: { createdAt: "desc" },
        take: cap,
      }));
      if (!r.ok) { errors.data_source = r.error; return []; }
      return r.value.map(fromDataSource);
    })());
  }
  if (sources.includes("document")) {
    tasks.push((async () => {
      const r = await safe(() => prisma.document.findMany({
        where: { userId, ...dateFilter("createdAt") },
        orderBy: { createdAt: "desc" },
        take: cap,
      }));
      if (!r.ok) { errors.document = r.error; return []; }
      return r.value.map(fromDocument);
    })());
  }
  if (sources.includes("match_run")) {
    tasks.push((async () => {
      const r = await safe(() => prisma.matchRun.findMany({
        where: { userId, completedAt: { not: null }, ...dateFilter("completedAt") },
        orderBy: { completedAt: "desc" },
        take: cap,
      }));
      if (!r.ok) { errors.match_run = r.error; return []; }
      return r.value.map(fromMatchRun);
    })());
  }

  const groups = await Promise.all(tasks);
  const merged = groups.flat();
  merged.sort((a, b) => (a.timestamp < b.timestamp ? 1 : a.timestamp > b.timestamp ? -1 : 0));

  return { rows: merged.slice(0, cap), errors };
}
