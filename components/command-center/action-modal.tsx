"use client";

import React, { useEffect, useState } from "react";
import { X, Copy, Clock, AlertTriangle, MessageSquare } from "lucide-react";
import { PriorityBadge } from "@/components/shared/priority-badge";
import type { Action } from "@/lib/types";
import { useRouter } from "next/navigation";

interface ActionModalProps {
  action: Action | null;
  onClose: () => void;
  onAction: (id: string, op: string) => Promise<void> | void;
}

export function ActionModal({ action, onClose, onAction }: ActionModalProps) {
  const router = useRouter();
  const [draftBody, setDraftBody] = useState<string | null>(null);
  const [loadingDraft, setLoadingDraft] = useState(false);
  const [events, setEvents] = useState<Array<{ id: string; fromStatus: string; toStatus: string; createdAt: string }>>([]);

  useEffect(() => {
    if (!action) return;
    setDraftBody(null);
    setEvents([]);

    // Lazy-load draft
    (async () => {
      try {
        setLoadingDraft(true);
        const res = await fetch(`/api/actions/${action.id}/ar`);
        if (res.ok) {
          const data = await res.json();
          if (data?.draftBody) setDraftBody(data.draftBody);
        }
      } catch (err) {
        // ignore
      } finally {
        setLoadingDraft(false);
      }
    })();

    // Audit events
    (async () => {
      try {
        const res = await fetch(`/api/actions/${action.id}/events`);
        if (res.ok) {
          const data = await res.json();
          if (data?.events) setEvents(data.events);
        }
      } catch (err) {
        // ignore
      }
    })();
  }, [action]);

  if (!action) return null;

  const handleCopyAndMark = async () => {
    if (draftBody) {
      await navigator.clipboard.writeText(draftBody);
    } else {
      // try fetch again
      try {
        const res = await fetch(`/api/actions/${action.id}/ar`);
        if (res.ok) {
          const data = await res.json();
          if (data?.draftBody) {
            setDraftBody(data.draftBody);
            await navigator.clipboard.writeText(data.draftBody);
          }
        }
      } catch (err) {
        // ignore
      }
    }

    await onAction(action.id, "mark_sent");
  };

  const handleSnooze = async () => {
    await onAction(action.id, "snooze");
  };

  const handleEscalate = async () => {
    await onAction(action.id, "escalate");
  };

  const handleAskAI = () => {
    onClose();
    // hand off to the agent console with a prefilled message
    const msg = `Please draft a helpful follow-up for: ${action.headline}\n\nDetails: ${action.detail}`;
    router.push(`/agent-console?message=${encodeURIComponent(msg)}`);
  };

  return (
    <div className="fixed inset-0 z-50">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <aside className="fixed right-0 top-0 h-full w-full md:w-[520px] bg-background border-l border-border shadow-lg overflow-auto">
        <div className="p-4 flex items-start justify-between border-b border-border">
          <div className="flex items-center gap-3">
            <PriorityBadge priority={action.severity === "critical" ? "critical" : action.severity === "warning" ? "high" : "medium"} />
            <div>
              <h3 className="text-lg font-semibold text-foreground">{action.headline}</h3>
              <div className="text-xs text-muted-foreground mt-1">{action.sourceName ?? action.driver}</div>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-muted-foreground">{action.detail}</p>

          <div>
            <h4 className="text-xs font-medium text-muted-foreground">Draft</h4>
            <div className="mt-2 p-3 rounded-md bg-card border border-border">
              {loadingDraft ? (
                <div className="text-xs text-muted-foreground">Loading draft…</div>
              ) : draftBody ? (
                <pre className="whitespace-pre-wrap text-sm text-foreground">{draftBody}</pre>
              ) : (
                <div className="text-xs text-muted-foreground">No draft available</div>
              )}
            </div>
          </div>

          <div>
            <h4 className="text-xs font-medium text-muted-foreground">History</h4>
            <div className="mt-2 text-xs text-muted-foreground">
              {events.length === 0 ? (
                <div>No events</div>
              ) : (
                <ul className="space-y-2">
                  {events.map((ev) => (
                    <li key={ev.id} className="flex items-center justify-between">
                      <div>
                        <div className="text-[13px]">{ev.fromStatus} → {ev.toStatus}</div>
                        <div className="text-[11px] text-muted-foreground">{new Date(ev.createdAt).toLocaleString()}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-border sticky bottom-0 bg-background">
          <div className="flex gap-3">
            <button onClick={handleCopyAndMark} className="flex-1 px-3 py-2 rounded-md bg-success text-white text-sm font-medium flex items-center justify-center gap-2">
              <Copy size={14} />
              Copy & Mark Sent
            </button>
            <button onClick={handleSnooze} className="px-3 py-2 rounded-md border border-border text-sm"> <Clock size={14} /> Snooze</button>
            <button onClick={handleEscalate} className="px-3 py-2 rounded-md border border-warning text-warning text-sm flex items-center gap-2"> <AlertTriangle size={14} /> Escalate</button>
            <button onClick={handleAskAI} className="px-3 py-2 rounded-md bg-primary text-primary-foreground text-sm flex items-center gap-2"> <MessageSquare size={14} /> Ask AI</button>
          </div>
        </div>
      </aside>
    </div>
  );
}
