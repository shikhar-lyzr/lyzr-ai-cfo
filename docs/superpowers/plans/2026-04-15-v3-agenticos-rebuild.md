# V3 AgenticOS Full Rebuild — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Lyzr AI CFO app from a single-dashboard layout into a full AgenticOS platform with Command Center, Agent Console with pipeline visualization, 6 domain journey pages, and 9 Build + Observe sample-data shells.

**Architecture:** Full rebuild of the frontend inside a new `(shell)` route group. New design system (warm cream/brown, Playfair Display + DM Sans, glassmorphism). Keep all existing backend (Prisma, gitclaw agent, API routes, tools). Rewrite `/api/chat` SSE format to emit typed pipeline events. Sample data for Build and Observe pages.

**Tech Stack:** Next.js 16 (app router), React 19, Tailwind CSS 4, Prisma 6 (SQLite), gitclaw 1.3.3, framer-motion (new), d3 (new), lucide-react, react-markdown, recharts.

**Spec:** `docs/superpowers/specs/2026-04-15-v3-agenticos-rebuild-design.md`

---

## Phase 1: Design System + Shell Layout + Sidebar

### Task 1: Install new dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install framer-motion and d3**

```bash
npm install framer-motion d3 @types/d3
```

- [ ] **Step 2: Verify install**

```bash
node -e "require('framer-motion'); require('d3'); console.log('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "deps: add framer-motion and d3 for AgenticOS rebuild"
```

---

### Task 2: Replace globals.css with new design system

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Replace the entire globals.css**

```css
@import "tailwindcss";

@layer base {
  :root {
    /* ── Backgrounds ── */
    --background:           36 33% 94%;
    --card:                 36 30% 96%;
    --card-foreground:      25 40% 18%;
    --popover:              36 30% 96%;
    --popover-foreground:   25 40% 18%;

    /* ── Text ── */
    --foreground:           25 40% 18%;
    --muted:                30 20% 90%;
    --muted-foreground:     25 20% 45%;

    /* ── Primary (deep brown) ── */
    --primary:              25 62% 25%;
    --primary-foreground:   36 33% 94%;

    /* ── Secondary ── */
    --secondary:            30 15% 90%;
    --secondary-foreground: 25 40% 18%;

    /* ── Borders ── */
    --border:               30 15% 85%;
    --input:                30 15% 85%;
    --ring:                 25 62% 25%;

    /* ── Radius ── */
    --radius:               0.75rem;

    /* ── Semantic ── */
    --destructive:          0 84% 60%;
    --destructive-foreground: 0 0% 98%;
    --success:              142 71% 45%;
    --warning:              38 92% 50%;
    --info:                 217 91% 60%;

    /* ── Accent gradient ── */
    --accent-from:          25 62% 25%;
    --accent-to:            30 55% 45%;

    /* ── Fonts ── */
    --font-sans:  'DM Sans', system-ui, sans-serif;
    --font-serif: 'Playfair Display', Georgia, serif;
    --font-mono:  'JetBrains Mono', 'Fira Code', monospace;
  }

  body {
    background: hsl(36, 33%, 94%);
    background-image:
      linear-gradient(rgba(103, 63, 27, 0.03) 1px, transparent 1px),
      linear-gradient(90deg, rgba(103, 63, 27, 0.03) 1px, transparent 1px);
    background-size: 40px 40px;
    color: hsl(25, 40%, 18%);
    font-family: var(--font-sans);
  }
}

@theme inline {
  --color-background: hsl(var(--background));
  --color-foreground: hsl(var(--foreground));
  --color-card: hsl(var(--card));
  --color-card-foreground: hsl(var(--card-foreground));
  --color-popover: hsl(var(--popover));
  --color-popover-foreground: hsl(var(--popover-foreground));
  --color-primary: hsl(var(--primary));
  --color-primary-foreground: hsl(var(--primary-foreground));
  --color-secondary: hsl(var(--secondary));
  --color-secondary-foreground: hsl(var(--secondary-foreground));
  --color-muted: hsl(var(--muted));
  --color-muted-foreground: hsl(var(--muted-foreground));
  --color-border: hsl(var(--border));
  --color-input: hsl(var(--input));
  --color-ring: hsl(var(--ring));
  --color-destructive: hsl(var(--destructive));
  --color-destructive-foreground: hsl(var(--destructive-foreground));
  --color-success: hsl(var(--success));
  --color-warning: hsl(var(--warning));
  --color-info: hsl(var(--info));
  --font-sans: var(--font-sans);
  --font-serif: var(--font-serif);
  --font-mono: var(--font-mono);
  --radius-default: var(--radius);
}

/* ── Glassmorphism ── */
@layer utilities {
  .glass         { background: rgba(255, 252, 248, 0.55); backdrop-filter: blur(20px); }
  .glass-strong  { background: rgba(255, 252, 248, 0.72); backdrop-filter: blur(24px); }
  .glass-sidebar { background: rgba(255, 252, 248, 0.65); backdrop-filter: blur(30px); }
  .glass-card    { background: rgba(255, 252, 248, 0.50); backdrop-filter: blur(16px); }
  .glass-input   { background: rgba(255, 252, 248, 0.40); backdrop-filter: blur(12px); }
}

/* ── Markdown body (agent responses, documents) ── */
@layer components {
  .doc-body h1 { font-family: var(--font-serif); font-size: 1.125rem; font-weight: 700; margin-top: 1rem; margin-bottom: 0.5rem; color: hsl(var(--foreground)); }
  .doc-body h2 { font-family: var(--font-serif); font-size: 1rem; font-weight: 600; margin-top: 0.75rem; margin-bottom: 0.375rem; color: hsl(var(--foreground)); }
  .doc-body h3 { font-family: var(--font-serif); font-size: 0.875rem; font-weight: 600; margin-top: 0.5rem; margin-bottom: 0.25rem; color: hsl(var(--foreground)); }
  .doc-body p  { font-size: 0.875rem; line-height: 1.625; color: hsl(var(--foreground)); margin-top: 0.25rem; }
  .doc-body ul { list-style-type: disc; margin-left: 1.25rem; font-size: 0.875rem; color: hsl(var(--foreground)); }
  .doc-body ol { list-style-type: decimal; margin-left: 1.25rem; font-size: 0.875rem; color: hsl(var(--foreground)); }
  .doc-body li { line-height: 1.625; }
  .doc-body strong { font-weight: 600; }
  .doc-body code { font-family: var(--font-mono); font-size: 0.75rem; background: hsl(var(--border) / 0.3); padding: 0.125rem 0.25rem; border-radius: 0.25rem; }
  .doc-body pre  { background: hsl(var(--border) / 0.3); border-radius: var(--radius); padding: 0.75rem; overflow-x: auto; font-size: 0.75rem; }
  .doc-body blockquote { border-left: 4px solid hsl(var(--border)); padding-left: 1rem; font-style: italic; color: hsl(var(--muted-foreground)); }
  .doc-body a { color: hsl(var(--primary)); text-decoration: underline; }

  /* Code blocks for pipeline expanded views */
  .code-input { background: hsl(25, 30%, 15%); color: hsl(36, 20%, 80%); font-family: var(--font-mono); font-size: 13px; padding: 1rem; border-radius: var(--radius); overflow-x: auto; }
  .code-output { background: hsl(152, 30%, 92%); color: hsl(152, 40%, 20%); font-family: var(--font-mono); font-size: 13px; padding: 1rem; border-radius: var(--radius); overflow-x: auto; }
}
```

- [ ] **Step 2: Verify the CSS parses**

```bash
npx next build 2>&1 | head -20
```

If it starts building without CSS parse errors, it's good. Cancel with Ctrl+C.

- [ ] **Step 3: Commit**

```bash
git add app/globals.css
git commit -m "style: replace design system with warm cream/brown AgenticOS palette"
```

---

### Task 3: Update root layout with new fonts

**Files:**
- Modify: `app/layout.tsx`

- [ ] **Step 1: Replace the root layout**

```tsx
import type { Metadata } from "next";
import { DM_Sans, Playfair_Display, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Lyzr CFO's Office — AgenticOS",
  description: "Autonomous financial intelligence powered by Lyzr AgenticOS",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={`${dmSans.variable} ${playfair.variable} ${jetbrainsMono.variable} min-h-full flex flex-col`}
        style={{ fontFamily: "var(--font-dm-sans), system-ui, sans-serif" }}
      >
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/layout.tsx
git commit -m "style: add Playfair Display, DM Sans, JetBrains Mono fonts"
```

---

### Task 4: Create navigation config

**Files:**
- Create: `lib/config/journeys.ts`

- [ ] **Step 1: Create the config file**

```ts
import type { LucideIcon } from "lucide-react";
import {
  Home, Calendar, RefreshCw, Landmark, BarChart3, Droplets, FileText,
  Bot, Wrench, BookOpen, Plug, GitBranch, Inbox, Search, Shield,
  ClipboardList, Database, Settings,
} from "lucide-react";

export interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  path: string;
  description?: string;
}

export const NAV_HOME: NavItem = {
  id: "home",
  label: "Home",
  icon: Home,
  path: "/",
};

export const JOURNEYS: NavItem[] = [
  {
    id: "monthly-close",
    label: "Monthly Close",
    icon: Calendar,
    path: "/monthly-close",
    description: "Consolidation, trial balances, sub-ledger postings & close calendar",
  },
  {
    id: "financial-reconciliation",
    label: "Financial Reconciliation",
    icon: RefreshCw,
    path: "/financial-reconciliation",
    description: "GL vs sub-ledger matching, break identification & ageing analysis",
  },
  {
    id: "regulatory-capital",
    label: "Regulatory Capital",
    icon: Landmark,
    path: "/regulatory-capital",
    description: "CET1, RWA, leverage ratios & Basel III compliance assessment",
  },
  {
    id: "ifrs9-ecl",
    label: "IFRS 9 ECL",
    icon: BarChart3,
    path: "/ifrs9-ecl",
    description: "Expected credit loss staging, PD/LGD models & macro overlays",
  },
  {
    id: "daily-liquidity",
    label: "Daily Liquidity",
    icon: Droplets,
    path: "/daily-liquidity",
    description: "LCR, NSFR, cash flow forecasting & intraday position monitoring",
  },
  {
    id: "regulatory-returns",
    label: "Regulatory Returns",
    icon: FileText,
    path: "/regulatory-returns",
    description: "COREP, FINREP, FR Y-9C filing preparation & validation",
  },
];

export const BUILD_NAV: NavItem[] = [
  { id: "agent-studio", label: "Agent Studio", icon: Bot, path: "/agent-studio" },
  { id: "skills-manager", label: "Skills Manager", icon: Wrench, path: "/skills-manager" },
  { id: "knowledge-base", label: "Knowledge Base", icon: BookOpen, path: "/knowledge-base" },
  { id: "integrations", label: "Integrations", icon: Plug, path: "/integrations" },
  { id: "skill-flows", label: "Skill Flows", icon: GitBranch, path: "/skill-flows" },
];

export const OBSERVE_NAV: NavItem[] = [
  { id: "decision-inbox", label: "Decision Inbox", icon: Inbox, path: "/decision-inbox" },
  { id: "agent-runs", label: "Agent Runs", icon: Search, path: "/agent-runs" },
  { id: "compliance", label: "Compliance & Guardrails", icon: Shield, path: "/compliance" },
  { id: "audit-trail", label: "Audit Trail", icon: ClipboardList, path: "/audit-trail" },
];

export const UTILITY_NAV: NavItem[] = [
  { id: "data-sources", label: "Data Sources", icon: Database, path: "/data-sources" },
  { id: "documents", label: "Documents", icon: FileText, path: "/documents" },
  { id: "settings", label: "Settings", icon: Settings, path: "/settings" },
];
```

- [ ] **Step 2: Commit**

```bash
git add lib/config/journeys.ts
git commit -m "feat: add navigation config for AgenticOS sidebar"
```

---

### Task 5: Create shared UI components

**Files:**
- Create: `components/shared/metric-card.tsx`
- Create: `components/shared/status-badge.tsx`
- Create: `components/shared/priority-badge.tsx`
- Create: `components/shared/verdict-badge.tsx`
- Create: `components/shared/sample-data-badge.tsx`
- Create: `components/shared/section-header.tsx`

- [ ] **Step 1: Create metric-card.tsx**

```tsx
import type { LucideIcon } from "lucide-react";

interface MetricCardProps {
  value: string | number;
  label: string;
  sublabel?: string;
  sublabelColor?: string;
  icon?: LucideIcon;
}

export function MetricCard({ value, label, sublabel, sublabelColor, icon: Icon }: MetricCardProps) {
  return (
    <div className="bg-card border border-border rounded-[var(--radius)] p-4 text-center">
      {Icon && <Icon size={20} className="mx-auto mb-1 text-muted-foreground" />}
      <div className="font-[var(--font-serif)] text-3xl font-semibold tracking-tight" style={{ fontFamily: "var(--font-playfair)" }}>
        {value}
      </div>
      <div className="text-[11px] uppercase tracking-[0.05em] font-medium text-muted-foreground mt-1">
        {label}
      </div>
      {sublabel && (
        <div className={`text-xs mt-0.5 ${sublabelColor ?? "text-muted-foreground"}`}>
          {sublabel}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create status-badge.tsx**

```tsx
import { clsx } from "clsx";

type BadgeStatus = "active" | "available" | "draft" | "error" | "running" | "pending";

const STATUS_STYLES: Record<BadgeStatus, string> = {
  active:    "bg-green-50 text-green-700 border-green-200",
  available: "bg-gray-50 text-gray-600 border-gray-200",
  draft:     "bg-amber-50 text-amber-700 border-amber-200",
  error:     "bg-red-50 text-red-700 border-red-200",
  running:   "bg-blue-50 text-blue-700 border-blue-200",
  pending:   "bg-amber-50 text-amber-700 border-amber-200",
};

const STATUS_LABELS: Record<BadgeStatus, string> = {
  active: "Active", available: "Available", draft: "Draft",
  error: "Error", running: "Running", pending: "Pending",
};

export function StatusBadge({ status }: { status: BadgeStatus }) {
  return (
    <span className={clsx(
      "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
      STATUS_STYLES[status]
    )}>
      <span className={clsx(
        "w-1.5 h-1.5 rounded-full",
        status === "active" ? "bg-green-500" :
        status === "running" ? "bg-blue-500" :
        status === "error" ? "bg-red-500" : "bg-gray-400"
      )} />
      {STATUS_LABELS[status]}
    </span>
  );
}
```

- [ ] **Step 3: Create priority-badge.tsx**

```tsx
import { clsx } from "clsx";

type Priority = "critical" | "high" | "medium" | "low";

const PRIORITY_STYLES: Record<Priority, string> = {
  critical: "bg-red-100 text-red-800",
  high:     "bg-amber-100 text-amber-800",
  medium:   "bg-stone-100 text-stone-700",
  low:      "bg-gray-100 text-gray-600",
};

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span className={clsx(
      "inline-block rounded-full px-2 py-0.5 text-xs font-semibold uppercase",
      PRIORITY_STYLES[priority]
    )}>
      {priority}
    </span>
  );
}
```

- [ ] **Step 4: Create verdict-badge.tsx**

```tsx
import { clsx } from "clsx";

type Verdict = "pass" | "flagged" | "warning";

const VERDICT_STYLES: Record<Verdict, string> = {
  pass:    "bg-green-100 text-green-800",
  flagged: "bg-red-100 text-red-800",
  warning: "bg-amber-100 text-amber-800",
};

const VERDICT_LABELS: Record<Verdict, string> = {
  pass: "PASS", flagged: "FLAGGED", warning: "WARNING",
};

export function VerdictBadge({ verdict }: { verdict: Verdict }) {
  return (
    <span className={clsx(
      "inline-block rounded-full px-2 py-0.5 text-xs font-medium",
      VERDICT_STYLES[verdict]
    )}>
      {VERDICT_LABELS[verdict]}
    </span>
  );
}
```

- [ ] **Step 5: Create sample-data-badge.tsx**

```tsx
export function SampleDataBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-700">
      Sample Data
    </span>
  );
}
```

- [ ] **Step 6: Create section-header.tsx**

```tsx
import type { LucideIcon } from "lucide-react";

interface SectionHeaderProps {
  icon?: LucideIcon;
  title: string;
  count?: number;
}

export function SectionHeader({ icon: Icon, title, count }: SectionHeaderProps) {
  return (
    <div className="flex items-center gap-2">
      {Icon && <Icon size={16} className="text-muted-foreground" />}
      <span className="text-[11px] uppercase tracking-[0.05em] font-medium text-muted-foreground">
        {title}
      </span>
      {count !== undefined && (
        <span className="inline-flex items-center justify-center min-w-[20px] h-5 rounded-full bg-primary/10 text-primary text-[10px] font-semibold px-1.5">
          {count}
        </span>
      )}
    </div>
  );
}
```

- [ ] **Step 7: Commit**

```bash
git add components/shared/
git commit -m "feat: add shared UI components (metric, status, priority, verdict, sample-data badges)"
```

---

### Task 6: Create the new sidebar

**Files:**
- Create: `components/shell/sidebar.tsx`
- Create: `components/shell/nav-item.tsx`
- Create: `components/shell/agent-status-bar.tsx`

- [ ] **Step 1: Create nav-item.tsx**

```tsx
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
```

- [ ] **Step 2: Create agent-status-bar.tsx**

```tsx
import { Zap } from "lucide-react";

export function AgentStatusBar() {
  return (
    <div className="px-4 py-3 border-t border-border">
      <div className="flex items-center gap-2 text-sm">
        <Zap size={14} className="text-warning" />
        <span className="font-medium text-foreground">Agent Active</span>
      </div>
      <div className="text-xs text-muted-foreground mt-0.5">Claude Sonnet 4.6</div>
      <div className="text-[10px] text-muted-foreground mt-0.5">Powered by Lyzr AgenticOS</div>
    </div>
  );
}
```

- [ ] **Step 3: Create sidebar.tsx**

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { LogOut } from "lucide-react";
import { NavItem } from "./nav-item";
import { AgentStatusBar } from "./agent-status-bar";
import { NAV_HOME, JOURNEYS, BUILD_NAV, OBSERVE_NAV } from "@/lib/config/journeys";

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
```

- [ ] **Step 4: Commit**

```bash
git add components/shell/
git commit -m "feat: add AgenticOS sidebar with three-section navigation"
```

---

### Task 7: Create the (shell) layout group

**Files:**
- Create: `app/(shell)/layout.tsx`

- [ ] **Step 1: Create the shell layout**

```tsx
import { Sidebar } from "@/components/shell/sidebar";

export default function ShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto px-8 pt-8 pb-4">
        {children}
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Create a placeholder home page to verify the shell works**

Create `app/(shell)/page.tsx`:

```tsx
export default function CommandCenter() {
  return (
    <div className="flex flex-col items-center pt-16">
      <h1
        className="text-3xl font-semibold tracking-tight"
        style={{ fontFamily: "var(--font-playfair)" }}
      >
        Welcome to CFO&apos;s Office
      </h1>
      <p className="text-sm text-muted-foreground mt-2">
        AgenticOS — Autonomous financial intelligence
      </p>
    </div>
  );
}
```

- [ ] **Step 3: Verify the shell renders**

```bash
npm run dev
```

Open `http://localhost:3000`. You should see the warm cream background with glassmorphism sidebar on the left (220px) containing: Home, 6 journey items under "DOMAIN JOURNEYS", 5 Build items, 4 Observe items, user section, and agent status bar. Main content shows the welcome text in Playfair Display. The old dashboard may still be accessible on the same route — that's expected during migration.

- [ ] **Step 4: Commit**

```bash
git add app/(shell)/
git commit -m "feat: add (shell) layout group with AgenticOS sidebar and placeholder home"
```

---

### Task 8: Move existing pages into (shell)

**Files:**
- Move: `app/(dashboard)/data-sources/` → `app/(shell)/data-sources/`
- Move: `app/(dashboard)/documents/` → `app/(shell)/documents/`
- Move: `app/(dashboard)/settings/` → `app/(shell)/settings/`

- [ ] **Step 1: Copy pages to new location**

```bash
cp -r app/\(dashboard\)/data-sources app/\(shell\)/data-sources
cp -r app/\(dashboard\)/documents app/\(shell\)/documents
cp -r app/\(dashboard\)/settings app/\(shell\)/settings
```

- [ ] **Step 2: Verify pages render under new shell**

Open `http://localhost:3000/data-sources`, `/documents`, `/settings`. They should render inside the new sidebar layout. Styling may look off (old color variables) — that's fine, they'll be re-styled later or the new CSS variables are close enough.

- [ ] **Step 3: Delete old (dashboard) layout group**

```bash
rm -rf app/\(dashboard\)/
```

- [ ] **Step 4: Delete old sidebar component**

```bash
rm -rf components/layout/
```

If other components in `components/layout/` are imported elsewhere (like `resizable-split-pane.tsx`), keep them and move the import. Check:

```bash
grep -r "components/layout" --include="*.tsx" --include="*.ts" app/ components/ lib/ | grep -v node_modules | grep -v "(dashboard)"
```

If any hits remain, move those files to a new location or keep `components/layout/` minus the old `sidebar.tsx`.

- [ ] **Step 5: Verify no broken imports**

```bash
npx next build 2>&1 | tail -20
```

Fix any import errors. The build may fail on old component references — that's expected. The key is that the `(shell)` layout and moved pages compile.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: migrate pages from (dashboard) to (shell) layout, delete old sidebar"
```

---

## Phase 2: Command Center

### Task 9: Create the search bar component

**Files:**
- Create: `components/command-center/search-bar.tsx`

- [ ] **Step 1: Create search-bar.tsx**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Paperclip, Send } from "lucide-react";
import { clsx } from "clsx";

export function SearchBar() {
  const [value, setValue] = useState("");
  const router = useRouter();

  const handleSubmit = () => {
    if (value.trim()) {
      router.push(`/agent-console?message=${encodeURIComponent(value.trim())}`);
      setValue("");
    }
  };

  return (
    <div className={clsx(
      "flex items-center gap-3 px-4 py-3 rounded-2xl",
      "border border-border glass-input",
      "focus-within:ring-2 focus-within:ring-ring/20",
      "w-full max-w-2xl"
    )}>
      <button className="text-muted-foreground hover:text-foreground transition-colors">
        <Paperclip size={18} />
      </button>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
        placeholder="How can I help?"
        className="flex-1 bg-transparent outline-none text-foreground placeholder:text-muted-foreground text-sm"
      />
      <button
        onClick={handleSubmit}
        disabled={!value.trim()}
        className={clsx(
          "w-8 h-8 rounded-full flex items-center justify-center transition-colors",
          value.trim()
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground"
        )}
      >
        <Send size={16} />
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/command-center/search-bar.tsx
git commit -m "feat: add Command Center search bar component"
```

---

### Task 10: Create journey card component

**Files:**
- Create: `components/command-center/journey-card.tsx`

- [ ] **Step 1: Create journey-card.tsx**

```tsx
"use client";

import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import type { NavItem } from "@/lib/config/journeys";

interface JourneyCardProps {
  journey: NavItem;
  tooltip?: string;
}

export function JourneyCard({ journey, tooltip }: JourneyCardProps) {
  const router = useRouter();
  const Icon = journey.icon;

  return (
    <div className="relative">
      {tooltip && (
        <div className="absolute -left-2 top-1/2 -translate-y-1/2 -translate-x-full bg-primary text-primary-foreground text-xs px-3 py-2 rounded-lg max-w-[180px] z-10 hidden lg:block">
          {tooltip}
          <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1 w-2 h-2 bg-primary rotate-45" />
        </div>
      )}
      <motion.button
        onClick={() => router.push(journey.path)}
        whileHover={{ scale: 1.01 }}
        transition={{ duration: 0.15 }}
        className="w-full flex items-start gap-4 p-5 rounded-[var(--radius)] bg-card border border-border text-left hover:border-primary/20 transition-colors"
      >
        <Icon size={24} className="text-muted-foreground mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-medium" style={{ fontFamily: "var(--font-playfair)" }}>
            {journey.label}
          </h3>
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
            {journey.description}
          </p>
        </div>
        <ChevronRight size={18} className="text-muted-foreground mt-1 shrink-0" />
      </motion.button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/command-center/journey-card.tsx
git commit -m "feat: add journey card component for Command Center"
```

---

### Task 11: Create insight and action components

**Files:**
- Create: `components/command-center/agent-insights.tsx`
- Create: `components/command-center/actions-required.tsx`
- Create: `lib/config/sample-insights.ts`

- [ ] **Step 1: Create sample-insights.ts**

```ts
export interface Insight {
  id: string;
  severity: "critical" | "warning" | "info";
  title: string;
  detail: string;
  cta?: { label: string; path: string };
}

export const SAMPLE_INSIGHTS: Insight[] = [
  {
    id: "ins-1",
    severity: "warning",
    title: "SMB Revenue Miss: -$12.4M (-6.9%)",
    detail: "SMB segment revenue of $168.6M came in $12.4M below the $181.0M forecast. Macro headwinds in the mid-market segment are the primary driver. This is the largest single-segment variance this quarter.",
    cta: { label: "Run Variance Analysis", path: "/financial-reconciliation" },
  },
  {
    id: "ins-2",
    severity: "critical",
    title: "Executive T&E Anomaly Detected",
    detail: "VP Sales James Mitchell T&E is 312% above peer average ($124,100 Q1 vs peer avg $30,567).",
    cta: { label: "View Expense Report", path: "/monthly-close" },
  },
  {
    id: "ins-3",
    severity: "warning",
    title: "5 Vendors Below Risk Threshold",
    detail: "High-risk vendors: CloudHost Inc (3.2/10), DataVault Systems (4.1/10), CloudBridge CDN (4.8/10), Innovatech Labs (3.8/10), DataProtect360 (4.4/10). 5 are single-source dependencies.",
    cta: { label: "Score Vendors", path: "/financial-reconciliation" },
  },
  {
    id: "ins-4",
    severity: "info",
    title: "Q1 Close Readiness at 68%",
    detail: "Sub-ledger close and interco recon complete. Journal entries 42/56 posted. Consolidation and reporting package pending.",
    cta: { label: "View Close Status", path: "/monthly-close" },
  },
  {
    id: "ins-5",
    severity: "warning",
    title: "LCR Trending Down — 141% (was 148%)",
    detail: "Liquidity coverage ratio dropped 7 points MoM. Still above 100% minimum but approaching internal buffer threshold of 130%.",
    cta: { label: "Check Liquidity", path: "/daily-liquidity" },
  },
  {
    id: "ins-6",
    severity: "info",
    title: "IFRS 9 Stage 2 Migration +0.8% MoM",
    detail: "Stage 2 (under-performing) portfolio grew by ¥12.3B. Driven primarily by three corporate exposures in the manufacturing sector.",
  },
];
```

- [ ] **Step 2: Create agent-insights.tsx**

```tsx
"use client";

import { useRouter } from "next/navigation";
import { AlertTriangle, AlertCircle, Info } from "lucide-react";
import { SectionHeader } from "@/components/shared/section-header";
import { SAMPLE_INSIGHTS, type Insight } from "@/lib/config/sample-insights";

const SEVERITY_ICON = {
  critical: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const SEVERITY_COLOR = {
  critical: "text-destructive",
  warning: "text-warning",
  info: "text-info",
};

function InsightCard({ insight }: { insight: Insight }) {
  const router = useRouter();
  const Icon = SEVERITY_ICON[insight.severity];

  return (
    <div className="flex gap-3 py-3 border-b border-border last:border-b-0">
      <Icon size={18} className={`shrink-0 mt-0.5 ${SEVERITY_COLOR[insight.severity]}`} />
      <div className="min-w-0 flex-1">
        <h4 className="text-sm font-medium text-foreground">{insight.title}</h4>
        <p className="text-xs text-muted-foreground mt-1 line-clamp-3">{insight.detail}</p>
        {insight.cta && (
          <button
            onClick={() => router.push(insight.cta!.path)}
            className="text-xs font-medium text-primary hover:underline mt-1.5"
          >
            {insight.cta.label}
          </button>
        )}
      </div>
    </div>
  );
}

export function AgentInsights() {
  return (
    <div>
      <SectionHeader title="Agent Insights" count={SAMPLE_INSIGHTS.length} />
      <div className="mt-3 bg-card border border-border rounded-[var(--radius)] px-4 py-1">
        {SAMPLE_INSIGHTS.map((insight) => (
          <InsightCard key={insight.id} insight={insight} />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create actions-required.tsx**

```tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { SectionHeader } from "@/components/shared/section-header";
import { PriorityBadge } from "@/components/shared/priority-badge";
import type { Action } from "@/lib/types";

function severityToPriority(severity: string): "critical" | "high" | "medium" | "low" {
  if (severity === "critical") return "critical";
  if (severity === "warning") return "high";
  return "medium";
}

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function ActionCard({ action, onAction }: { action: Action; onAction: (id: string, status: string) => void }) {
  return (
    <div className="p-4 border-b border-border last:border-b-0">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <Bell size={16} className="text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-medium text-foreground truncate">{action.headline}</h4>
            <PriorityBadge priority={severityToPriority(action.severity)} />
          </div>
          <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
            <span className="uppercase tracking-wider">{action.type}</span>
            <span>·</span>
            <span>{timeAgo(action.createdAt)}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{action.detail}</p>
          <div className="flex items-center gap-2 mt-2.5">
            <button
              onClick={() => onAction(action.id, "approved")}
              className="text-xs px-3 py-1.5 rounded-[var(--radius)] bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity"
            >
              Approve
            </button>
            <button
              onClick={() => onAction(action.id, "dismissed")}
              className="text-xs px-3 py-1.5 rounded-[var(--radius)] border border-destructive text-destructive font-medium hover:bg-destructive/5 transition-colors"
            >
              Reject
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ActionsRequired() {
  const router = useRouter();
  const [actions, setActions] = useState<Action[]>([]);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data?.userId) return;
        return fetch(`/api/actions?userId=${data.userId}&status=pending&limit=5`);
      })
      .then((r) => r?.ok ? r.json() : [])
      .then((data) => {
        if (Array.isArray(data)) {
          setActions(data.map((a: Record<string, unknown>) => ({
            ...a,
            createdAt: new Date(a.createdAt as string),
          })));
        }
      });
  }, []);

  const handleAction = async (id: string, status: string) => {
    await fetch(`/api/actions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setActions((prev) => prev.filter((a) => a.id !== id));
  };

  return (
    <div>
      <SectionHeader title="Actions Required" count={actions.length} />
      <div className="mt-3 bg-card border border-border rounded-[var(--radius)]">
        {actions.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No pending actions
          </div>
        ) : (
          <>
            {actions.map((action) => (
              <ActionCard key={action.id} action={action} onAction={handleAction} />
            ))}
            {actions.length >= 5 && (
              <button
                onClick={() => router.push("/decision-inbox")}
                className="w-full py-2.5 text-xs font-medium text-primary hover:underline"
              >
                View all actions
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add components/command-center/agent-insights.tsx components/command-center/actions-required.tsx lib/config/sample-insights.ts
git commit -m "feat: add Agent Insights and Actions Required components for Command Center"
```

---

### Task 12: Build the full Command Center page

**Files:**
- Modify: `app/(shell)/page.tsx`

- [ ] **Step 1: Replace the placeholder with the full Command Center**

```tsx
import { Sparkles } from "lucide-react";
import { SearchBar } from "@/components/command-center/search-bar";
import { JourneyCard } from "@/components/command-center/journey-card";
import { AgentInsights } from "@/components/command-center/agent-insights";
import { ActionsRequired } from "@/components/command-center/actions-required";
import { SectionHeader } from "@/components/shared/section-header";
import { JOURNEYS } from "@/lib/config/journeys";

export default function CommandCenter() {
  return (
    <div className="flex flex-col items-center max-w-5xl mx-auto">
      {/* Hero */}
      <img
        src="https://cdn2.futurepedia.io/2026-02-26T19-07-25.498Z-q6ZO1hg4Romi6JbT7L06v7dv3Sy2zIBis.png?w=256"
        alt="Lyzr"
        className="w-16 h-16 rounded-lg mb-4"
      />
      <h1
        className="text-3xl font-semibold tracking-tight text-center"
        style={{ fontFamily: "var(--font-playfair)" }}
      >
        Welcome, Vidur
      </h1>
      <p className="text-sm text-muted-foreground mt-1 text-center">
        CFO&apos;s Office AgenticOS — Autonomous financial intelligence
      </p>

      {/* Search bar */}
      <div className="mt-8 w-full flex justify-center">
        <SearchBar />
      </div>

      {/* Agent Journeys */}
      <section className="w-full mt-10">
        <SectionHeader icon={Sparkles} title="Agent Journeys" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          {JOURNEYS.map((journey, i) => (
            <JourneyCard
              key={journey.id}
              journey={journey}
              tooltip={i === 0 ? "Start here — validate trial balances & generate your close readiness checklist" : undefined}
            />
          ))}
        </div>
      </section>

      {/* Insights + Actions */}
      <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-8 mt-10 pb-8">
        <AgentInsights />
        <ActionsRequired />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify the Command Center renders**

Open `http://localhost:3000`. You should see:
- Lyzr icon centered at top
- "Welcome, Vidur" in Playfair Display
- Glass search bar with paperclip and send icons
- 6 journey cards in 2-column grid
- Agent Insights (left) with severity-coded cards
- Actions Required (right) pulling from real Prisma actions

- [ ] **Step 3: Commit**

```bash
git add app/(shell)/page.tsx
git commit -m "feat: build Command Center home page with search, journeys, insights, actions"
```

---

## Phase 3: Agent Console + SSE Streaming

### Task 13: Create pipeline types and classifier

**Files:**
- Create: `lib/agent/pipeline-types.ts`
- Create: `lib/agent/classify-event.ts`

- [ ] **Step 1: Create pipeline-types.ts**

```ts
export type StepType =
  | "agent_init"
  | "skill_discovery"
  | "skill_load"
  | "memory_load"
  | "file_read"
  | "file_write"
  | "tool_exec"
  | "llm_thinking"
  | "wiki_update"
  | "output_ready"
  | "error";

export interface PipelineStep {
  id: string;
  type: StepType;
  label: string;
  detail?: string;
  file?: string;
  status: "running" | "completed" | "failed";
  duration?: number;
  content?: string;
}

export type FrontendEvent =
  | { event: "pipeline_step"; data: PipelineStep }
  | { event: "delta"; data: { text: string } }
  | { event: "thinking"; data: { text: string } }
  | { event: "done"; data: { finished: true } }
  | { event: "error"; data: { error: string } };
```

- [ ] **Step 2: Create classify-event.ts**

```ts
import type { GCMessage } from "gitclaw";
import type { PipelineStep } from "./pipeline-types";

let stepCounter = 0;

export function resetStepCounter() {
  stepCounter = 0;
}

function nextId(): string {
  return `step-${++stepCounter}`;
}

// Map our custom tool names to human-readable labels
const TOOL_LABELS: Record<string, string> = {
  search_records: "Searching financial records",
  analyze_financial_data: "Analyzing financial data",
  create_actions: "Creating action items",
  update_action: "Updating action",
  generate_commentary: "Generating commentary",
  draft_email: "Drafting email",
  draft_dunning_email: "Drafting dunning email",
  scan_ar_aging: "Scanning AR aging",
  create_ar_actions: "Creating AR actions",
  update_invoice_status: "Updating invoice status",
  generate_variance_report: "Generating variance report",
  generate_ar_summary: "Generating AR summary",
  save_document: "Saving document",
  memory: "Accessing agent memory",
};

export function classifyEvent(msg: GCMessage): PipelineStep | null {
  if (msg.type === "system" && (msg as Record<string, unknown>).subtype === "session_start") {
    return { id: nextId(), type: "agent_init", label: "Initializing agent...", status: "running" };
  }

  if (msg.type === "tool_use") {
    const toolName = (msg as Record<string, unknown>).toolName as string;
    const args = (msg as Record<string, unknown>).args as Record<string, unknown> | undefined;

    // task_tracker — skill discovery
    if (toolName === "task_tracker") {
      const action = args?.action as string | undefined;
      if (action === "begin") {
        return {
          id: nextId(),
          type: "skill_discovery",
          label: "Discovering relevant skills...",
          detail: (args?.objective as string) || undefined,
          status: "running",
        };
      }
      return null; // suppress updates/loaded
    }

    // memory
    if (toolName === "memory") {
      const action = args?.action as string | undefined;
      if (action === "load") {
        return { id: nextId(), type: "memory_load", label: "Loading agent memory...", status: "running" };
      }
      if (action === "save") {
        return { id: nextId(), type: "file_write", label: "Saving to memory...", status: "running" };
      }
    }

    // read — skill vs data file
    if (toolName === "read") {
      const path = (args?.file_path || args?.path || "") as string;
      if (path.includes("skills/") && path.endsWith("SKILL.md")) {
        const skillName = path.split("skills/")[1]?.split("/")[0];
        return { id: nextId(), type: "skill_load", label: `Loading skill — ${skillName}`, file: path, status: "running" };
      }
      if (path.includes("memory/wiki/")) {
        const pageName = path.split("/").pop()?.replace(".md", "");
        return { id: nextId(), type: "file_read", label: `Reading wiki — ${pageName}`, file: path, status: "running" };
      }
      const fileName = path.split("/").pop();
      return { id: nextId(), type: "file_read", label: `Reading ${fileName}`, file: path, status: "running" };
    }

    // write
    if (toolName === "write") {
      const path = (args?.file_path || args?.path || "") as string;
      if (path.includes("memory/wiki/")) {
        const pageName = path.split("/").pop()?.replace(".md", "");
        return { id: nextId(), type: "wiki_update", label: `Updating wiki — ${pageName}`, file: path, status: "running" };
      }
      const fileName = path.split("/").pop();
      return { id: nextId(), type: "file_write", label: `Writing ${fileName}`, file: path, status: "running" };
    }

    // save_document (our custom tool)
    if (toolName === "save_document") {
      return { id: nextId(), type: "file_write", label: "Saving document", status: "running" };
    }

    // Known custom tools
    if (TOOL_LABELS[toolName]) {
      return {
        id: nextId(),
        type: "tool_exec",
        label: TOOL_LABELS[toolName],
        detail: args ? JSON.stringify(args).substring(0, 100) : undefined,
        status: "running",
      };
    }

    // cli
    if (toolName === "cli") {
      return {
        id: nextId(),
        type: "tool_exec",
        label: "Running command",
        detail: (args?.command as string)?.substring(0, 80),
        status: "running",
      };
    }

    // Unknown tool
    return {
      id: nextId(),
      type: "tool_exec",
      label: `Running ${toolName}`,
      detail: args ? JSON.stringify(args).substring(0, 100) : undefined,
      status: "running",
    };
  }

  // tool_result, delta, other — handled elsewhere
  return null;
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/agent/pipeline-types.ts lib/agent/classify-event.ts
git commit -m "feat: add pipeline step types and gitclaw event classifier"
```

---

### Task 14: Rewrite /api/chat to emit typed SSE events

**Files:**
- Modify: `app/api/chat/route.ts`

- [ ] **Step 1: Rewrite the chat route**

Replace the entire file with:

```ts
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { chatWithAgent } from "@/lib/agent";
import { classifyEvent, resetStepCounter } from "@/lib/agent/classify-event";
import type { GCMessage } from "gitclaw";
import type { PipelineStep } from "@/lib/agent/pipeline-types";

function sseWrite(controller: ReadableStreamDefaultController, encoder: TextEncoder, event: string, data: unknown) {
  controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { userId, message, actionId, journeyId } = body;

  if (!userId || !message) {
    return new Response(
      JSON.stringify({ error: "userId and message required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Save user message
  await prisma.chatMessage.create({
    data: { userId, role: "user", content: message, actionId: actionId ?? null },
  });

  const encoder = new TextEncoder();
  const agentAvailable = !!(process.env.OPENAI_API_KEY || process.env.LYZR_API_KEY || process.env.GEMINI_API_KEY);

  const stream = new ReadableStream({
    async start(controller) {
      resetStepCounter();
      let fullResponse = "";
      let lastStepId: string | null = null;
      let lastStepStart = Date.now();

      // Send initial pipeline step
      const initStep: PipelineStep = {
        id: "step-0",
        type: "agent_init",
        label: "Initializing agent...",
        status: "running",
      };
      sseWrite(controller, encoder, "pipeline_step", initStep);

      const finish = async (text: string) => {
        // Mark init as completed if still running
        sseWrite(controller, encoder, "pipeline_step", { id: "step-0", status: "completed" });
        sseWrite(controller, encoder, "done", { finished: true });
        controller.close();

        await prisma.chatMessage.create({
          data: { userId, role: "agent", content: text, actionId: actionId ?? null },
        });
      };

      if (agentAvailable) {
        await chatWithAgent(userId, message, actionId, {
          onDelta: (text) => {
            fullResponse += text;
            sseWrite(controller, encoder, "delta", { text });
          },
          onComplete: async (text) => {
            await finish(text || fullResponse);
          },
          onError: async (errorMsg) => {
            sseWrite(controller, encoder, "error", { error: errorMsg });
            await finish(fullResponse || `Error: ${errorMsg}`);
          },
        });
      } else {
        // Fallback placeholder
        const recentActions = await prisma.action.findMany({
          where: { userId, status: "pending" },
          orderBy: { createdAt: "desc" },
          take: 10,
        });

        fullResponse = `I've reviewed your financial data. Currently there are ${recentActions.length} open items in your actions feed. What specific area would you like me to analyze?`;

        // Simulate streaming
        const words = fullResponse.split(" ");
        for (let i = 0; i < words.length; i++) {
          const chunk = (i === 0 ? "" : " ") + words[i];
          sseWrite(controller, encoder, "delta", { text: chunk });
          await new Promise((r) => setTimeout(r, 30));
        }

        await finish(fullResponse);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
```

Note: The full pipeline event classification requires hooking into the raw gitclaw stream. The current `chatWithAgent` uses callbacks (onDelta, onComplete, onError) which don't expose tool_use/tool_result events. For now, the route emits `agent_init` + `delta` + `done`. To get full pipeline events, a future task will modify `chatWithAgent` to expose the raw stream. This is sufficient for the Agent Console to work — pipeline steps will appear once the agent integration is deepened.

- [ ] **Step 2: Verify the route works**

```bash
curl -X POST http://localhost:3000/api/chat -H "Content-Type: application/json" -d '{"userId":"cmnqrhkym0000lg6wyy2pkyy0","message":"hello"}' 2>/dev/null | head -20
```

Expected: SSE events with `event: pipeline_step`, `event: delta`, `event: done`.

- [ ] **Step 3: Commit**

```bash
git add app/api/chat/route.ts
git commit -m "feat: rewrite /api/chat to emit typed SSE events (pipeline_step, delta, done)"
```

---

### Task 15: Create the useChatStream hook

**Files:**
- Create: `hooks/use-chat-stream.ts`

- [ ] **Step 1: Create the hook**

```ts
"use client";

import { useState, useRef, useCallback } from "react";
import type { PipelineStep } from "@/lib/agent/pipeline-types";

export interface StreamMessage {
  id: string;
  role: "user" | "agent";
  content: string;
  pipelineSteps?: PipelineStep[];
}

interface ChatStreamState {
  messages: StreamMessage[];
  pipelineSteps: PipelineStep[];
  isStreaming: boolean;
}

export function useChatStream(userId: string | null) {
  const [state, setState] = useState<ChatStreamState>({
    messages: [],
    pipelineSteps: [],
    isStreaming: false,
  });
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(async (content: string, opts?: { actionId?: string; journeyId?: string }) => {
    if (!userId || !content.trim()) return;

    abortRef.current = new AbortController();

    // Add user message and reset pipeline
    setState((s) => ({
      ...s,
      isStreaming: true,
      pipelineSteps: [],
      messages: [...s.messages, { id: `msg-${Date.now()}`, role: "user", content }],
    }));

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          message: content,
          actionId: opts?.actionId,
          journeyId: opts?.journeyId,
        }),
        signal: abortRef.current.signal,
      });

      if (!response.body) {
        setState((s) => ({ ...s, isStreaming: false }));
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assistantText = "";
      const assistantId = `msg-${Date.now()}-agent`;

      // Add empty agent message
      setState((s) => ({
        ...s,
        messages: [...s.messages, { id: assistantId, role: "agent", content: "" }],
      }));

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";

        for (const part of parts) {
          const eventLine = part.match(/^event: (.+)$/m)?.[1];
          const dataLine = part.match(/^data: (.+)$/m)?.[1];
          if (!eventLine || !dataLine) continue;

          let data: Record<string, unknown>;
          try {
            data = JSON.parse(dataLine);
          } catch {
            continue;
          }

          switch (eventLine) {
            case "pipeline_step":
              setState((s) => {
                const step = data as unknown as PipelineStep;
                const existing = s.pipelineSteps.find((p) => p.id === step.id);
                if (existing) {
                  return {
                    ...s,
                    pipelineSteps: s.pipelineSteps.map((p) =>
                      p.id === step.id ? { ...p, ...step } : p
                    ),
                  };
                }
                return { ...s, pipelineSteps: [...s.pipelineSteps, step] };
              });
              break;

            case "delta":
              assistantText += (data as { text: string }).text;
              setState((s) => ({
                ...s,
                messages: s.messages.map((m) =>
                  m.id === assistantId ? { ...m, content: assistantText } : m
                ),
              }));
              break;

            case "done":
              setState((s) => ({ ...s, isStreaming: false }));
              break;

            case "error":
              assistantText += `\n\n**Error:** ${(data as { error: string }).error}`;
              setState((s) => ({
                ...s,
                isStreaming: false,
                messages: s.messages.map((m) =>
                  m.id === assistantId ? { ...m, content: assistantText } : m
                ),
              }));
              break;
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setState((s) => ({ ...s, isStreaming: false }));
      }
    }

    setState((s) => ({ ...s, isStreaming: false }));
  }, [userId]);

  const stopStream = useCallback(() => {
    abortRef.current?.abort();
    setState((s) => ({ ...s, isStreaming: false }));
  }, []);

  return { ...state, sendMessage, stopStream };
}
```

- [ ] **Step 2: Commit**

```bash
git add hooks/use-chat-stream.ts
git commit -m "feat: add useChatStream hook for SSE streaming with pipeline steps"
```

---

### Task 16: Create pipeline visualization components

**Files:**
- Create: `components/pipeline/step-icon.tsx`
- Create: `components/pipeline/pipeline-step.tsx`
- Create: `components/pipeline/pipeline-container.tsx`

- [ ] **Step 1: Create step-icon.tsx**

```tsx
import {
  Cpu, Compass, BookOpen, Brain, FileSearch, FilePlus,
  Terminal, Sparkles, Network, CheckCircle, AlertCircle, Loader2,
} from "lucide-react";
import type { StepType } from "@/lib/agent/pipeline-types";

const STEP_ICONS: Record<StepType, { icon: typeof Cpu; color: string }> = {
  agent_init:      { icon: Cpu,          color: "text-gray-500" },
  skill_discovery: { icon: Compass,      color: "text-blue-600" },
  skill_load:      { icon: BookOpen,     color: "text-indigo-600" },
  memory_load:     { icon: Brain,        color: "text-purple-600" },
  file_read:       { icon: FileSearch,   color: "text-teal-600" },
  file_write:      { icon: FilePlus,     color: "text-green-600" },
  tool_exec:       { icon: Terminal,     color: "text-amber-600" },
  llm_thinking:    { icon: Sparkles,     color: "text-violet-500" },
  wiki_update:     { icon: Network,      color: "text-purple-600" },
  output_ready:    { icon: CheckCircle,  color: "text-green-600" },
  error:           { icon: AlertCircle,  color: "text-red-600" },
};

export function StepIcon({ type, status }: { type: StepType; status: string }) {
  if (status === "running") {
    return <Loader2 size={16} className="text-muted-foreground animate-spin" />;
  }
  const config = STEP_ICONS[type];
  const Icon = config.icon;
  return <Icon size={16} className={config.color} />;
}
```

- [ ] **Step 2: Create pipeline-step.tsx**

```tsx
"use client";

import { motion } from "framer-motion";
import { CheckCircle, XCircle } from "lucide-react";
import { StepIcon } from "./step-icon";
import type { PipelineStep as PipelineStepType } from "@/lib/agent/pipeline-types";

export function PipelineStepRow({ step }: { step: PipelineStepType }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="flex items-center gap-2 py-1 text-sm"
    >
      <StepIcon type={step.type} status={step.status} />

      {step.status === "completed" && (
        <CheckCircle size={12} className="text-success shrink-0" />
      )}
      {step.status === "failed" && (
        <XCircle size={12} className="text-destructive shrink-0" />
      )}

      <span className={step.status === "running" ? "text-muted-foreground" : "text-foreground"}>
        {step.label}
      </span>

      {step.detail && (
        <span className="text-xs text-muted-foreground truncate max-w-[200px]">
          {step.detail}
        </span>
      )}

      {step.duration !== undefined && (
        <span className="ml-auto text-xs text-muted-foreground shrink-0">
          {(step.duration / 1000).toFixed(1)}s
        </span>
      )}
    </motion.div>
  );
}
```

- [ ] **Step 3: Create pipeline-container.tsx**

```tsx
"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { PipelineStepRow } from "./pipeline-step";
import type { PipelineStep } from "@/lib/agent/pipeline-types";

interface PipelineContainerProps {
  steps: PipelineStep[];
  isStreaming: boolean;
}

export function PipelineContainer({ steps, isStreaming }: PipelineContainerProps) {
  const [collapsed, setCollapsed] = useState(false);

  if (steps.length === 0) return null;

  const allDone = !isStreaming && steps.every((s) => s.status !== "running");

  if (allDone && collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground py-1 transition-colors"
      >
        <ChevronRight size={14} />
        <span className="uppercase tracking-wider font-medium">
          {steps.length} steps completed
        </span>
      </button>
    );
  }

  return (
    <div className="py-1">
      {allDone && (
        <button
          onClick={() => setCollapsed(true)}
          className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground mb-1 transition-colors"
        >
          <ChevronDown size={14} />
          <span className="uppercase tracking-wider font-medium">
            {steps.length} steps completed
          </span>
        </button>
      )}
      {steps.map((step) => (
        <PipelineStepRow key={step.id} step={step} />
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add components/pipeline/
git commit -m "feat: add pipeline visualization components (step icon, step row, container)"
```

---

### Task 17: Create the Agent Console page

**Files:**
- Create: `components/agent-console/chat-input.tsx`
- Create: `components/agent-console/agent-context-panel.tsx`
- Create: `app/(shell)/agent-console/page.tsx`

- [ ] **Step 1: Create chat-input.tsx**

```tsx
"use client";

import { useState } from "react";
import { Send, Square } from "lucide-react";
import { clsx } from "clsx";

interface ChatInputProps {
  onSend: (message: string) => void;
  onStop: () => void;
  isStreaming: boolean;
  placeholder?: string;
}

export function ChatInput({ onSend, onStop, isStreaming, placeholder }: ChatInputProps) {
  const [value, setValue] = useState("");

  const handleSubmit = () => {
    if (value.trim() && !isStreaming) {
      onSend(value.trim());
      setValue("");
    }
  };

  return (
    <div className="border-t border-border px-4 py-3">
      <div className="flex items-center gap-3">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          placeholder={placeholder ?? "Message CFO Agent..."}
          disabled={isStreaming}
          className="flex-1 bg-transparent outline-none text-sm text-foreground placeholder:text-muted-foreground disabled:opacity-50"
        />
        {isStreaming ? (
          <button
            onClick={onStop}
            className="w-8 h-8 rounded-full bg-destructive flex items-center justify-center hover:opacity-90 transition-opacity"
          >
            <Square size={14} className="text-destructive-foreground" fill="currentColor" />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={!value.trim()}
            className={clsx(
              "w-8 h-8 rounded-full flex items-center justify-center transition-colors",
              value.trim() ? "bg-primary text-primary-foreground" : "text-muted-foreground"
            )}
          >
            <Send size={16} />
          </button>
        )}
      </div>
      <p className="text-[10px] text-muted-foreground mt-1.5">
        AI can make mistakes. Verify critical financial data.
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Create agent-context-panel.tsx**

```tsx
"use client";

import { useState, useEffect } from "react";
import { BookOpen, FileText, Shield, ChevronDown, ChevronRight } from "lucide-react";
import { SectionHeader } from "@/components/shared/section-header";

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
    // Read from filesystem via API
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
```

- [ ] **Step 3: Create the Agent Console page**

```tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Bot } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useChatStream } from "@/hooks/use-chat-stream";
import { ChatInput } from "@/components/agent-console/chat-input";
import { AgentContextPanel } from "@/components/agent-console/agent-context-panel";
import { PipelineContainer } from "@/components/pipeline/pipeline-container";

export default function AgentConsolePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const autoSentRef = useRef(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.userId) setUserId(data.userId);
      });
  }, []);

  const { messages, pipelineSteps, isStreaming, sendMessage, stopStream } = useChatStream(userId);

  // Auto-send from Command Center search bar
  useEffect(() => {
    if (!userId || autoSentRef.current) return;
    const msg = searchParams.get("message");
    if (msg) {
      autoSentRef.current = true;
      sendMessage(msg);
      router.replace("/agent-console");
    }
  }, [userId, searchParams, sendMessage, router]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pipelineSteps]);

  return (
    <div className="flex h-[calc(100vh-4rem)] -mx-8 -mt-8 -mb-4">
      {/* Chat + Pipeline */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Agent header */}
        <div className="px-6 py-3 border-b border-border flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <Bot size={18} className="text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">CFO Agent</h2>
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="w-1.5 h-1.5 rounded-full bg-success" />
              Online &amp; Ready
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {messages.length === 0 && !isStreaming && (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <Bot size={48} className="mb-4 opacity-30" />
              <p className="text-sm">Send a message to start a conversation</p>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={msg.id}>
              {msg.role === "user" ? (
                <div className="flex justify-end">
                  <div className="bg-primary text-primary-foreground rounded-2xl rounded-br-md px-4 py-2.5 max-w-[70%] text-sm">
                    {msg.content}
                  </div>
                </div>
              ) : (
                <div className="flex justify-start">
                  <div className="max-w-[85%]">
                    {/* Show pipeline for the last agent message */}
                    {i === messages.length - 1 && pipelineSteps.length > 0 && (
                      <div className="mb-2 px-3 py-2 bg-card border border-border rounded-[var(--radius)]">
                        <PipelineContainer steps={pipelineSteps} isStreaming={isStreaming} />
                      </div>
                    )}
                    {msg.content && (
                      <div className="bg-card border border-border rounded-2xl rounded-bl-md px-4 py-3 text-sm doc-body">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <ChatInput
          onSend={(msg) => sendMessage(msg)}
          onStop={stopStream}
          isStreaming={isStreaming}
        />
      </div>

      {/* Context panel */}
      <AgentContextPanel />
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add components/agent-console/ app/(shell)/agent-console/
git commit -m "feat: build Agent Console page with pipeline visualization and context panel"
```

---

### Task 18: Create the /api/agent/context endpoint

**Files:**
- Create: `app/api/agent/context/route.ts`

- [ ] **Step 1: Create the endpoint**

```ts
import { NextResponse } from "next/server";
import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";

const AGENT_DIR = process.cwd() + "/agent";

function listSkills(): string[] {
  const skillsDir = join(AGENT_DIR, "skills");
  try {
    return readdirSync(skillsDir).filter((name) => {
      try {
        return statSync(join(skillsDir, name)).isDirectory();
      } catch {
        return false;
      }
    });
  } catch {
    return [];
  }
}

function listKnowledgeFiles(): string[] {
  const knowledgeDir = join(AGENT_DIR, "knowledge");
  try {
    return readdirSync(knowledgeDir).filter((name) => {
      try {
        return !statSync(join(knowledgeDir, name)).isDirectory();
      } catch {
        return false;
      }
    });
  } catch {
    return [];
  }
}

function parseGuardrails(): string[] {
  const rulesPath = join(AGENT_DIR, "RULES.md");
  try {
    const content = readFileSync(rulesPath, "utf-8");
    // Extract numbered rules
    const lines = content.split("\n");
    return lines
      .filter((line) => /^\d+\.\s\*\*/.test(line.trim()))
      .map((line) => {
        const match = line.match(/\*\*(.+?)\*\*/);
        return match ? match[1] : line.trim().replace(/^\d+\.\s*/, "");
      })
      .slice(0, 6);
  } catch {
    return [];
  }
}

export async function GET() {
  return NextResponse.json({
    skills: listSkills(),
    dataFiles: listKnowledgeFiles(),
    guardrails: parseGuardrails(),
  });
}
```

- [ ] **Step 2: Verify**

```bash
curl http://localhost:3000/api/agent/context 2>/dev/null | python -m json.tool
```

Expected: JSON with skills array (variance-review, ar-followup, monthly-close, budget-reforecast), dataFiles array, guardrails array.

- [ ] **Step 3: Commit**

```bash
git add app/api/agent/context/
git commit -m "feat: add /api/agent/context endpoint for Agent Console sidebar"
```

---

## Phase 4: Journey Pages

### Task 19: Create the journey page template and chat panel

**Files:**
- Create: `components/journey/journey-page.tsx`
- Create: `components/journey/journey-chat-panel.tsx`
- Create: `components/journey/nudge-chips.tsx`

- [ ] **Step 1: Create nudge-chips.tsx**

```tsx
"use client";

interface NudgeChipsProps {
  nudges: string[];
  onSelect: (nudge: string) => void;
}

export function NudgeChips({ nudges, onSelect }: NudgeChipsProps) {
  return (
    <div className="flex flex-wrap gap-2 px-4 py-2">
      {nudges.map((nudge) => (
        <button
          key={nudge}
          onClick={() => onSelect(nudge)}
          className="text-xs px-3 py-1.5 rounded-full border border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors"
        >
          {nudge}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create journey-chat-panel.tsx**

```tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useChatStream } from "@/hooks/use-chat-stream";
import { ChatInput } from "@/components/agent-console/chat-input";
import { NudgeChips } from "./nudge-chips";
import { PipelineContainer } from "@/components/pipeline/pipeline-container";

interface JourneyChatPanelProps {
  journeyId: string;
  nudges: string[];
}

export function JourneyChatPanel({ journeyId, nudges }: JourneyChatPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data?.userId) setUserId(data.userId); });
  }, []);

  const { messages, pipelineSteps, isStreaming, sendMessage, stopStream } = useChatStream(userId);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = (msg: string) => {
    if (!expanded) setExpanded(true);
    sendMessage(msg, { journeyId });
  };

  return (
    <div className="border-t border-border bg-card">
      {/* Expand/collapse toggle */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-center gap-1 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        {expanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        {expanded ? "Collapse chat" : "Ask about this journey..."}
      </button>

      {expanded && (
        <div className="flex flex-col h-[40vh]">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-2 space-y-3">
            {messages.map((msg) => (
              <div key={msg.id} className={msg.role === "user" ? "flex justify-end" : "flex justify-start"}>
                {msg.role === "user" ? (
                  <div className="bg-primary text-primary-foreground rounded-xl px-3 py-2 text-xs max-w-[70%]">
                    {msg.content}
                  </div>
                ) : (
                  <div className="max-w-[85%]">
                    {pipelineSteps.length > 0 && (
                      <div className="mb-1 text-[11px]">
                        <PipelineContainer steps={pipelineSteps} isStreaming={isStreaming} />
                      </div>
                    )}
                    {msg.content && (
                      <div className="bg-background border border-border rounded-xl px-3 py-2 text-xs doc-body">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Nudges */}
          {messages.length === 0 && <NudgeChips nudges={nudges} onSelect={handleSend} />}

          {/* Input */}
          <ChatInput
            onSend={handleSend}
            onStop={stopStream}
            isStreaming={isStreaming}
            placeholder={`Ask about this journey...`}
          />
        </div>
      )}

      {/* Collapsed input */}
      {!expanded && (
        <NudgeChips nudges={nudges.slice(0, 3)} onSelect={handleSend} />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create journey-page.tsx**

```tsx
import type { LucideIcon } from "lucide-react";
import { JourneyChatPanel } from "./journey-chat-panel";

interface JourneyPageProps {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  nudges: string[];
  children: React.ReactNode;
}

export function JourneyPage({ id, title, description, icon: Icon, nudges, children }: JourneyPageProps) {
  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] -mx-8 -mt-8 -mb-4">
      {/* Header */}
      <div className="px-8 py-6 border-b border-border">
        <div className="flex items-center gap-3">
          <Icon size={28} className="text-muted-foreground" />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight" style={{ fontFamily: "var(--font-playfair)" }}>
              {title}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        {children}
      </div>

      {/* Chat panel */}
      <JourneyChatPanel journeyId={id} nudges={nudges} />
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add components/journey/
git commit -m "feat: add journey page template with docked chat panel and nudge chips"
```

---

### Task 20: Create the 6 journey pages

**Files:**
- Create: `app/(shell)/monthly-close/page.tsx`
- Create: `app/(shell)/financial-reconciliation/page.tsx`
- Create: `app/(shell)/regulatory-capital/page.tsx`
- Create: `app/(shell)/ifrs9-ecl/page.tsx`
- Create: `app/(shell)/daily-liquidity/page.tsx`
- Create: `app/(shell)/regulatory-returns/page.tsx`
- Create: `lib/config/journey-sample-data.ts`

- [ ] **Step 1: Create journey-sample-data.ts**

This file contains all the sample data constants for the 6 journey pages. It's a large file but centralizes all demo data.

```ts
// Monthly Close
export const MONTHLY_CLOSE_STEPS = [
  { name: "Sub-ledger Close", completed: 14, total: 14 },
  { name: "Interco Recon", completed: 8, total: 8 },
  { name: "Journal Entries", completed: 42, total: 56 },
  { name: "Consolidation", completed: 0, total: 3 },
  { name: "Reporting Package", completed: 0, total: 1 },
];

export const MONTHLY_CLOSE_BLOCKERS = [
  "Frankfurt entity — 3 unreconciled interco positions (¥12.4B)",
  "Tokyo HQ — 14 journal entries pending controller review",
  "London Branch — FX hedge rollover awaiting CFO sign-off",
];

// Financial Reconciliation
export const RECON_METRICS = [
  { label: "Matched", value: "4,105", sublabel: "transactions" },
  { label: "Match Rate", value: "94.85%", sublabel: "+1.2% vs prior" },
  { label: "Exceptions", value: "223", sublabel: "47 > 30 days" },
  { label: "Exposure", value: "¥47.2M", sublabel: "8 genuine errors" },
];

export const RECON_EXCEPTIONS = [
  { ref: "TXN-8847", amount: "¥12.3M", type: "Missing", age: "45 days", entity: "Tokyo HQ" },
  { ref: "TXN-9012", amount: "¥8.7M", type: "Timing", age: "12 days", entity: "London" },
  { ref: "TXN-9103", amount: "¥6.2M", type: "Error", age: "38 days", entity: "Frankfurt" },
  { ref: "TXN-9210", amount: "¥4.8M", type: "Fee", age: "7 days", entity: "Singapore" },
  { ref: "TXN-9315", amount: "¥3.1M", type: "Missing", age: "52 days", entity: "New York" },
];

// Regulatory Capital
export const CAPITAL_RATIOS = [
  { label: "CET1", value: "13.2%", minimum: "4.5%", status: "above" as const },
  { label: "Tier 1", value: "15.1%", minimum: "6.0%", status: "above" as const },
  { label: "Total Capital", value: "17.8%", minimum: "8.0%", status: "above" as const },
];

// IFRS 9 ECL
export const ECL_STAGES = [
  { stage: "Stage 1 (Performing)", amount: "¥847.2B", pct: 89.4, delta: "-0.3%" },
  { stage: "Stage 2 (Under-performing)", amount: "¥85.1B", pct: 9.0, delta: "+0.8%" },
  { stage: "Stage 3 (Non-performing)", amount: "¥15.3B", pct: 1.6, delta: "+0.3%" },
];

export const ECL_MIGRATIONS = [
  { from: "Stage 1", to: "Stage 2", amount: "¥12.3B", delta: "+0.8%" },
  { from: "Stage 2", to: "Stage 3", amount: "¥2.1B", delta: "+0.3%" },
];

// Daily Liquidity
export const LIQUIDITY_METRICS = [
  { label: "LCR", value: "141%", minimum: "100%", delta: "+3%" },
  { label: "NSFR", value: "118%", minimum: "100%", delta: "-1%" },
  { label: "Cash Position", value: "¥234.5B", minimum: null, delta: "+¥12.3B" },
];

// Regulatory Returns
export const FILING_STATUS = [
  { name: "COREP", status: "draft" as const, due: "2026-04-30", completion: 45 },
  { name: "FINREP", status: "submitted" as const, due: "2026-04-15", completion: 100 },
  { name: "FR Y-9C", status: "validated" as const, due: "2026-05-15", completion: 78 },
  { name: "FRTB IMA", status: "draft" as const, due: "2026-06-30", completion: 15 },
];
```

- [ ] **Step 2: Create monthly-close/page.tsx**

```tsx
import { Calendar, CheckCircle } from "lucide-react";
import { JourneyPage } from "@/components/journey/journey-page";
import { MONTHLY_CLOSE_STEPS, MONTHLY_CLOSE_BLOCKERS } from "@/lib/config/journey-sample-data";

export default function MonthlyClosePage() {
  const totalCompleted = MONTHLY_CLOSE_STEPS.reduce((acc, s) => acc + s.completed, 0);
  const totalItems = MONTHLY_CLOSE_STEPS.reduce((acc, s) => acc + s.total, 0);
  const pct = Math.round((totalCompleted / totalItems) * 100);

  return (
    <JourneyPage
      id="monthly-close"
      title="Monthly Close"
      description="Consolidation, trial balances, sub-ledger postings & close calendar"
      icon={Calendar}
      nudges={["Are we on track for close?", "What's still open?", "Draft board commentary"]}
    >
      {/* Day indicator */}
      <div className="flex items-center gap-3 mb-6">
        <span className="text-lg font-semibold" style={{ fontFamily: "var(--font-playfair)" }}>
          Monthly Close — Day 3 of 5
        </span>
        <span className="text-sm text-muted-foreground">{pct}% complete</span>
      </div>

      {/* Progress steps */}
      <div className="grid grid-cols-5 gap-3 mb-8">
        {MONTHLY_CLOSE_STEPS.map((step) => {
          const done = step.completed === step.total;
          const inProgress = step.completed > 0 && !done;
          return (
            <div
              key={step.name}
              className={`bg-card border rounded-[var(--radius)] p-4 text-center ${
                done ? "border-success/30" : inProgress ? "border-warning/30" : "border-border"
              }`}
            >
              <div className="text-xs text-muted-foreground mb-1">{step.name}</div>
              <div className="text-lg font-semibold" style={{ fontFamily: "var(--font-playfair)" }}>
                {step.completed}/{step.total}
              </div>
              {done && <CheckCircle size={14} className="mx-auto mt-1 text-success" />}
            </div>
          );
        })}
      </div>

      {/* Blocking items */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3" style={{ fontFamily: "var(--font-playfair)" }}>
          Blocking Items
        </h3>
        <div className="space-y-2">
          {MONTHLY_CLOSE_BLOCKERS.map((item, i) => (
            <div key={i} className="flex items-start gap-2 text-sm text-muted-foreground bg-card border border-border rounded-[var(--radius)] px-4 py-3">
              <span className="w-2 h-2 rounded-full bg-warning mt-1.5 shrink-0" />
              {item}
            </div>
          ))}
        </div>
      </div>
    </JourneyPage>
  );
}
```

- [ ] **Step 3: Create the remaining 5 journey pages**

Create `app/(shell)/financial-reconciliation/page.tsx`:

```tsx
import { RefreshCw } from "lucide-react";
import { JourneyPage } from "@/components/journey/journey-page";
import { MetricCard } from "@/components/shared/metric-card";
import { RECON_METRICS, RECON_EXCEPTIONS } from "@/lib/config/journey-sample-data";

export default function FinancialReconciliationPage() {
  return (
    <JourneyPage
      id="financial-reconciliation"
      title="Financial Reconciliation"
      description="GL vs sub-ledger matching, break identification & ageing analysis"
      icon={RefreshCw}
      nudges={["Show unmatched items", "Why is the match rate low?", "Classify exceptions"]}
    >
      <div className="grid grid-cols-4 gap-4 mb-8">
        {RECON_METRICS.map((m) => (
          <MetricCard key={m.label} value={m.value} label={m.label} sublabel={m.sublabel} />
        ))}
      </div>

      <h3 className="text-sm font-semibold mb-3" style={{ fontFamily: "var(--font-playfair)" }}>
        Top Exceptions
      </h3>
      <div className="bg-card border border-border rounded-[var(--radius)] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-4 py-2.5 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Ref</th>
              <th className="text-left px-4 py-2.5 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Amount</th>
              <th className="text-left px-4 py-2.5 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Type</th>
              <th className="text-left px-4 py-2.5 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Age</th>
              <th className="text-left px-4 py-2.5 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Entity</th>
            </tr>
          </thead>
          <tbody>
            {RECON_EXCEPTIONS.map((ex) => (
              <tr key={ex.ref} className="border-b border-border last:border-b-0 hover:bg-secondary/30">
                <td className="px-4 py-2.5 font-mono text-xs">{ex.ref}</td>
                <td className="px-4 py-2.5 font-semibold">{ex.amount}</td>
                <td className="px-4 py-2.5">{ex.type}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{ex.age}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{ex.entity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </JourneyPage>
  );
}
```

Create `app/(shell)/regulatory-capital/page.tsx`:

```tsx
import { Landmark } from "lucide-react";
import { JourneyPage } from "@/components/journey/journey-page";
import { CAPITAL_RATIOS } from "@/lib/config/journey-sample-data";

export default function RegulatoryCapitalPage() {
  return (
    <JourneyPage
      id="regulatory-capital"
      title="Regulatory Capital"
      description="CET1, RWA, leverage ratios & Basel III compliance assessment"
      icon={Landmark}
      nudges={["Are we above minimums?", "What drives RWA?", "CET1 trend"]}
    >
      <div className="flex items-center gap-2 mb-6">
        <span className="text-xs font-medium text-success bg-success/10 px-2 py-1 rounded-full">All above minimum</span>
      </div>
      <div className="grid grid-cols-3 gap-6">
        {CAPITAL_RATIOS.map((ratio) => (
          <div key={ratio.label} className="bg-card border border-border rounded-[var(--radius)] p-6 text-center">
            <div className="text-3xl font-semibold text-foreground" style={{ fontFamily: "var(--font-playfair)" }}>
              {ratio.value}
            </div>
            <div className="text-sm font-medium text-foreground mt-1">{ratio.label}</div>
            <div className="text-xs text-muted-foreground mt-2">Min. required: {ratio.minimum}</div>
            <div className="w-full bg-border/50 rounded-full h-2 mt-3">
              <div
                className="bg-success rounded-full h-2"
                style={{ width: `${Math.min((parseFloat(ratio.value) / 20) * 100, 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </JourneyPage>
  );
}
```

Create `app/(shell)/ifrs9-ecl/page.tsx`:

```tsx
import { BarChart3 } from "lucide-react";
import { JourneyPage } from "@/components/journey/journey-page";
import { ECL_STAGES, ECL_MIGRATIONS } from "@/lib/config/journey-sample-data";

export default function Ifrs9EclPage() {
  return (
    <JourneyPage
      id="ifrs9-ecl"
      title="IFRS 9 ECL"
      description="Expected credit loss staging, PD/LGD models & macro overlays"
      icon={BarChart3}
      nudges={["Stage 2 migration drivers?", "Update PD models", "Macro overlay impact"]}
    >
      <h3 className="text-sm font-semibold mb-4" style={{ fontFamily: "var(--font-playfair)" }}>
        Stage Distribution
      </h3>
      <div className="space-y-3 mb-8">
        {ECL_STAGES.map((stage) => (
          <div key={stage.stage} className="bg-card border border-border rounded-[var(--radius)] px-4 py-3 flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium">{stage.stage}</div>
              <div className="text-xs text-muted-foreground">{stage.amount} ({stage.pct}%)</div>
            </div>
            <div className="w-48 bg-border/50 rounded-full h-2">
              <div className="bg-primary rounded-full h-2" style={{ width: `${stage.pct}%` }} />
            </div>
            <span className={`text-xs font-medium ${stage.delta.startsWith("+") ? "text-warning" : "text-success"}`}>
              {stage.delta}
            </span>
          </div>
        ))}
      </div>

      <h3 className="text-sm font-semibold mb-3" style={{ fontFamily: "var(--font-playfair)" }}>
        Stage Migration
      </h3>
      <div className="grid grid-cols-2 gap-4">
        {ECL_MIGRATIONS.map((m) => (
          <div key={`${m.from}-${m.to}`} className="bg-card border border-border rounded-[var(--radius)] p-4">
            <div className="text-xs text-muted-foreground">{m.from} → {m.to}</div>
            <div className="text-lg font-semibold mt-1" style={{ fontFamily: "var(--font-playfair)" }}>{m.amount}</div>
            <div className="text-xs text-warning font-medium">{m.delta}</div>
          </div>
        ))}
      </div>
    </JourneyPage>
  );
}
```

Create `app/(shell)/daily-liquidity/page.tsx`:

```tsx
import { Droplets } from "lucide-react";
import { JourneyPage } from "@/components/journey/journey-page";
import { LIQUIDITY_METRICS } from "@/lib/config/journey-sample-data";

export default function DailyLiquidityPage() {
  return (
    <JourneyPage
      id="daily-liquidity"
      title="Daily Liquidity"
      description="LCR, NSFR, cash flow forecasting & intraday position monitoring"
      icon={Droplets}
      nudges={["Current LCR?", "Cash forecast next 7 days", "Intraday stress"]}
    >
      <div className="grid grid-cols-3 gap-6">
        {LIQUIDITY_METRICS.map((m) => (
          <div key={m.label} className="bg-card border border-border rounded-[var(--radius)] p-6">
            <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium">{m.label}</div>
            <div className="text-3xl font-semibold mt-2" style={{ fontFamily: "var(--font-playfair)" }}>
              {m.value}
            </div>
            <div className="flex items-center gap-2 mt-2">
              {m.minimum && <span className="text-xs text-muted-foreground">Min. required: {m.minimum}</span>}
              <span className={`text-xs font-medium ${m.delta.startsWith("+") ? "text-success" : "text-warning"}`}>
                {m.delta}
              </span>
            </div>
          </div>
        ))}
      </div>
    </JourneyPage>
  );
}
```

Create `app/(shell)/regulatory-returns/page.tsx`:

```tsx
import { FileText } from "lucide-react";
import { JourneyPage } from "@/components/journey/journey-page";
import { StatusBadge } from "@/components/shared/status-badge";
import { FILING_STATUS } from "@/lib/config/journey-sample-data";

const STATUS_MAP = { draft: "draft" as const, submitted: "running" as const, validated: "active" as const };

export default function RegulatoryReturnsPage() {
  return (
    <JourneyPage
      id="regulatory-returns"
      title="Regulatory Returns"
      description="COREP, FINREP, FR Y-9C filing preparation & validation"
      icon={FileText}
      nudges={["Filing status?", "What's blocking COREP?", "Validate FR Y-9C"]}
    >
      <div className="bg-card border border-border rounded-[var(--radius)] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-4 py-2.5 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Filing</th>
              <th className="text-left px-4 py-2.5 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Status</th>
              <th className="text-left px-4 py-2.5 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Due Date</th>
              <th className="text-left px-4 py-2.5 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Completion</th>
            </tr>
          </thead>
          <tbody>
            {FILING_STATUS.map((f) => (
              <tr key={f.name} className="border-b border-border last:border-b-0 hover:bg-secondary/30">
                <td className="px-4 py-3 font-medium">{f.name}</td>
                <td className="px-4 py-3"><StatusBadge status={STATUS_MAP[f.status]} /></td>
                <td className="px-4 py-3 text-muted-foreground">{f.due}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-24 bg-border/50 rounded-full h-2">
                      <div className="bg-primary rounded-full h-2" style={{ width: `${f.completion}%` }} />
                    </div>
                    <span className="text-xs text-muted-foreground">{f.completion}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </JourneyPage>
  );
}
```

- [ ] **Step 4: Verify all journey pages render**

Navigate to each: `/monthly-close`, `/financial-reconciliation`, `/regulatory-capital`, `/ifrs9-ecl`, `/daily-liquidity`, `/regulatory-returns`. Each should show the header, sample content, and collapsed chat panel at bottom.

- [ ] **Step 5: Commit**

```bash
git add lib/config/journey-sample-data.ts app/(shell)/monthly-close/ app/(shell)/financial-reconciliation/ app/(shell)/regulatory-capital/ app/(shell)/ifrs9-ecl/ app/(shell)/daily-liquidity/ app/(shell)/regulatory-returns/
git commit -m "feat: add 6 journey pages with sample data and scoped chat panels"
```

---

## Phase 5: Build Pages (Sample Data Shells)

Phases 5 and 6 follow the same pattern — each page is a self-contained shell with hardcoded sample data. These are large but mechanical tasks. I'll define them at a higher granularity since each is an independent page.

### Task 21: Create Agent Studio shell

**Files:**
- Create: `app/(shell)/agent-studio/page.tsx`
- Create: `lib/config/sample-build-data.ts`

- [ ] **Step 1: Create sample-build-data.ts** with all Build section sample data (agents, skills, integrations, flows). This is a large constants file — see spec Part 7 for all data shapes.

- [ ] **Step 2: Create the Agent Studio page** with 3 agent cards in a 2-col grid, stats rows, skill chips, disabled action buttons with toast.

- [ ] **Step 3: Commit**

```bash
git add lib/config/sample-build-data.ts app/(shell)/agent-studio/
git commit -m "feat: add Agent Studio shell page with sample agent cards"
```

### Task 22: Create Skills Manager shell

**Files:**
- Create: `app/(shell)/skills-manager/page.tsx`

- [ ] **Step 1: Create the page** — 3-col grid of skill cards. Reads actual skill names from `/api/agent/context` for existing skills, supplements with sample data. Click opens modal with skill content.

- [ ] **Step 2: Commit**

```bash
git add app/(shell)/skills-manager/
git commit -m "feat: add Skills Manager shell page with skill cards and detail modal"
```

### Task 23: Create Knowledge Base shell with D3 wiki graph

**Files:**
- Create: `app/(shell)/knowledge-base/page.tsx`
- Create: `components/build/wiki-graph.tsx`

- [ ] **Step 1: Create wiki-graph.tsx** — D3 force-directed graph with ~15 sample nodes (teal entities, blue concepts, purple syntheses). Zoomable, pannable, draggable nodes. Click opens side panel with sample markdown content.

- [ ] **Step 2: Create the Knowledge Base page** — Two tabs (Sources | Wiki). Sources lists files. Wiki tab renders the D3 graph.

- [ ] **Step 3: Commit**

```bash
git add components/build/wiki-graph.tsx app/(shell)/knowledge-base/
git commit -m "feat: add Knowledge Base shell with D3 wiki graph visualization"
```

### Task 24: Create Integrations shell

**Files:**
- Create: `app/(shell)/integrations/page.tsx`

- [ ] **Step 1: Create the page** — Composio section (9 integration cards) + Direct API section (2 cards). Connection status badges, action chips, disabled connect buttons.

- [ ] **Step 2: Commit**

```bash
git add app/(shell)/integrations/
git commit -m "feat: add Integrations shell page with Composio and direct API cards"
```

### Task 25: Create Skill Flows shell

**Files:**
- Create: `app/(shell)/skill-flows/page.tsx`
- Create: `components/build/flow-step-viz.tsx`

- [ ] **Step 1: Create flow-step-viz.tsx** — Progress dot visualization (○──○──○──🔒──○).

- [ ] **Step 2: Create the page** — Header stats, 3 flow cards with step visualization, Run/Edit/History buttons.

- [ ] **Step 3: Commit**

```bash
git add components/build/flow-step-viz.tsx app/(shell)/skill-flows/
git commit -m "feat: add Skill Flows shell page with flow cards and step visualization"
```

---

## Phase 6: Observe Pages (Sample Data Shells)

### Task 26: Create Decision Inbox shell

**Files:**
- Create: `app/(shell)/decision-inbox/page.tsx`
- Create: `components/observe/decision-tracing-svg.tsx`
- Create: `lib/config/sample-observe-data.ts`

- [ ] **Step 1: Create sample-observe-data.ts** — All Observe section sample data (decisions, runs, audit events). See spec Part 8.

- [ ] **Step 2: Create decision-tracing-svg.tsx** — SVG bezier-curve diagram with three columns: Agent Decision → 3 Compliance Check nodes (colored by verdict) → Output. Cubic bezier paths.

- [ ] **Step 3: Create the Decision Inbox page** — List view with metric cards, filter tabs, decision cards with colored left borders. Click opens detail view with SVG tracing diagram, evidence, compliance check cards.

- [ ] **Step 4: Commit**

```bash
git add lib/config/sample-observe-data.ts components/observe/ app/(shell)/decision-inbox/
git commit -m "feat: add Decision Inbox shell with SVG compliance tracing diagram"
```

### Task 27: Create Agent Runs shell

**Files:**
- Create: `app/(shell)/agent-runs/page.tsx`
- Create: `components/observe/execution-trace-panel.tsx`

- [ ] **Step 1: Create execution-trace-panel.tsx** — Right slide-over panel (Framer Motion) with metadata grid, I/O code blocks, safety metrics, step-by-step trace.

- [ ] **Step 2: Create the Agent Runs page** — Stats row (5 metrics), table with 7 sample runs, filter tabs, eye icon opens trace panel.

- [ ] **Step 3: Commit**

```bash
git add components/observe/execution-trace-panel.tsx app/(shell)/agent-runs/
git commit -m "feat: add Agent Runs shell with execution trace slide-over panel"
```

### Task 28: Create Compliance & Guardrails shell

**Files:**
- Create: `app/(shell)/compliance/page.tsx`

- [ ] **Step 1: Create the page** — Three tabs: Active Guardrails (MUST ALWAYS / MUST NEVER / ESCALATION cards, reads from actual RULES.md), Regulatory Frameworks, Validation Schedule.

- [ ] **Step 2: Commit**

```bash
git add app/(shell)/compliance/
git commit -m "feat: add Compliance & Guardrails shell with three-tab layout"
```

### Task 29: Create Audit Trail shell

**Files:**
- Create: `app/(shell)/audit-trail/page.tsx`

- [ ] **Step 1: Create the page** — Vertical timeline with 2px left line. Colored icons per event type. Sample events. Filter dropdowns. Export button (toast).

- [ ] **Step 2: Commit**

```bash
git add app/(shell)/audit-trail/
git commit -m "feat: add Audit Trail shell with vertical timeline"
```

---

## Phase 7: Cleanup and Polish

### Task 30: Delete deprecated components

**Files:**
- Delete: `components/feed/` (replaced by command-center/actions-required)
- Delete: `components/chat/` (replaced by agent-console/)
- Delete: `components/briefing/` (replaced by journey chat)
- Delete: `components/dashboard/` (budget-chart moved to journey or removed)

- [ ] **Step 1: Check for remaining imports**

```bash
grep -r "components/feed\|components/chat\|components/briefing\|components/dashboard" --include="*.tsx" --include="*.ts" app/ components/ | grep -v node_modules
```

If any remain, update those imports first.

- [ ] **Step 2: Delete deprecated directories**

```bash
rm -rf components/feed components/chat components/briefing components/dashboard
```

- [ ] **Step 3: Verify build**

```bash
npx next build 2>&1 | tail -10
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: delete deprecated dashboard components replaced by AgenticOS"
```

### Task 31: Final verification

- [ ] **Step 1: Run the dev server and test all routes**

```bash
npm run dev
```

Test each route:
- `/` — Command Center with search bar, journey cards, insights, actions
- `/agent-console` — Three-panel layout, chat works, pipeline steps render
- `/monthly-close` — Sample data + chat panel
- `/financial-reconciliation` — Metrics + exceptions table + chat
- `/regulatory-capital` — 3 ratio gauges + chat
- `/ifrs9-ecl` — Stage distribution + migration + chat
- `/daily-liquidity` — LCR/NSFR/Cash metrics + chat
- `/regulatory-returns` — Filing status table + chat
- `/agent-studio` — Agent cards with SAMPLE DATA badge
- `/skills-manager` — Skill cards
- `/knowledge-base` — D3 graph + sources
- `/integrations` — Integration cards
- `/skill-flows` — Flow cards with step viz
- `/decision-inbox` — Decision cards with SVG tracing
- `/agent-runs` — Table + trace panel
- `/compliance` — Three tabs
- `/audit-trail` — Timeline
- `/data-sources` — Existing page works in new shell
- `/documents` — Existing page works in new shell

- [ ] **Step 2: Test Command Center → Agent Console flow**

Type a message in the search bar on `/`. Verify it navigates to `/agent-console` and auto-sends the message.

- [ ] **Step 3: Test data upload → actions flow**

Upload a CSV on `/data-sources`. Verify actions appear in Command Center "Actions Required" section.

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: final polish and verification for AgenticOS rebuild"
```
