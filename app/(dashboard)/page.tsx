"use client";

import { useState, useEffect, useCallback } from "react";
import { ResizableSplitPane } from "@/components/layout/resizable-split-pane";
import { ActionFeed } from "@/components/feed/action-feed";
import { ChatPanel } from "@/components/chat/chat-panel";
import { BudgetChart } from "@/components/dashboard/budget-chart";
import type { Action, ChatMessage } from "@/lib/types";

export default function DashboardHome() {
  const [actions, setActions] = useState<Action[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSeeding, setIsSeeding] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.userId) setUserId(data.userId);
      });
  }, []);

  const fetchActions = useCallback(async () => {
    if (!userId) return;
    const res = await fetch(`/api/actions?userId=${userId}&t=${Date.now()}`, {
      cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json();
      setActions(
        data.map((a: Record<string, unknown>) => ({
          ...a,
          createdAt: new Date(a.createdAt as string),
        }))
      );
    }
    setIsLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchActions();
  }, [fetchActions]);

  // Auto-load morning briefing as first chat message
  useEffect(() => {
    if (!userId) return;

    const cacheKey = `briefing_${userId}`;
    const cached = sessionStorage.getItem(cacheKey);

    if (cached) {
      setMessages([{
        id: "briefing_initial",
        userId,
        role: "agent",
        content: cached,
        timestamp: new Date(),
      }]);
      return;
    }

    // Stream briefing from chat API
    (async () => {
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId,
            message: "Give me my morning briefing. Summarize my current financial position, list items needing attention by priority, and highlight anything that changed since last review. Be concise and executive-level.",
          }),
        });

        if (!res.ok || !res.body) return;

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let content = "";
        const msgId = "briefing_initial";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const text = decoder.decode(value);
          const lines = text.split("\n").filter((l) => l.startsWith("data: "));

          for (const line of lines) {
            try {
              const json = JSON.parse(line.replace("data: ", ""));
              if (json.done) break;
              if (json.token) {
                content += json.token;
                setMessages((prev) => {
                  const existing = prev.find((m) => m.id === msgId);
                  if (existing) {
                    return prev.map((m) =>
                      m.id === msgId ? { ...m, content } : m
                    );
                  }
                  return [{
                    id: msgId,
                    userId,
                    role: "agent" as const,
                    content,
                    timestamp: new Date(),
                  }];
                });
              }
            } catch {
              // skip malformed SSE
            }
          }
        }

        if (content) {
          sessionStorage.setItem(cacheKey, content);
        }
      } catch {
        // Silent — briefing is non-critical
      }
    })();
  }, [userId]);

  // Poll for new actions for 60s after mount — catches background agent results
  useEffect(() => {
    if (!userId) return;
    let polls = 0;
    const maxPolls = 6;
    const id = setInterval(() => {
      polls++;
      fetchActions();
      if (polls >= maxPolls) clearInterval(id);
    }, 10_000);
    return () => clearInterval(id);
  }, [userId, fetchActions]);

  const handleFlag = async (id: string) => {
    if (!userId) return;
    const res = await fetch(`/api/actions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "flagged" }),
    });
    if (res.ok) {
      setActions((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: "flagged" } : a))
      );
    }
  };

  const handleDismiss = async (id: string) => {
    if (!userId) return;
    const res = await fetch(`/api/actions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "dismissed" }),
    });
    if (res.ok) {
      setActions((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: "dismissed" } : a))
      );
    }
  };

  const handleApprove = async (id: string) => {
    if (!userId) return;
    const res = await fetch(`/api/actions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "approved" }),
    });
    if (res.ok) {
      setActions((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: "approved" } : a))
      );
    }
  };

  const handleArOp = async (id: string, op: "mark_sent" | "snooze" | "escalate") => {
    if (!userId) return;
    const res = await fetch(`/api/actions/${id}/ar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ op }),
    });
    if (res.ok) {
      const statusMap = { mark_sent: "approved", snooze: "dismissed", escalate: "flagged" } as const;
      setActions((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: statusMap[op] } : a))
      );
    }
  };

  const handleAskAI = (actionId: string) => {
    const action = actions.find((a) => a.id === actionId);
    if (!action) return;
    handleSendMessage(`Tell me more about: ${action.headline}`, actionId);
  };

  const handleSendMessage = async (content: string, actionId?: string) => {
    if (!userId) return;

    const userMsg: ChatMessage = {
      id: `msg_${Date.now()}`,
      userId,
      role: "user",
      content,
      timestamp: new Date(),
      actionId,
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsStreaming(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          message: content,
          actionId,
        }),
      });

      if (!res.ok || !res.body) {
        setIsStreaming(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let agentContent = "";
      const agentMsgId = `msg_${Date.now() + 1}`;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value);
        const lines = text.split("\n").filter((l) => l.startsWith("data: "));

        for (const line of lines) {
          const json = JSON.parse(line.replace("data: ", ""));
          if (json.done) break;
          if (json.token) {
            agentContent += json.token;
            setMessages((prev) => {
              const existing = prev.find((m) => m.id === agentMsgId);
              if (existing) {
                return prev.map((m) =>
                  m.id === agentMsgId ? { ...m, content: agentContent } : m
                );
              }
              return [
                ...prev,
                {
                  id: agentMsgId,
                  userId,
                  role: "agent" as const,
                  content: agentContent,
                  timestamp: new Date(),
                },
              ];
            });
          }
        }
      }
    } catch (err) {
      console.error("Chat error:", err);
    } finally {
      setIsStreaming(false);
    }
  };

  const handleLoadSampleData = async () => {
    if (!userId) return;
    setIsSeeding(true);
    try {
      const res = await fetch("/api/seed-demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (res.ok) {
        await fetchActions();
      }
    } catch {
      // Silently fail — user can retry
    } finally {
      setIsSeeding(false);
    }
  };

  if (isLoading || !userId || isSeeding) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <div className="w-8 h-8 border-2 border-accent-primary border-t-transparent rounded-full animate-spin" />
        {isSeeding && (
          <p className="text-sm text-text-secondary w-64 text-center">
            AI is analyzing the demo dataset... This usually takes 10-15 seconds.
          </p>
        )}
      </div>
    );
  }

  if (actions.length === 0 && !isSeeding) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center max-w-md space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-accent-primary/10 flex items-center justify-center">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-accent-primary">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <polyline points="14,2 14,8 20,8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10,9 9,9 8,9" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-text-primary">No financial data yet</h2>
            <p className="text-sm text-text-secondary mt-1">
              Upload a CSV with budget vs actual figures, or try our sample dataset to see AI CFO in action.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <button
              onClick={handleLoadSampleData}
              disabled={isSeeding}
              className="px-5 py-2.5 rounded-btn bg-accent-primary text-white text-sm font-medium hover:bg-accent-hover disabled:opacity-60 transition-colors"
            >
              {isSeeding ? "Loading..." : "Try with Sample Data"}
            </button>
            <a
              href="/data-sources"
              className="px-5 py-2.5 rounded-btn border border-border text-text-primary text-sm font-medium hover:bg-border/30 transition-colors"
            >
              Upload Your Own CSV
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ResizableSplitPane
      left={
        <ActionFeed
          actions={actions}
          userId={userId}
          onFlag={handleFlag}
          onApprove={handleApprove}
          onAskAI={handleAskAI}
          onDismiss={handleDismiss}
          onArOp={handleArOp}
        />
      }
      right={
        <div className="flex flex-col h-full bg-slate-50/50 p-4 gap-4 border-l border-border/40">
          {/* Budget vs Actual Chart */}
          <div className="shrink-0 drop-shadow-sm">
            <BudgetChart />
          </div>

          {/* Chat Panel — briefing auto-loads + follow-up questions */}
          <div className="flex-1 min-h-0 rounded-xl border border-border/60 shadow-[0_2px_12px_rgba(0,0,0,0.02)] overflow-hidden">
            <ChatPanel
              messages={messages}
              onSend={(content) => handleSendMessage(content)}
              isStreaming={isStreaming}
            />
          </div>
        </div>
      }
    />
  );
}

