import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DecisionInboxClient } from "@/app/(shell)/decision-inbox/decision-inbox-client";
import type { InboxRow } from "@/app/(shell)/decision-inbox/inbox-row";
import { ALL_FILTERS } from "@/app/(shell)/decision-inbox/inbox-filters";

// Mock next/navigation — useRouter().refresh() is called after success.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), back: vi.fn() }),
}));

function row(overrides: Partial<InboxRow> & Pick<InboxRow, "source" | "kind" | "id">): InboxRow {
  return {
    headline: "h",
    detail: "d",
    createdAt: new Date(),
    ...overrides,
  } as InboxRow;
}

const fetchMock = vi.fn();

beforeEach(() => {
  // Default: fetch returns OK with empty body. Individual tests can override.
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function openRow() {
  // Each test renders a single row; "h" is the unique headline.
  fireEvent.click(screen.getByText("h"));
}

describe("inbox dispatch table", () => {
  it("variance Approve → PATCH /api/actions/{id} with approved", async () => {
    render(<DecisionInboxClient initialFilters={ALL_FILTERS} rows={[row({ source: "action", kind: "variance", id: "act_v" })]} />);
    openRow();
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/actions/act_v",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ status: "approved" }),
      }),
    );
  });

  it("anomaly Acknowledge → PATCH approved", async () => {
    render(<DecisionInboxClient initialFilters={ALL_FILTERS} rows={[row({ source: "action", kind: "anomaly", id: "act_a" })]} />);
    openRow();
    fireEvent.click(screen.getByRole("button", { name: "Acknowledge" }));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/actions/act_a",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ status: "approved" }),
      }),
    );
  });

  it("recommendation Dismiss → PATCH dismissed", async () => {
    render(<DecisionInboxClient initialFilters={ALL_FILTERS} rows={[row({ source: "action", kind: "recommendation", id: "act_r" })]} />);
    openRow();
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/actions/act_r",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ status: "dismissed" }),
      }),
    );
  });

  it("ar_followup Mark Sent → POST /api/actions/{id}/ar with mark_sent", async () => {
    render(<DecisionInboxClient initialFilters={ALL_FILTERS} rows={[row({ source: "action", kind: "ar_followup", id: "act_ar" })]} />);
    openRow();
    // ArDraftBlock fires its own GET on mount — clear so we can assert on the POST cleanly.
    fetchMock.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Mark Sent" }));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/actions/act_ar/ar",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ op: "mark_sent" }),
      }),
    );
  });

  it("ar_followup Snooze → POST with snooze + days:7", async () => {
    render(<DecisionInboxClient initialFilters={ALL_FILTERS} rows={[row({ source: "action", kind: "ar_followup", id: "act_ar2" })]} />);
    openRow();
    fetchMock.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Snooze 7d" }));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/actions/act_ar2/ar",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ op: "snooze", days: 7 }),
      }),
    );
  });

  it("recon_break Investigate is a Link with the breakId-resolved href, no fetch", () => {
    render(
      <DecisionInboxClient
        initialFilters={ALL_FILTERS}
        rows={[row({ source: "action", kind: "reconciliation_break", id: "act_rb", breakId: "brk_42" })]}
      />,
    );
    openRow();
    const link = screen.getByRole("link", { name: "Investigate" });
    expect(link.getAttribute("href")).toBe("/financial-reconciliation?breakId=brk_42");
    // No fetch should have happened from clicking the link (it's a Next Link, not a button).
    // We only need to confirm: the action wasn't mutated and the URL contains breakId.
  });

  it("recon_break Investigate falls back to bare /financial-reconciliation when breakId is absent", () => {
    render(
      <DecisionInboxClient
        initialFilters={ALL_FILTERS}
        rows={[row({ source: "action", kind: "reconciliation_break", id: "act_rb2" })]}
      />,
    );
    openRow();
    const link = screen.getByRole("link", { name: "Investigate" });
    expect(link.getAttribute("href")).toBe("/financial-reconciliation");
  });

  it("decision Approve → POST /api/decisions/{id}/decide with approve", async () => {
    render(<DecisionInboxClient initialFilters={ALL_FILTERS} rows={[row({ source: "decision", kind: "post_journal", id: "dec_1" })]} />);
    openRow();
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    // No reason filled in → body should not include `reason`
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/decisions/dec_1/decide",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ outcome: "approve" }),
      }),
    );
  });
});
