"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { LayoutDashboard, Database, Settings } from "lucide-react";
import { clsx } from "clsx";

const navItems = [
  { href: "/", label: "Home", icon: LayoutDashboard },
  { href: "/data-sources", label: "Data Sources", icon: Database },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const [user, setUser] = useState<{ name: string; email: string; credits: number } | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.userId) {
          setUser({
            name: data.name || data.email.split("@")[0],
            email: data.email,
            credits: data.credits ?? 0,
          });
        }
      });
  }, []);

  const initials = user
    ? user.name
        .split(" ")
        .map((w) => w[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "..";

  return (
    <aside className="flex flex-col w-56 h-screen bg-bg-sidebar border-r border-border shrink-0">
      <div className="flex items-center gap-2 px-5 py-5 border-b border-border">
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="16" cy="16" r="16" fill="#8B6914"/>
          <path d="M10 10L16 16L22 10M10 22L16 16L22 22" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <span className="text-lg font-semibold text-text-primary">AI CFO</span>
      </div>

      <nav className="flex flex-col gap-1 p-3 flex-1">
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "flex items-center gap-3 px-3 py-2.5 rounded-btn text-sm font-medium transition-colors",
                isActive
                  ? "bg-accent-primary text-white"
                  : "text-text-secondary hover:bg-border/40 hover:text-text-primary"
              )}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-border">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-8 h-8 rounded-full bg-border flex items-center justify-center">
            <span className="text-xs font-medium text-text-secondary">{initials}</span>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-medium text-text-primary truncate">
              {user?.name ?? "Loading..."}
            </span>
            <span className="text-xs text-text-secondary">
              {user ? `${user.credits.toLocaleString()} credits` : ""}
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}
