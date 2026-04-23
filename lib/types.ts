export type ActionType = "variance" | "anomaly" | "recommendation" | "ar_followup";
export type Severity = "critical" | "warning" | "info";
export type ActionStatus = "pending" | "flagged" | "dismissed" | "approved";
export type DataSourceType = "csv" | "sheets" | "gl" | "sub_ledger" | "fx" | "capital_components" | "rwa_breakdown";
export type DataSourceStatus = "processing" | "ready" | "error";
export type DocumentType = "variance_report" | "ar_summary";
export type MessageRole = "user" | "agent";

export interface Action {
  id: string;
  userId: string;
  type: ActionType;
  severity: Severity;
  headline: string;
  detail: string;
  driver: string;
  status: ActionStatus;
  sourceName: string;
  sourceDataSourceId: string;
  createdAt: Date;
  invoiceId?: string;
  draftBody?: string;
}

export interface ChatMessage {
  id: string;
  userId: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  actionId?: string;
}

export interface DataSource {
  id: string;
  userId: string;
  type: DataSourceType;
  name: string;
  status: DataSourceStatus;
  recordCount: number;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export interface Document {
  id: string;
  userId: string;
  type: DocumentType;
  title: string;
  body: string;
  dataSourceId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface User {
  id: string;
  lyzrAccountId: string;
  email: string;
  name: string;
  credits: number;
}

export interface StatsData {
  actions: { critical: number; warning: number; info: number; total: number };
  ar: { info: number; warning: number; critical: number; total: number } | null;
  topCategories: Array<{ category: string; variance: number; direction: "over" | "under" }>;
}

export interface BudgetChartData {
  category: string;
  actual: number;
  budget: number;
  variance: number;
}
