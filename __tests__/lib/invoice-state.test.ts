import { describe, it, expect } from "vitest";

/**
 * Invoice state transition matrix — pure logic, no DB.
 *
 * Legal transitions (from § 7.1 of the design spec):
 *   open → sent, snoozed, escalated
 *   sent → open (re-dunning after 14d cooldown — handled by scan, not by explicit transition)
 *   snoozed → open (after snoozedUntil passes — handled by scan)
 *   escalated → (terminal for V1.5)
 *   paid → (terminal for V1.5)
 *
 * The AR API route only processes: open→sent (mark_sent), open→snoozed (snooze), open→escalated (escalate)
 * "sent→open" and "snoozed→open" are implicit via scan_ar_aging (time-based), not explicit transitions.
 */

type InvoiceStatus = "open" | "sent" | "snoozed" | "escalated" | "paid";
type ArOp = "mark_sent" | "snooze" | "escalate";

const TRANSITIONS: Record<ArOp, { from: InvoiceStatus[]; to: InvoiceStatus }> = {
  mark_sent: { from: ["open"], to: "sent" },
  snooze: { from: ["open"], to: "snoozed" },
  escalate: { from: ["open"], to: "escalated" },
};

function applyTransition(current: InvoiceStatus, op: ArOp): InvoiceStatus {
  const rule = TRANSITIONS[op];
  if (!rule.from.includes(current)) {
    throw new Error(`Invalid transition: cannot apply "${op}" to invoice in "${current}" state`);
  }
  return rule.to;
}

describe("Invoice state machine", () => {
  describe("legal transitions from 'open'", () => {
    it("mark_sent: open → sent", () => {
      expect(applyTransition("open", "mark_sent")).toBe("sent");
    });

    it("snooze: open → snoozed", () => {
      expect(applyTransition("open", "snooze")).toBe("snoozed");
    });

    it("escalate: open → escalated", () => {
      expect(applyTransition("open", "escalate")).toBe("escalated");
    });
  });

  describe("illegal transitions", () => {
    const terminalStates: InvoiceStatus[] = ["escalated", "paid"];
    const ops: ArOp[] = ["mark_sent", "snooze", "escalate"];

    for (const state of terminalStates) {
      for (const op of ops) {
        it(`rejects ${op} on ${state} (terminal)`, () => {
          expect(() => applyTransition(state, op)).toThrow("Invalid transition");
        });
      }
    }

    it("rejects mark_sent on 'sent'", () => {
      expect(() => applyTransition("sent", "mark_sent")).toThrow("Invalid transition");
    });

    it("rejects snooze on 'snoozed'", () => {
      expect(() => applyTransition("snoozed", "snooze")).toThrow("Invalid transition");
    });

    it("rejects escalate on 'sent'", () => {
      expect(() => applyTransition("sent", "escalate")).toThrow("Invalid transition");
    });
  });
});

describe("Action status mapping", () => {
  const ACTION_STATUS_MAP: Record<ArOp, string> = {
    mark_sent: "approved",
    snooze: "dismissed",
    escalate: "flagged",
  };

  it("mark_sent maps to approved", () => {
    expect(ACTION_STATUS_MAP.mark_sent).toBe("approved");
  });

  it("snooze maps to dismissed", () => {
    expect(ACTION_STATUS_MAP.snooze).toBe("dismissed");
  });

  it("escalate maps to flagged", () => {
    expect(ACTION_STATUS_MAP.escalate).toBe("flagged");
  });
});
