export type ActionType = "variance" | "anomaly" | "recommendation";
export type Severity = "critical" | "warning" | "info";
export type ActionStatus = "pending" | "flagged" | "dismissed" | "approved";
export type DataSourceType = "csv" | "sheets";
export type DataSourceStatus = "processing" | "ready" | "error";
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

export interface User {
  id: string;
  lyzrAccountId: string;
  email: string;
  name: string;
  credits: number;
}
