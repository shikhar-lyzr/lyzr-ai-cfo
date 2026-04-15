"use client";

import { useState } from "react";
import { Bot, User, FileText, AlertTriangle } from "lucide-react";
import { SampleDataBadge } from "@/components/shared/sample-data-badge";

type EventType = "agent_action" | "user_decision" | "system_event" | "guardrail_trigger";

interface AuditEvent {
  id: string;
  type: EventType;
  actor: string;
  journey: string;
  action: string;
  details: string;
  timestamp: string;
}

const SAMPLE_AUDIT_EVENTS: AuditEvent[] = [
  {
    id: "AE-1247",
    type: "agent_action",
    actor: "CFO Office Agent",
    journey: "Financial Reconciliation",
    action: "Started reconciliation analysis",
    details: "Loaded 6 data files — 4,328 transactions ingested",
    timestamp: "Today 08:42:15",
  },
  {
    id: "AE-1246",
    type: "agent_action",
    actor: "CFO Office Agent",
    journey: "Financial Reconciliation",
    action: "Auto-matched 4,105 transactions",
    details: "94.85% match rate — 223 exceptions surfaced",
    timestamp: "Today 08:42:18",
  },
  {
    id: "AE-1245",
    type: "guardrail_trigger",
    actor: "System",
    journey: "Financial Reconciliation",
    action: "Flagged 8 genuine errors",
    details: "¥47.2M exposure — routed to Decision Inbox",
    timestamp: "Today 08:42:22",
  },
  {
    id: "AE-1244",
    type: "agent_action",
    actor: "Monthly Close Orchestrator",
    journey: "Monthly Close",
    action: "Step 3 journal entries review",
    details: "42 of 56 entries approved by controller",
    timestamp: "Today 08:15:02",
  },
  {
    id: "AE-1243",
    type: "system_event",
    actor: "System",
    journey: "Agent Configuration",
    action: "Daily agent heartbeat",
    details: "All agents online and responding",
    timestamp: "Today 08:00:00",
  },
  {
    id: "AE-1242",
    type: "agent_action",
    actor: "AP Automation Agent",
    journey: "Accounts Payable",
    action: "Processed 14 invoices",
    details: "2 duplicates flagged for review",
    timestamp: "Yesterday 19:22",
  },
  {
    id: "AE-1241",
    type: "user_decision",
    actor: "shikhar@lyzr.ai",
    journey: "Monthly Close",
    action: "Approved ¥52.3M IC elimination",
    details: "Via Decision Inbox — DI-001",
    timestamp: "Yesterday 18:40",
  },
  {
    id: "AE-1240",
    type: "guardrail_trigger",
    actor: "System",
    journey: "Daily Liquidity",
    action: "Hedge ratio below threshold",
    details: "58% < 60% policy minimum — escalated to CFO",
    timestamp: "Yesterday 18:20",
  },
  {
    id: "AE-1239",
    type: "user_decision",
    actor: "vidur@lyzr.ai",
    journey: "Monthly Close",
    action: "Approved FX hedge rollover",
    details: "GBP/JPY forward — GBP 45M — via Decision Inbox",
    timestamp: "Yesterday 18:15",
  },
  {
    id: "AE-1238",
    type: "system_event",
    actor: "System",
    journey: "Agent Configuration",
    action: "RULES.md updated",
    details: "Added threshold: regulatory filings require CFO sign-off",
    timestamp: "Yesterday 14:30",
  },
];

interface EventIconProps {
  type: EventType;
}

function EventIcon({ type }: EventIconProps) {
  const iconProps = { size: 20, className: "relative z-10" };

  switch (type) {
    case "agent_action":
      return (
        <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center border border-amber-200">
          <Bot {...iconProps} className="text-amber-700" />
        </div>
      );
    case "user_decision":
      return (
        <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center border border-blue-200">
          <User {...iconProps} className="text-blue-700" />
        </div>
      );
    case "system_event":
      return (
        <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center border border-gray-200">
          <FileText {...iconProps} className="text-gray-600" />
        </div>
      );
    case "guardrail_trigger":
      return (
        <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center border border-amber-200">
          <AlertTriangle {...iconProps} className="text-amber-700" />
        </div>
      );
    default:
      return null;
  }
}

export default function AuditTrailPage() {
  const [, setEventTypeFilter] = useState<EventType | "">("");
  const [, setJourneyFilter] = useState("");
  const [, setActorFilter] = useState("");
  const [, setTimeRangeFilter] = useState("");

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-4">
          <h1
            className="text-[28px] font-bold text-foreground"
            style={{ fontFamily: "var(--font-playfair)" }}
          >
            Audit Trail
          </h1>
          <SampleDataBadge />
        </div>
        <p className="text-sm text-muted-foreground">
          Immutable log of every agent action, decision, and system event
        </p>
      </div>

      {/* Action Bar */}
      <div className="flex items-center justify-between">
        {/* Filter Dropdowns */}
        <div className="flex gap-3">
          <select
            onChange={(e) => setEventTypeFilter(e.target.value as EventType | "")}
            className="px-3 py-2 bg-card border border-border rounded text-sm text-foreground hover:border-primary focus:outline-none focus:border-primary cursor-pointer"
          >
            <option value="">Event Type</option>
            <option value="agent_action">Agent Action</option>
            <option value="user_decision">User Decision</option>
            <option value="system_event">System Event</option>
            <option value="guardrail_trigger">Guardrail Trigger</option>
          </select>

          <select
            onChange={(e) => setJourneyFilter(e.target.value)}
            className="px-3 py-2 bg-card border border-border rounded text-sm text-foreground hover:border-primary focus:outline-none focus:border-primary cursor-pointer"
          >
            <option value="">Journey</option>
            <option value="financial-reconciliation">Financial Reconciliation</option>
            <option value="monthly-close">Monthly Close</option>
            <option value="accounts-payable">Accounts Payable</option>
            <option value="daily-liquidity">Daily Liquidity</option>
            <option value="agent-configuration">Agent Configuration</option>
          </select>

          <select
            onChange={(e) => setActorFilter(e.target.value)}
            className="px-3 py-2 bg-card border border-border rounded text-sm text-foreground hover:border-primary focus:outline-none focus:border-primary cursor-pointer"
          >
            <option value="">Actor</option>
            <option value="cfo-office">CFO Office Agent</option>
            <option value="system">System</option>
            <option value="user">User</option>
            <option value="ap-automation">AP Automation Agent</option>
          </select>

          <select
            onChange={(e) => setTimeRangeFilter(e.target.value)}
            className="px-3 py-2 bg-card border border-border rounded text-sm text-foreground hover:border-primary focus:outline-none focus:border-primary cursor-pointer"
          >
            <option value="">Time Range</option>
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="all">All Time</option>
          </select>
        </div>

        {/* Export Button */}
        <button
          disabled
          className="px-4 py-2 bg-card border border-border rounded text-sm font-medium text-muted-foreground cursor-not-allowed opacity-50 hover:opacity-50"
        >
          Export Log
        </button>
      </div>

      {/* Timeline */}
      <div className="space-y-6">
        {/* Vertical line container */}
        <div className="relative pl-6">
          {/* Left vertical line */}
          <div className="absolute left-[7px] top-0 bottom-0 w-px bg-border" />

          {/* Events */}
          <div className="space-y-6">
            {SAMPLE_AUDIT_EVENTS.map((event) => (
              <div key={event.id} className="flex gap-4">
                {/* Icon on the line */}
                <div className="flex-shrink-0">
                  <EventIcon type={event.type} />
                </div>

                {/* Content card */}
                <div className="flex-1 bg-card border border-border rounded-[var(--radius)] p-4 space-y-2">
                  <div className="flex items-baseline justify-between">
                    <p className="text-sm font-semibold text-foreground">{event.actor}</p>
                    <p className="text-xs text-muted-foreground text-right">{event.timestamp}</p>
                  </div>

                  <p className="text-sm text-foreground">{event.action}</p>

                  <p className="text-xs text-muted-foreground">{event.details}</p>

                  {/* Journey tag */}
                  <div className="pt-2 flex gap-2">
                    <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                      {event.journey}
                    </span>
                    <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                      {event.id}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
