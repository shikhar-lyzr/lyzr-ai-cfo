"use client";

import { useState, useEffect, useRef } from "react";
import { Sun, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import type { Action } from "@/lib/types";

interface MorningBriefingProps {
  userId: string;
  actions: Action[];
  onComplete?: () => void;
}

export function MorningBriefing({ userId, actions, onComplete }: MorningBriefingProps) {
  const [briefing, setBriefing] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const hasFetched = useRef(false);

  useEffect(() => {
    if (userId && actions.length > 0 && !hasFetched.current && !isLoaded) {
      hasFetched.current = true;
      fetchBriefing();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, actions.length]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [briefing]);

  const fetchBriefing = async () => {
    setIsLoading(true);
    setError(null);
    setBriefing("");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          message:
            "Give me my morning briefing. Summarize my current financial position, list items needing attention by priority, and highlight anything that changed since last review. Be concise and executive-level.",
        }),
      });

      if (!res.ok || !res.body) {
        setError("Failed to generate briefing");
        setIsLoading(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let content = "";

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
              setBriefing(content);
            }
          } catch {
            // skip malformed SSE lines
          }
        }
      }

      setIsLoaded(true);
      onComplete?.();
    } catch {
      setError("Connection failed. Try refreshing.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = () => {
    hasFetched.current = false;
    setIsLoaded(false);
    fetchBriefing();
  };

  if (actions.length === 0) return null;

  return (
    <div className="rounded-xl overflow-hidden" style={{
      background: "linear-gradient(135deg, #FFF9F0 0%, #FFF5E6 50%, #FEF3E0 100%)",
      border: "1px solid #E8D5B8",
      boxShadow: "0 2px 12px rgba(139, 105, 20, 0.08), 0 1px 3px rgba(0,0,0,0.04)",
    }}>
      {/* Accent top bar */}
      <div style={{
        height: "3px",
        background: "linear-gradient(90deg, #D4A024, #B8860B, #D4A024)",
      }} />

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{
            background: "linear-gradient(135deg, #F59E0B, #D97706)",
            boxShadow: "0 2px 6px rgba(245, 158, 11, 0.35)",
          }}>
            <Sun className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-bold" style={{ color: "#5C4A1E" }}>
              Morning Briefing
            </h2>
            <p className="text-[10px]" style={{ color: "#8B7355" }}>
              {isLoading
                ? "Generating executive summary..."
                : isLoaded
                ? `Updated ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                : "Preparing..."}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-0.5">
          {isLoaded && (
            <button
              onClick={handleRefresh}
              disabled={isLoading}
              className="p-1.5 rounded-md transition-colors disabled:opacity-40"
              style={{ color: "#8B7355" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(139, 105, 20, 0.08)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              title="Refresh briefing"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            </button>
          )}
          {(isLoaded || briefing) && (
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="p-1.5 rounded-md transition-colors"
              style={{ color: "#8B7355" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(139, 105, 20, 0.08)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              {isCollapsed ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronUp className="w-3.5 h-3.5" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {!isCollapsed && (
        <div
          ref={scrollRef}
          className="overflow-y-auto"
          style={{ maxHeight: "280px" }}
        >
          {isLoading && !briefing && (
            <div className="flex items-center justify-center py-6 gap-2.5">
              <div className="w-5 h-5 rounded-full animate-spin" style={{
                border: "2px solid #E8D5B8",
                borderTopColor: "#D4A024",
              }} />
              <span className="text-xs" style={{ color: "#8B7355" }}>
                AI is preparing your briefing...
              </span>
            </div>
          )}

          {error && (
            <div className="mx-4 mb-3 px-3 py-2 rounded-lg text-xs" style={{
              background: "rgba(239, 68, 68, 0.08)",
              color: "#DC2626",
              border: "1px solid rgba(239, 68, 68, 0.15)",
            }}>
              {error}
            </div>
          )}

          {briefing && (
            <div
              className="px-4 pb-4 text-[13px] leading-relaxed whitespace-pre-wrap"
              style={{ color: "#3D3420" }}
            >
              {briefing}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
