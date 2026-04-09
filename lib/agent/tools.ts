import { tool } from "gitclaw";
import { prisma } from "@/lib/db";

export function createFinancialTools(userId: string) {
  const searchRecords = tool(
    "search_records",
    "Query financial records by account name, period, or category. Returns matching records with actual vs budget figures.",
    {
      type: "object",
      properties: {
        account: {
          type: "string",
          description: "Account name or partial match (e.g., 'Marketing', 'SaaS')",
        },
        period: {
          type: "string",
          description: "Period to filter by (e.g., 'Jan 2025', 'Q1')",
        },
        category: {
          type: "string",
          description: "Category to filter by (e.g., 'OpEx', 'Revenue')",
        },
        dataSourceId: {
          type: "string",
          description: "Specific data source ID to search within",
        },
      },
      required: [],
    },
    async (args) => {
      const where: Record<string, unknown> = {
        dataSource: {
          userId,
          status: "ready",
          ...(args.dataSourceId ? { id: args.dataSourceId } : {}),
        },
      };

      if (args.account) {
        where.account = { contains: args.account };
      }
      if (args.period) {
        where.period = { contains: args.period };
      }
      if (args.category) {
        where.category = { contains: args.category };
      }

      const records = await prisma.financialRecord.findMany({
        where,
        include: { dataSource: { select: { name: true } } },
        take: 50,
      });

      if (records.length === 0) {
        return { text: "No matching records found.", details: { count: 0 } };
      }

      const formatted = records.map((r) => ({
        account: r.account,
        period: r.period,
        actual: r.actual,
        budget: r.budget,
        category: r.category,
        variancePercent:
          r.budget > 0
            ? (((r.actual - r.budget) / r.budget) * 100).toFixed(1)
            : "N/A",
        source: r.dataSource.name,
      }));

      return {
        text: `Found ${records.length} records:\n${formatted.map((r) => `- ${r.account} (${r.period}): $${(r.actual / 1000).toFixed(1)}K actual vs $${(r.budget / 1000).toFixed(1)}K budget (${r.variancePercent}% variance)`).join("\n")}`,
        details: { count: records.length, records: formatted },
      };
    }
  );

  const analyzeFinancialData = tool(
    "analyze_financial_data",
    "Analyze financial records to compute variances, identify trends, and flag anomalies. Use this for comprehensive analysis of uploaded data.",
    {
      type: "object",
      properties: {
        dataSourceId: {
          type: "string",
          description: "Data source ID to analyze. If omitted, analyzes all sources.",
        },
        category: {
          type: "string",
          description: "Focus analysis on a specific category",
        },
        threshold: {
          type: "number",
          description: "Variance threshold percentage to flag (default: 5)",
        },
      },
      required: [],
    },
    async (args) => {
      const threshold = args.threshold ?? 5;

      const where: Record<string, unknown> = {
        dataSource: {
          userId,
          status: "ready",
          ...(args.dataSourceId ? { id: args.dataSourceId } : {}),
        },
      };

      if (args.category) {
        where.category = { contains: args.category };
      }

      const records = await prisma.financialRecord.findMany({
        where,
        include: { dataSource: { select: { name: true } } },
      });

      if (records.length === 0) {
        return { text: "No financial records found to analyze.", details: {} };
      }

      const withVariance = records
        .filter((r) => r.budget > 0)
        .map((r) => ({
          account: r.account,
          period: r.period,
          actual: r.actual,
          budget: r.budget,
          category: r.category,
          variance: r.actual - r.budget,
          variancePercent: ((r.actual - r.budget) / r.budget) * 100,
          source: r.dataSource.name,
        }));

      const flagged = withVariance
        .filter((r) => Math.abs(r.variancePercent) > threshold)
        .sort((a, b) => Math.abs(b.variancePercent) - Math.abs(a.variancePercent));

      const totalActual = withVariance.reduce((s, r) => s + r.actual, 0);
      const totalBudget = withVariance.reduce((s, r) => s + r.budget, 0);
      const totalVariance = totalActual - totalBudget;
      const totalVariancePct =
        totalBudget > 0 ? (totalVariance / totalBudget) * 100 : 0;

      // Group by category
      const byCategory = new Map<
        string,
        { actual: number; budget: number; count: number }
      >();
      for (const r of withVariance) {
        const existing = byCategory.get(r.category) ?? {
          actual: 0,
          budget: 0,
          count: 0,
        };
        existing.actual += r.actual;
        existing.budget += r.budget;
        existing.count += 1;
        byCategory.set(r.category, existing);
      }

      const categoryBreakdown = Array.from(byCategory.entries()).map(
        ([cat, data]) => ({
          category: cat,
          actual: data.actual,
          budget: data.budget,
          variance: data.actual - data.budget,
          variancePercent:
            data.budget > 0
              ? (((data.actual - data.budget) / data.budget) * 100).toFixed(1)
              : "N/A",
          lineItems: data.count,
        })
      );

      const summary = [
        `**Analysis of ${records.length} records** (threshold: ${threshold}%)`,
        `Total: $${(totalActual / 1000).toFixed(1)}K actual vs $${(totalBudget / 1000).toFixed(1)}K budget (${totalVariancePct.toFixed(1)}% overall variance)`,
        "",
        `**${flagged.length} items exceed ${threshold}% threshold:**`,
        ...flagged.map(
          (r) =>
            `- ${r.account} (${r.period}): ${r.variancePercent > 0 ? "+" : ""}${r.variancePercent.toFixed(1)}% ($${(r.variance / 1000).toFixed(1)}K)`
        ),
        "",
        "**By category:**",
        ...categoryBreakdown.map(
          (c) =>
            `- ${c.category}: $${(c.actual / 1000).toFixed(1)}K / $${(c.budget / 1000).toFixed(1)}K (${c.variancePercent}%, ${c.lineItems} items)`
        ),
      ].join("\n");

      return {
        text: summary,
        details: {
          totalRecords: records.length,
          flaggedCount: flagged.length,
          totalActual,
          totalBudget,
          totalVariance,
          totalVariancePct,
          flagged,
          categoryBreakdown,
        },
      };
    }
  );

  const createAction = tool(
    "create_action",
    "Create a new action item in the user's feed. Use when you identify a variance or anomaly that needs attention.",
    {
      type: "object",
      properties: {
        type: {
          type: "string",
          enum: ["variance", "anomaly", "recommendation"],
          description: "Type of action",
        },
        severity: {
          type: "string",
          enum: ["critical", "warning", "info"],
          description:
            "Severity: critical (>20% variance), warning (10-20%), info (5-10%)",
        },
        headline: {
          type: "string",
          description:
            "Short headline (e.g., 'Marketing over budget by 23.5%')",
        },
        detail: {
          type: "string",
          description: "Detail with dollar figures (e.g., '$45.2K actual vs $36.6K planned')",
        },
        driver: {
          type: "string",
          description: "What is driving this variance",
        },
        dataSourceId: {
          type: "string",
          description: "ID of the data source this action relates to",
        },
      },
      required: ["type", "severity", "headline", "detail", "driver", "dataSourceId"],
    },
    async (args) => {
      // Check for duplicates
      const existing = await prisma.action.findFirst({
        where: {
          userId,
          headline: args.headline,
          status: "pending",
        },
      });

      if (existing) {
        return {
          text: `Action already exists: "${existing.headline}" (${existing.id})`,
          details: { duplicate: true, existingId: existing.id },
        };
      }

      const action = await prisma.action.create({
        data: {
          userId,
          type: args.type,
          severity: args.severity,
          headline: args.headline,
          detail: args.detail,
          driver: args.driver,
          sourceDataSourceId: args.dataSourceId,
        },
      });

      return {
        text: `Created ${args.severity} action: "${args.headline}" (ID: ${action.id})`,
        details: { actionId: action.id },
      };
    }
  );

  const updateAction = tool(
    "update_action",
    "Update the status of an existing action (flag, dismiss, or keep pending).",
    {
      type: "object",
      properties: {
        actionId: {
          type: "string",
          description: "ID of the action to update",
        },
        status: {
          type: "string",
          enum: ["pending", "flagged", "dismissed"],
          description: "New status for the action",
        },
      },
      required: ["actionId", "status"],
    },
    async (args) => {
      const action = await prisma.action.findFirst({
        where: { id: args.actionId, userId },
      });

      if (!action) {
        return { text: `Action ${args.actionId} not found.`, details: {} };
      }

      await prisma.action.update({
        where: { id: args.actionId },
        data: { status: args.status },
      });

      return {
        text: `Updated action "${action.headline}" to ${args.status}.`,
        details: { actionId: args.actionId, newStatus: args.status },
      };
    }
  );

  const generateCommentary = tool(
    "generate_commentary",
    "Generate variance commentary text suitable for monthly reports or board decks. Returns formatted, export-ready text.",
    {
      type: "object",
      properties: {
        dataSourceId: {
          type: "string",
          description: "Data source to generate commentary for",
        },
        format: {
          type: "string",
          enum: ["summary", "detailed", "board"],
          description: "Output format: summary (3-5 bullets), detailed (full narrative), board (executive summary)",
        },
      },
      required: ["dataSourceId"],
    },
    async (args) => {
      const records = await prisma.financialRecord.findMany({
        where: { dataSourceId: args.dataSourceId },
      });

      const actions = await prisma.action.findMany({
        where: { userId, sourceDataSourceId: args.dataSourceId },
        orderBy: { severity: "asc" },
      });

      if (records.length === 0) {
        return { text: "No records found for this data source.", details: {} };
      }

      const totalActual = records.reduce((s, r) => s + r.actual, 0);
      const totalBudget = records.reduce((s, r) => s + r.budget, 0);
      const totalVariance = totalActual - totalBudget;
      const totalVariancePct =
        totalBudget > 0 ? (totalVariance / totalBudget) * 100 : 0;

      const critical = actions.filter((a) => a.severity === "critical");
      const warnings = actions.filter((a) => a.severity === "warning");

      const commentary = [
        `**Variance Commentary**`,
        "",
        `Overall performance: $${(totalActual / 1000).toFixed(1)}K actual vs $${(totalBudget / 1000).toFixed(1)}K budget (${totalVariancePct > 0 ? "+" : ""}${totalVariancePct.toFixed(1)}% variance).`,
        "",
        critical.length > 0
          ? `**Critical items (${critical.length}):** ${critical.map((a) => a.headline).join("; ")}`
          : "No critical variances identified.",
        "",
        warnings.length > 0
          ? `**Items requiring attention (${warnings.length}):** ${warnings.map((a) => a.headline).join("; ")}`
          : "No warning-level variances.",
        "",
        `**Recommended actions:**`,
        ...actions
          .filter((a) => a.status === "pending")
          .slice(0, 5)
          .map((a) => `- Review ${a.headline}: ${a.driver}`),
      ].join("\n");

      return {
        text: commentary,
        details: {
          totalActual,
          totalBudget,
          totalVariance,
          actionCount: actions.length,
          criticalCount: critical.length,
        },
      };
    }
  );

  const draftEmail = tool(
    "draft_email",
    "Draft a follow-up email about a specific variance or action item. Returns email text ready to copy.",
    {
      type: "object",
      properties: {
        actionId: {
          type: "string",
          description: "Action ID to draft email about",
        },
        recipient: {
          type: "string",
          description: "Who the email is addressed to (e.g., 'Marketing team lead')",
        },
        tone: {
          type: "string",
          enum: ["formal", "direct", "friendly"],
          description: "Email tone (default: direct)",
        },
      },
      required: ["actionId"],
    },
    async (args) => {
      const action = await prisma.action.findFirst({
        where: { id: args.actionId, userId },
      });

      if (!action) {
        return { text: `Action ${args.actionId} not found.`, details: {} };
      }

      const recipient = args.recipient ?? "the relevant team lead";
      const emailDraft = [
        `**To:** ${recipient}`,
        `**Subject:** Action Required — ${action.headline}`,
        "",
        `Hi,`,
        "",
        `During our variance review, we identified the following item that needs your attention:`,
        "",
        `**${action.headline}**`,
        `${action.detail}`,
        `Driver: ${action.driver}`,
        "",
        `Could you provide context on this variance and confirm whether any corrective action is planned? Specifically:`,
        `1. What drove this variance?`,
        `2. Is this a one-time item or expected to continue?`,
        `3. What adjustments, if any, should we reflect in the forecast?`,
        "",
        `Please respond by end of week so we can incorporate your input into the monthly close.`,
        "",
        `Thanks,`,
        `Finance Team`,
      ].join("\n");

      return {
        text: emailDraft,
        details: { actionId: action.id, headline: action.headline },
      };
    }
  );

  return [
    searchRecords,
    analyzeFinancialData,
    createAction,
    updateAction,
    generateCommentary,
    draftEmail,
  ];
}
