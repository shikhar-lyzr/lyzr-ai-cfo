"use client";

import { useState, useEffect } from "react";
import { BookOpen, FileText, Shield, ChevronDown, ChevronRight } from "lucide-react";

interface ContextData {
  skills: string[];
  dataFiles: string[];
  guardrails: string[];
}

function CollapsibleSection({ icon: Icon, title, items, defaultOpen = true }: {
  icon: typeof BookOpen;
  title: string;
  items: string[];
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [showAll, setShowAll] = useState(false);
  const visibleItems = showAll ? items : items.slice(0, 4);
  const remaining = items.length - 4;

  return (
    <div className="py-3 border-b border-border last:border-b-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full text-left"
      >
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <Icon size={14} className="text-muted-foreground" />
        <span className="text-xs font-medium text-foreground flex-1">{title}</span>
        <span className="text-[10px] bg-primary/10 text-primary rounded-full px-1.5 py-0.5 font-semibold">
          {items.length}
        </span>
      </button>
      {open && (
        <div className="mt-2 ml-6 flex flex-col gap-1">
          {visibleItems.map((item) => (
            <div key={item} className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="w-1.5 h-1.5 rounded-full bg-success shrink-0" />
              <span className="truncate">{item}</span>
            </div>
          ))}
          {remaining > 0 && !showAll && (
            <button
              onClick={() => setShowAll(true)}
              className="text-xs text-primary hover:underline mt-0.5"
            >
              Show {remaining} more
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function AgentContextPanel() {
  const [data, setData] = useState<ContextData>({ skills: [], dataFiles: [], guardrails: [] });

  useEffect(() => {
    fetch("/api/agent/context")
      .then((r) => r.ok ? r.json() : { skills: [], dataFiles: [], guardrails: [] })
      .then(setData);
  }, []);

  return (
    <div className="w-[280px] shrink-0 border-l border-border h-full overflow-y-auto px-3 py-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
        Agent Context
      </h3>
      <CollapsibleSection icon={BookOpen} title="Active Skills" items={data.skills} />
      <CollapsibleSection icon={FileText} title="Data Files" items={data.dataFiles} />
      <CollapsibleSection icon={Shield} title="Compliance Guardrails" items={data.guardrails} />
    </div>
  );
}
