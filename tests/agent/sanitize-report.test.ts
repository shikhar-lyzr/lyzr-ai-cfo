import { describe, it, expect } from "vitest";
import { sanitizeReportBody } from "@/lib/agent/sanitize-report";

describe("sanitizeReportBody", () => {
  it("passes through a clean report that starts with a markdown heading", () => {
    const body = "# Monthly Close Package — 2026-Q1\n\n## Executive Summary\n\nScore: 62%.";
    expect(sanitizeReportBody(body)).toBe(body);
  });

  it("strips the 'has been generated and saved' preamble with artifact id reference", () => {
    const body =
      "The **2026-Q1 Monthly Close Package Report** has been generated and saved. You can refer to artifact ID `2711d04f-ef12-4660-ad5f-028f79a2d993` for the full markdown content.\n\n**The close is 55% complete and is currently 'Not Ready'.** This is due to 3 open reconciliation breaks...";
    const out = sanitizeReportBody(body);
    expect(out).not.toContain("artifact ID");
    expect(out).not.toContain("has been generated and saved");
    expect(out).toContain("55% complete");
  });

  it("strips a leading 'Here is the monthly close package report for ...:' sentence", () => {
    const body =
      "Here is the monthly close package report for **2026-Q1**:\n\n**Executive Summary:** Score 62%.";
    const out = sanitizeReportBody(body);
    expect(out.startsWith("**Executive Summary")).toBe(true);
  });

  it("returns the body unchanged when no known preamble pattern matches", () => {
    const body = "**Executive Summary:** Score 62%. No narration here.";
    expect(sanitizeReportBody(body)).toBe(body);
  });

  it("trims leading whitespace left after stripping", () => {
    const body = "The report has been generated and saved.\n\n\n# Real content";
    expect(sanitizeReportBody(body).startsWith("# Real content")).toBe(true);
  });

  it("only strips narration from the TOP, not mid-document", () => {
    const body =
      "# Report\n\nSee artifact ID 123 in the appendix. This report has been generated.";
    // Artifact-ID mention in body is legitimate context; only leading narration goes
    expect(sanitizeReportBody(body)).toBe(body);
  });
});
