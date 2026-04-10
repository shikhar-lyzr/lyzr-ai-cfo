import { describe, it, expect } from "vitest";
import { inferToneFromInvoice, buildDunningEmailBody } from "@/lib/agent/tools";

describe("inferToneFromInvoice", () => {
  it("returns 'friendly' for invoices 1-14 days overdue", () => {
    const dueDate = new Date(Date.now() - 7 * 86400000);
    expect(inferToneFromInvoice(dueDate)).toBe("friendly");
  });

  it("returns 'friendly' for exactly 1 day overdue", () => {
    const dueDate = new Date(Date.now() - 1 * 86400000);
    expect(inferToneFromInvoice(dueDate)).toBe("friendly");
  });

  it("returns 'firm' for invoices 15-44 days overdue", () => {
    const dueDate = new Date(Date.now() - 20 * 86400000);
    expect(inferToneFromInvoice(dueDate)).toBe("firm");
  });

  it("returns 'firm' for exactly 15 days overdue", () => {
    const dueDate = new Date(Date.now() - 15 * 86400000);
    expect(inferToneFromInvoice(dueDate)).toBe("firm");
  });

  it("returns 'escalation' for invoices 45+ days overdue", () => {
    const dueDate = new Date(Date.now() - 60 * 86400000);
    expect(inferToneFromInvoice(dueDate)).toBe("escalation");
  });

  it("returns 'escalation' for exactly 45 days overdue", () => {
    const dueDate = new Date(Date.now() - 45 * 86400000);
    expect(inferToneFromInvoice(dueDate)).toBe("escalation");
  });

  it("returns 'friendly' for invoices not yet overdue", () => {
    const dueDate = new Date(Date.now() + 5 * 86400000); // future
    expect(inferToneFromInvoice(dueDate)).toBe("friendly");
  });
});

describe("buildDunningEmailBody", () => {
  const baseInvoice = {
    invoiceNumber: "INV-1001",
    customer: "Acme Corp",
    customerEmail: "billing@acme.com",
    amount: 12500,
    dueDate: new Date(Date.now() - 10 * 86400000),
  };

  it("builds a friendly email", () => {
    const body = buildDunningEmailBody(baseInvoice, "friendly");
    expect(body).toContain("Friendly Reminder");
    expect(body).toContain("INV-1001");
    expect(body).toContain("billing@acme.com");
    expect(body).toContain("Acme Corp");
    expect(body).toContain("$12.5K");
  });

  it("builds a firm email", () => {
    const body = buildDunningEmailBody(baseInvoice, "firm");
    expect(body).toContain("Payment Overdue");
    expect(body).toContain("INV-1001");
    expect(body).toContain("immediate attention");
  });

  it("builds an escalation email", () => {
    const body = buildDunningEmailBody(baseInvoice, "escalation");
    expect(body).toContain("URGENT");
    expect(body).toContain("INV-1001");
    expect(body).toContain("5 business days");
  });

  it("handles missing customerEmail gracefully", () => {
    const invoice = { ...baseInvoice, customerEmail: null };
    const body = buildDunningEmailBody(invoice, "friendly");
    expect(body).toContain("the customer");
    expect(body).not.toContain("null");
  });

  it("formats amount in $X.XK format", () => {
    const body = buildDunningEmailBody(baseInvoice, "friendly");
    expect(body).toContain("$12.5K");
  });

  it("includes days overdue count", () => {
    const body = buildDunningEmailBody(baseInvoice, "friendly");
    expect(body).toMatch(/\d+ days ago/);
  });
});
