"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import type { NavItem as NavItemType } from "@/lib/config/journeys";

export function NavItem({ item }: { item: NavItemType }) {
  const pathname = usePathname();
  const isActive = item.path === "/"
    ? pathname === "/"
    : pathname.startsWith(item.path);

  return (
    <Link
      href={item.path}
      className={clsx(
        "flex items-center gap-3 px-3 py-2 rounded-[var(--radius)] text-sm transition-colors",
        isActive
          ? "bg-[hsl(25_62%_25%/0.08)] text-[hsl(25,62%,25%)] font-medium"
          : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
      )}
    >
      <item.icon size={18} />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}
