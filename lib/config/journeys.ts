import type { LucideIcon } from "lucide-react";
import {
  Home, Calendar, RefreshCw, Landmark, BarChart3, Droplets, FileText,
  Bot, Wrench, BookOpen, Plug, GitBranch, Inbox, Search, Shield,
  ClipboardList, Database, Settings, Check,
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
  { id: "actions", label: "Actions", icon: Check, path: "/actions" },
  { id: "data-sources", label: "Data Sources", icon: Database, path: "/data-sources" },
  { id: "documents", label: "Documents", icon: FileText, path: "/documents" },
  { id: "settings", label: "Settings", icon: Settings, path: "/settings" },
];
