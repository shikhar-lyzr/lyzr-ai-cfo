"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { LogOut } from "lucide-react";
import { NavItem } from "./nav-item";
import { AgentStatusBar } from "./agent-status-bar";
import { NAV_HOME, JOURNEYS, BUILD_NAV, OBSERVE_NAV, UTILITY_NAV } from "@/lib/config/journeys";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 pt-4 pb-1 text-[11px] uppercase tracking-[0.08em] font-medium text-muted-foreground">
      {children}
    </div>
  );
}

export function Sidebar() {
  const router = useRouter();
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.userId) {
          setUser({ name: data.name || data.email.split("@")[0], email: data.email });
        }
      });
  }, []);

  const handleSignOut = async () => {
    await fetch("/api/auth", { method: "DELETE" });
    router.push("/login");
    router.refresh();
  };

  return (
    <aside className="flex flex-col w-[220px] h-screen glass-sidebar border-r border-border shrink-0">
      {/* Brand header */}
      <div className="px-4 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <img
            src="https://cdn2.futurepedia.io/2026-02-26T19-07-25.498Z-q6ZO1hg4Romi6JbT7L06v7dv3Sy2zIBis.png?w=256"
            alt="Lyzr"
            className="w-8 h-8 rounded"
          />
          <div className="min-w-0">
            <div className="text-sm font-semibold text-foreground truncate" style={{ fontFamily: "var(--font-playfair)" }}>
              CFO&apos;s Office
            </div>
            <div className="text-[10px] text-muted-foreground">AgenticOS</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-1">
        <div className="flex flex-col gap-0.5">
          <NavItem item={NAV_HOME} />
        </div>

        <SectionLabel>Domain Journeys</SectionLabel>
        <div className="flex flex-col gap-0.5">
          {JOURNEYS.map((item) => (
            <NavItem key={item.id} item={item} />
          ))}
        </div>

        <SectionLabel>Build</SectionLabel>
        <div className="flex flex-col gap-0.5">
          {BUILD_NAV.map((item) => (
            <NavItem key={item.id} item={item} />
          ))}
        </div>

        <SectionLabel>Observe</SectionLabel>
        <div className="flex flex-col gap-0.5">
          {OBSERVE_NAV.map((item) => (
            <NavItem key={item.id} item={item} />
          ))}
        </div>

        <SectionLabel>Utility</SectionLabel>
        <div className="flex flex-col gap-0.5">
          {UTILITY_NAV.map((item) => (
            <NavItem key={item.id} item={item} />
          ))}
        </div>
      </nav>

      {/* User + sign out */}
      {user && (
        <div className="px-3 py-2 border-t border-border flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <span className="text-[10px] font-medium text-primary">
              {user.name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)}
            </span>
          </div>
          <span className="text-xs text-foreground truncate flex-1">{user.name}</span>
          <button
            onClick={handleSignOut}
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
          >
            <LogOut size={14} />
          </button>
        </div>
      )}

      <AgentStatusBar />
    </aside>
  );
}
