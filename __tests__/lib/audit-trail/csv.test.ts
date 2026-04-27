import { describe, it, expect } from "vitest";
import { toCsv } from "@/lib/audit-trail/csv";
import type { AuditTimelineRow } from "@/lib/audit-trail/types";

const row = (id: string, source: AuditTimelineRow["source"], summary: string): AuditTimelineRow => ({
  id, source,
  timestamp: "2026-04-15T10:30:00.000Z",
  actorId: "u1",
  summary,
  refType: "X",
  refId: "ref",
  metadata: {},
});

describe("toCsv", () => {
  it("emits header then a row per input", () => {
    const out = toCsv([row("a", "action", "hello")]);
    const lines = out.trim().split("\n");
    expect(lines[0]).toBe("timestamp,source,actorId,summary,refType,refId");
    expect(lines[1]).toBe("2026-04-15T10:30:00.000Z,action,u1,hello,X,ref");
  });

  it("quotes summaries containing commas, quotes, or newlines", () => {
    const out = toCsv([row("a", "action", `with, "quote" and\nnewline`)]);
    expect(out).toContain('"with, ""quote"" and\nnewline"');
  });

  it("actorId is always included in output", () => {
    const r = row("a", "data_source", "x");
    const out = toCsv([r]);
    expect(out.split("\n")[1]).toBe("2026-04-15T10:30:00.000Z,data_source,u1,x,X,ref");
  });

  it("prepends warnings comment lines when given", () => {
    const out = toCsv([row("a", "action", "x")], { warnings: ["match_run failed: timeout"] });
    expect(out.split("\n")[0]).toBe("# warnings: match_run failed: timeout");
    expect(out.split("\n")[1]).toBe("timestamp,source,actorId,summary,refType,refId");
  });
});
