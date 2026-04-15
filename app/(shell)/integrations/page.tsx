"use client";

import { SampleDataBadge } from "@/components/shared/sample-data-badge";
import { StatusBadge } from "@/components/shared/status-badge";

interface Integration {
  id: string;
  name: string;
  category: string;
  connected: boolean;
  actions: string[];
  auth?: string;
}

const INTEGRATIONS: Integration[] = [
  // Composio Integrations
  {
    id: "gmail",
    name: "Gmail",
    category: "Email",
    connected: true,
    actions: ["Search", "Send"],
  },
  {
    id: "google-calendar",
    name: "Google Calendar",
    category: "Calendar",
    connected: true,
    actions: ["List", "Create"],
  },
  {
    id: "sap",
    name: "SAP",
    category: "ERP",
    connected: false,
    actions: ["Query", "Export"],
  },
  {
    id: "oracle",
    name: "Oracle",
    category: "ERP",
    connected: false,
    actions: ["Query", "Export"],
  },
  {
    id: "quickbooks",
    name: "QuickBooks",
    category: "Accounting",
    connected: false,
    actions: ["Query", "Sync"],
  },
  {
    id: "xero",
    name: "Xero",
    category: "Accounting",
    connected: false,
    actions: ["Query", "Sync"],
  },
  {
    id: "netsuite",
    name: "NetSuite",
    category: "ERP",
    connected: false,
    actions: ["Query", "Export"],
  },
  {
    id: "blackline",
    name: "BlackLine",
    category: "Reconciliation",
    connected: false,
    actions: ["List", "Match"],
  },
  {
    id: "slack",
    name: "Slack",
    category: "Messaging",
    connected: true,
    actions: ["Send", "List"],
  },
  // Direct API
  {
    id: "google-sheets",
    name: "Google Sheets",
    category: "Spreadsheets",
    connected: false,
    actions: ["Read", "Write"],
    auth: "API Key",
  },
  {
    id: "custom-webhook",
    name: "Custom Webhook",
    category: "Generic",
    connected: false,
    actions: ["Post", "Get"],
    auth: "OAuth2",
  },
];

interface IntegrationCardProps {
  integration: Integration;
}

function IntegrationCard({ integration }: IntegrationCardProps) {
  const getIconColor = (id: string): string => {
    const colors: Record<string, string> = {
      gmail: "bg-red-500",
      "google-calendar": "bg-blue-500",
      sap: "bg-indigo-600",
      oracle: "bg-red-600",
      quickbooks: "bg-green-600",
      xero: "bg-blue-600",
      netsuite: "bg-indigo-500",
      blackline: "bg-purple-600",
      slack: "bg-blue-700",
      "google-sheets": "bg-green-500",
      "custom-webhook": "bg-gray-500",
    };
    return colors[id] || "bg-gray-500";
  };

  const getFirstLetter = (name: string): string => {
    return name.charAt(0).toUpperCase();
  };

  return (
    <div className="bg-bg-card border border-border rounded-[var(--radius)] p-4 hover:border-border/60 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold ${getIconColor(
            integration.id
          )}`}
        >
          {getFirstLetter(integration.name)}
        </div>
        <StatusBadge
          status={integration.connected ? "active" : "available"}
        />
      </div>

      {/* Name and Category */}
      <h3 className="text-sm font-semibold text-foreground mb-1">
        {integration.name}
      </h3>
      <p className="text-xs text-text-muted-foreground mb-3">
        {integration.category}
        {integration.auth && ` • ${integration.auth}`}
      </p>

      {/* Actions */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {integration.actions.map((action) => (
          <span
            key={action}
            className="inline-block px-2 py-1 text-[11px] text-text-muted-foreground bg-bg-card border border-border rounded-full cursor-not-allowed opacity-60"
          >
            {action}
          </span>
        ))}
      </div>

      {/* Button */}
      <button
        disabled
        className="w-full px-3 py-2 text-sm font-medium rounded-[var(--radius)] border border-border bg-bg-card text-text-muted-foreground cursor-not-allowed opacity-50 transition-colors hover:opacity-50"
      >
        {integration.connected ? "Configure" : "Connect"}
      </button>
    </div>
  );
}

export default function IntegrationsPage() {
  const composioIntegrations = INTEGRATIONS.slice(0, 9);
  const directApiIntegrations = INTEGRATIONS.slice(9);

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <h1
            className="text-[28px] font-semibold text-foreground"
            style={{ fontFamily: "var(--font-playfair)" }}
          >
            Integrations
          </h1>
          <SampleDataBadge />
        </div>
        <p className="text-sm text-text-muted-foreground">
          External systems the agent can talk to
        </p>
      </div>

      {/* Composio Integrations Section */}
      <div className="mb-10">
        <h2 className="text-base font-semibold text-foreground mb-4">
          Composio Integrations
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {composioIntegrations.map((integration) => (
            <IntegrationCard
              key={integration.id}
              integration={integration}
            />
          ))}
        </div>
      </div>

      {/* Direct API Section */}
      <div>
        <h2 className="text-base font-semibold text-foreground mb-4">
          Direct API
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {directApiIntegrations.map((integration) => (
            <IntegrationCard
              key={integration.id}
              integration={integration}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
