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

  const createActions = tool(
    "create_actions",
    "Create multiple action items in the user's feed in a single batch. Use this to bulk-create actions for all identified variances to save API requests.",
    {
      type: "object",
      properties: {
        actions: {
          type: "array",
          description: "List of actions to create",
          items: {
            type: "object",
            properties: {
              type: {
                type: "string",
                enum: ["variance", "anomaly", "recommendation"],
              },
              severity: {
                type: "string",
                enum: ["critical", "warning", "info"],
              },
              headline: { type: "string" },
              detail: { type: "string" },
              driver: { type: "string" },
              dataSourceId: { type: "string" },
            },
            required: ["type", "severity", "headline", "detail", "driver", "dataSourceId"],
          },
        },
      },
      required: ["actions"],
    },
    async (args) => {
      // Type definitions for the tool args
      type ToolAction = {
        type: string;
        severity: string;
        headline: string;
        detail: string;
        driver: string;
        dataSourceId: string;
      };

      const items = (args.actions as ToolAction[]) || [];

      if (!items || items.length === 0) {
        return { text: "No actions provided to create." };
      }

      // Check for duplicates
      const headlines = items.map((a) => a.headline);
      const existing = await prisma.action.findMany({
        where: {
          userId,
          headline: { in: headlines },
          status: "pending",
        },
        select: { headline: true },
      });
      const existingHeadlines = new Set(existing.map((e) => e.headline));

      const newActions = items.filter((a) => !existingHeadlines.has(a.headline));

      if (newActions.length === 0) {
        return { text: `All ${items.length} actions already exist (deduplicated by headline).` };
      }

      // Validate dataSourceIds exist before inserting
      const dsIds = [...new Set(newActions.map((a) => a.dataSourceId))];
      const validDs = await prisma.dataSource.findMany({
        where: { id: { in: dsIds }, userId },
        select: { id: true },
      });
      const validDsIds = new Set(validDs.map((d) => d.id));

      // Sanitize all records first, skip any with bad data
      const validTypes = ["variance", "anomaly", "recommendation"];
      const validSeverities = ["critical", "warning", "info"];
      const sanitized: Array<{
        userId: string;
        type: string;
        severity: string;
        headline: string;
        detail: string;
        driver: string;
        sourceDataSourceId: string;
      }> = [];

      for (const a of newActions) {
        if (!validDsIds.has(a.dataSourceId)) {
          console.warn(`[create_actions] Skipping "${a.headline}": invalid dataSourceId "${a.dataSourceId}"`);
          continue;
        }
        sanitized.push({
          userId,
          type: validTypes.includes(a.type) ? a.type : "variance",
          severity: validSeverities.includes(a.severity) ? a.severity : "warning",
          headline: a.headline,
          detail: a.detail,
          driver: a.driver,
          sourceDataSourceId: a.dataSourceId,
        });
      }

      if (sanitized.length === 0) {
        return { text: `No valid actions to create (${newActions.length} had invalid data source IDs).` };
      }

      // Batch insert with sanitized data; fall back to one-by-one on failure
      let created = 0;
      try {
        await prisma.action.createMany({ data: sanitized });
        created = sanitized.length;
      } catch (batchErr) {
        console.warn("[create_actions] Batch insert failed, falling back to individual inserts:", batchErr instanceof Error ? batchErr.message : batchErr);
        for (const row of sanitized) {
          try {
            await prisma.action.create({ data: row });
            created++;
          } catch (err) {
            console.error(`[create_actions] Failed for "${row.headline}":`, err instanceof Error ? err.message : err);
          }
        }
      }

      const skipped = newActions.length - sanitized.length;
      return {
        text: `Successfully created ${created} actions.${existingHeadlines.size > 0 ? ` (${existingHeadlines.size} deduplicated)` : ""}${skipped > 0 ? ` (${skipped} skipped: invalid data source)` : ""}`,
        details: { created, skipped: existingHeadlines.size + skipped },
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
          enum: ["pending", "flagged", "dismissed", "approved"],
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

  // ── AR Follow-up Tools ──────────────────────────────────────────────

  const scanArAging = tool(
    "scan_ar_aging",
    "Scan open invoices and bucket by days overdue. Returns eligible invoices grouped into info (1-14 days), warning (15-44 days), and critical (45+ days). Skips invoices in cooldown (dunned within 14 days) or snoozed.",
    {
      type: "object",
      properties: {
        dataSourceId: {
          type: "string",
          description: "Optional data source ID to limit scan to",
        },
      },
      required: [],
    },
    async (args) => {
      const now = new Date();
      const cooldownCutoff = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

      const invoices = await prisma.invoice.findMany({
        where: {
          dataSource: { userId, status: "ready" },
          status: "open",
          ...(args.dataSourceId ? { dataSourceId: args.dataSourceId } : {}),
        },
        include: { dataSource: { select: { name: true } } },
      });

      type BucketedInvoice = {
        id: string;
        invoiceNumber: string;
        customer: string;
        amount: number;
        daysOverdue: number;
        dueDate: string;
        sourceName: string;
      };

      const info: BucketedInvoice[] = [];
      const warning: BucketedInvoice[] = [];
      const critical: BucketedInvoice[] = [];
      const skipped: string[] = [];

      for (const inv of invoices) {
        // Skip if in cooldown (dunned within 14 days)
        if (inv.lastDunnedAt && inv.lastDunnedAt > cooldownCutoff) {
          skipped.push(`${inv.invoiceNumber}: dunned ${Math.floor((now.getTime() - inv.lastDunnedAt.getTime()) / 86400000)}d ago (cooldown)`);
          continue;
        }

        // Skip if snoozed
        if (inv.snoozedUntil && inv.snoozedUntil > now) {
          skipped.push(`${inv.invoiceNumber}: snoozed until ${inv.snoozedUntil.toISOString().split("T")[0]}`);
          continue;
        }

        const daysOverdue = Math.floor((now.getTime() - inv.dueDate.getTime()) / 86400000);
        if (daysOverdue < 1) {
          skipped.push(`${inv.invoiceNumber}: not yet overdue`);
          continue;
        }

        const entry: BucketedInvoice = {
          id: inv.id,
          invoiceNumber: inv.invoiceNumber,
          customer: inv.customer,
          amount: inv.amount,
          daysOverdue,
          dueDate: inv.dueDate.toISOString().split("T")[0],
          sourceName: inv.dataSource.name,
        };

        if (daysOverdue >= 45) critical.push(entry);
        else if (daysOverdue >= 15) warning.push(entry);
        else info.push(entry);
      }

      const totalOverdue = [...info, ...warning, ...critical].reduce((s, i) => s + i.amount, 0);

      const lines = [
        `**AR Aging Scan:** ${info.length + warning.length + critical.length} overdue invoices ($${(totalOverdue / 1000).toFixed(1)}K total)`,
        critical.length > 0 ? `\n**Critical (45+ days):** ${critical.map((i) => `[id=${i.id}] ${i.invoiceNumber} — ${i.customer} $${(i.amount / 1000).toFixed(1)}K (${i.daysOverdue}d)`).join("; ")}` : "",
        warning.length > 0 ? `\n**Warning (15-44 days):** ${warning.map((i) => `[id=${i.id}] ${i.invoiceNumber} — ${i.customer} $${(i.amount / 1000).toFixed(1)}K (${i.daysOverdue}d)`).join("; ")}` : "",
        info.length > 0 ? `\n**Info (1-14 days):** ${info.map((i) => `[id=${i.id}] ${i.invoiceNumber} — ${i.customer} $${(i.amount / 1000).toFixed(1)}K (${i.daysOverdue}d)`).join("; ")}` : "",
        skipped.length > 0 ? `\n**Skipped:** ${skipped.join("; ")}` : "",
      ].filter(Boolean).join("");

      return {
        text: lines,
        details: { bucketed: { info, warning, critical }, skipped },
      };
    }
  );

  const createArActions = tool(
    "create_ar_actions",
    "Create AR follow-up action items in the user's feed. Pass the invoice IDs and severity from scan_ar_aging — the tool resolves all display details (headline, amount, customer) from the database. Deduplicates by (invoiceId, status=pending).",
    {
      type: "object",
      properties: {
        actions: {
          type: "array",
          description: "List of AR actions to create. Only invoiceId and severity are required — headline/detail/driver are auto-generated from the invoice record.",
          items: {
            type: "object",
            properties: {
              invoiceId: { type: "string", description: "The invoice's database ID (cuid from scan_ar_aging [id=...] fields)" },
              severity: {
                type: "string",
                enum: ["critical", "warning", "info"],
                description: "Aging bucket severity from scan_ar_aging",
              },
              driver: { type: "string", description: "Optional reason/context for follow-up" },
            },
            required: ["invoiceId", "severity"],
          },
        },
      },
      required: ["actions"],
    },
    async (args) => {
      const rawItems = (args.actions as Record<string, unknown>[]) || [];
      if (rawItems.length === 0) {
        return { text: "No AR actions provided." };
      }

      // Resolve invoiceIds and build actions from authoritative DB data
      const items: Array<{
        invoiceId: string;
        severity: string;
        headline: string;
        detail: string;
        driver: string;
        dataSourceId: string;
      }> = [];

      const invoiceSelect = { id: true, invoiceNumber: true, customer: true, amount: true, dataSourceId: true, dueDate: true } as const;

      for (const raw of rawItems) {
        let invoiceId = String(raw.invoiceId || "");

        // Resolve: try direct ID first, then invoice number
        let invoice = invoiceId ? await prisma.invoice.findUnique({
          where: { id: invoiceId },
          select: invoiceSelect,
        }) : null;

        if (!invoice) {
          invoice = await prisma.invoice.findFirst({
            where: {
              invoiceNumber: invoiceId,
              dataSource: { userId },
            },
            orderBy: { createdAt: "desc" },
            select: invoiceSelect,
          });
        }

        if (!invoice) continue; // Skip unresolvable invoices

        const daysOverdue = Math.floor((Date.now() - invoice.dueDate.getTime()) / 86400000);

        // Severity: trust agent, fall back to bucket calculation
        let severity = raw.severity ? String(raw.severity).toLowerCase() : "";
        if (!["critical", "warning", "info"].includes(severity)) {
          severity = daysOverdue >= 45 ? "critical" : daysOverdue >= 15 ? "warning" : "info";
        }

        // Build display strings from authoritative invoice record
        items.push({
          invoiceId: invoice.id,
          severity,
          headline: `AR Follow-up: ${invoice.invoiceNumber} — ${invoice.customer} $${(invoice.amount / 1000).toFixed(1)}K`,
          detail: `Overdue invoice ${invoice.invoiceNumber} from ${invoice.customer} for $${invoice.amount.toLocaleString()} (${daysOverdue} days past due)`,
          driver: String(raw.driver || `Overdue invoice from ${invoice.customer}`),
          dataSourceId: invoice.dataSourceId,
        });
      }

      if (items.length === 0) {
        return { text: "No valid AR actions — could not resolve any invoice IDs." };
      }

      // Dedupe by (invoiceId, status=pending)
      const invoiceIds = items.map((a) => a.invoiceId);
      const existing = await prisma.action.findMany({
        where: {
          userId,
          invoiceId: { in: invoiceIds },
          status: "pending",
          type: "ar_followup",
        },
        select: { invoiceId: true },
      });
      const existingInvoiceIds = new Set(existing.map((e) => e.invoiceId));

      const newActions = items.filter((a) => !existingInvoiceIds.has(a.invoiceId));
      if (newActions.length === 0) {
        return { text: `All ${items.length} AR actions already exist (deduplicated by invoiceId).` };
      }

      // Insert one by one to handle partial failures gracefully
      let created = 0;
      for (const a of newActions) {
        try {
          await prisma.action.create({
            data: {
              userId,
              type: "ar_followup",
              severity: a.severity,
              headline: a.headline,
              detail: a.detail,
              driver: a.driver,
              sourceDataSourceId: a.dataSourceId,
              invoiceId: a.invoiceId,
            },
          });
          created++;
        } catch (err) {
          console.error(`[create_ar_actions] Failed for invoice ${a.invoiceId}:`, err instanceof Error ? err.message : err);
        }
      }

      return {
        text: `Created ${created} AR follow-up actions. (${existingInvoiceIds.size} skipped as duplicates)`,
        details: { created, skipped: existingInvoiceIds.size },
      };
    }
  );

  const draftDunningEmail = tool(
    "draft_dunning_email",
    "Draft a dunning/collection email for an overdue invoice. Tone defaults to the invoice's aging bucket. Writes the draft to the linked action's draftBody field. Does NOT send.",
    {
      type: "object",
      properties: {
        invoiceId: {
          type: "string",
          description: "Invoice ID to draft for",
        },
        tone: {
          type: "string",
          enum: ["friendly", "firm", "escalation"],
          description: "Email tone — defaults to bucket-appropriate tone",
        },
      },
      required: ["invoiceId"],
    },
    async (args) => {
      const invoice = await prisma.invoice.findUnique({
        where: { id: args.invoiceId },
      });

      if (!invoice) {
        return { text: `Error: Invoice ${args.invoiceId} not found.` };
      }

      const tone = args.tone ?? inferToneFromInvoice(invoice.dueDate);
      const body = buildDunningEmailBody(invoice, tone);

      // Write to the pending action's draftBody
      const action = await prisma.action.findFirst({
        where: {
          userId,
          invoiceId: args.invoiceId,
          status: "pending",
          type: "ar_followup",
        },
      });

      if (action) {
        await prisma.action.update({
          where: { id: action.id },
          data: { draftBody: body },
        });
      }

      return {
        text: body,
        details: { invoiceId: args.invoiceId, tone, actionId: action?.id },
      };
    }
  );

  const updateInvoiceStatus = tool(
    "update_invoice_status",
    "Update an invoice's status (sent, snoozed, escalated). Records an ActionEvent on the linked action.",
    {
      type: "object",
      properties: {
        invoiceId: {
          type: "string",
          description: "Invoice ID to update",
        },
        status: {
          type: "string",
          enum: ["sent", "snoozed", "escalated"],
          description: "New invoice status",
        },
        snoozedUntil: {
          type: "string",
          description: "ISO date for snooze expiry (required if status=snoozed)",
        },
      },
      required: ["invoiceId", "status"],
    },
    async (args) => {
      const invoice = await prisma.invoice.findUnique({
        where: { id: args.invoiceId },
      });

      if (!invoice) {
        return { text: `Error: Invoice ${args.invoiceId} not found.` };
      }

      const updateData: Record<string, unknown> = { status: args.status };
      if (args.status === "sent") {
        updateData.lastDunnedAt = new Date();
      }
      if (args.status === "snoozed" && args.snoozedUntil) {
        updateData.snoozedUntil = new Date(args.snoozedUntil);
      }

      await prisma.invoice.update({
        where: { id: args.invoiceId },
        data: updateData,
      });

      // Record ActionEvent on the linked action
      const action = await prisma.action.findFirst({
        where: {
          userId,
          invoiceId: args.invoiceId,
          type: "ar_followup",
        },
        orderBy: { createdAt: "desc" },
      });

      if (action) {
        await prisma.actionEvent.create({
          data: {
            actionId: action.id,
            userId,
            fromStatus: action.status,
            toStatus: args.status === "sent" ? "approved" : args.status === "snoozed" ? "dismissed" : "flagged",
          },
        });
      }

      return {
        text: `Invoice ${invoice.invoiceNumber} updated to "${args.status}".`,
        details: { invoiceId: args.invoiceId, newStatus: args.status },
      };
    }
  );

  const generateVarianceReport = tool(
    "generate_variance_report",
    "Gather all variance data for the agent to compose a Monthly Variance Report narrative. Returns records summary, top variances, category breakdown, and action counts by severity.",
    {
      type: "object",
      properties: {
        dataSourceId: {
          type: "string",
          description: "Optional data source ID. If omitted, uses all ready data sources.",
        },
      },
      required: [],
    },
    async (args) => {
      const dsWhere: Record<string, unknown> = { userId, status: "ready" };
      if (args.dataSourceId) dsWhere.id = args.dataSourceId;

      const [records, actions] = await Promise.all([
        prisma.financialRecord.findMany({
          where: { dataSource: dsWhere },
          include: { dataSource: { select: { name: true } } },
        }),
        prisma.action.findMany({
          where: {
            userId,
            type: "variance",
            ...(args.dataSourceId ? { sourceDataSourceId: args.dataSourceId } : {}),
          },
          orderBy: { severity: "asc" },
        }),
      ]);

      if (records.length === 0) {
        return { text: "No financial records found to generate report.", details: {} };
      }

      const totalActual = records.reduce((s, r) => s + r.actual, 0);
      const totalBudget = records.reduce((s, r) => s + r.budget, 0);
      const totalVariance = totalActual - totalBudget;
      const totalVariancePct = totalBudget > 0 ? (totalVariance / totalBudget) * 100 : 0;

      const byCategory = new Map<string, { actual: number; budget: number; count: number }>();
      for (const r of records) {
        const existing = byCategory.get(r.category) ?? { actual: 0, budget: 0, count: 0 };
        existing.actual += r.actual;
        existing.budget += r.budget;
        existing.count += 1;
        byCategory.set(r.category, existing);
      }
      const categoryBreakdown = Array.from(byCategory.entries()).map(([cat, data]) => ({
        category: cat,
        actual: data.actual,
        budget: data.budget,
        variance: data.actual - data.budget,
        variancePct: data.budget > 0 ? ((data.actual - data.budget) / data.budget * 100).toFixed(1) : "N/A",
        lineItems: data.count,
      }));

      const critical = actions.filter((a) => a.severity === "critical");
      const warning = actions.filter((a) => a.severity === "warning");
      const info = actions.filter((a) => a.severity === "info");

      const topVariances = actions
        .slice(0, 10)
        .map((a) => ({ headline: a.headline, detail: a.detail, driver: a.driver, severity: a.severity }));

      return {
        text: `Variance report data: ${records.length} records, ${actions.length} actions (${critical.length} critical, ${warning.length} warning, ${info.length} info). Total: $${(totalActual / 1000).toFixed(1)}K actual vs $${(totalBudget / 1000).toFixed(1)}K budget (${totalVariancePct.toFixed(1)}%).`,
        details: {
          totalRecords: records.length,
          totalActual,
          totalBudget,
          totalVariance,
          totalVariancePct,
          actionCounts: { critical: critical.length, warning: warning.length, info: info.length },
          categoryBreakdown,
          topVariances,
        },
      };
    }
  );

  const generateArSummary = tool(
    "generate_ar_summary",
    "Gather all AR/invoice data for the agent to compose an AR Aging Summary narrative. Returns total outstanding, aging buckets, dunning activity, and escalation candidates.",
    {
      type: "object",
      properties: {
        dataSourceId: {
          type: "string",
          description: "Optional data source ID. If omitted, uses all ready data sources.",
        },
      },
      required: [],
    },
    async (args) => {
      const dsWhere: Record<string, unknown> = { userId, status: "ready" };
      if (args.dataSourceId) dsWhere.id = args.dataSourceId;

      const [invoices, actions] = await Promise.all([
        prisma.invoice.findMany({
          where: { dataSource: dsWhere },
          include: { dataSource: { select: { name: true } } },
        }),
        prisma.action.findMany({
          where: {
            userId,
            type: "ar_followup",
            ...(args.dataSourceId ? { sourceDataSourceId: args.dataSourceId } : {}),
          },
        }),
      ]);

      if (invoices.length === 0) {
        return { text: "No invoices found to generate AR summary.", details: {} };
      }

      const now = new Date();
      const totalOutstanding = invoices.filter((i) => i.status === "open").reduce((s, i) => s + i.amount, 0);

      const buckets = { current: 0, days1to14: 0, days15to44: 0, days45plus: 0 };
      const bucketAmounts = { current: 0, days1to14: 0, days15to44: 0, days45plus: 0 };
      for (const inv of invoices.filter((i) => i.status === "open")) {
        const daysOverdue = Math.floor((now.getTime() - inv.dueDate.getTime()) / 86400000);
        if (daysOverdue < 1) { buckets.current++; bucketAmounts.current += inv.amount; }
        else if (daysOverdue < 15) { buckets.days1to14++; bucketAmounts.days1to14 += inv.amount; }
        else if (daysOverdue < 45) { buckets.days15to44++; bucketAmounts.days15to44 += inv.amount; }
        else { buckets.days45plus++; bucketAmounts.days45plus += inv.amount; }
      }

      const sent = actions.filter((a) => a.status === "approved").length;
      const snoozed = invoices.filter((i) => i.status === "snoozed").length;
      const escalated = invoices.filter((i) => i.status === "escalated").length;
      const pending = actions.filter((a) => a.status === "pending").length;

      const escalationCandidates = invoices
        .filter((i) => i.status === "open" && Math.floor((now.getTime() - i.dueDate.getTime()) / 86400000) >= 45)
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5)
        .map((i) => ({
          invoiceNumber: i.invoiceNumber,
          customer: i.customer,
          amount: i.amount,
          daysOverdue: Math.floor((now.getTime() - i.dueDate.getTime()) / 86400000),
        }));

      return {
        text: `AR summary data: ${invoices.length} invoices, $${(totalOutstanding / 1000).toFixed(1)}K outstanding. ${sent} sent, ${snoozed} snoozed, ${escalated} escalated, ${pending} pending.`,
        details: {
          totalInvoices: invoices.length,
          totalOutstanding,
          buckets,
          bucketAmounts,
          activity: { sent, snoozed, escalated, pending },
          escalationCandidates,
        },
      };
    }
  );

  const saveDocument = tool(
    "save_document",
    "Save an agent-generated report as a Document. Call this after composing a variance report or AR summary narrative.",
    {
      type: "object",
      properties: {
        type: {
          type: "string",
          enum: ["variance_report", "ar_summary"],
          description: "Document type",
        },
        title: {
          type: "string",
          description: "Document title (e.g., 'Monthly Variance Report — April 2026')",
        },
        body: {
          type: "string",
          description: "Full markdown body of the document",
        },
        dataSourceId: {
          type: "string",
          description: "Data source that triggered this report (optional)",
        },
      },
      required: ["type", "title", "body"],
    },
    async (args) => {
      const doc = await prisma.document.create({
        data: {
          userId,
          type: args.type,
          title: args.title,
          body: args.body,
          ...(args.dataSourceId ? { dataSourceId: args.dataSourceId } : {}),
        },
      });

      return {
        text: `Document saved: "${doc.title}" (ID: ${doc.id})`,
        details: { id: doc.id, title: doc.title, createdAt: doc.createdAt },
      };
    }
  );

  return [
    searchRecords,
    analyzeFinancialData,
    createActions,
    updateAction,
    generateCommentary,
    draftEmail,
    scanArAging,
    createArActions,
    draftDunningEmail,
    updateInvoiceStatus,
    generateVarianceReport,
    generateArSummary,
    saveDocument,
  ];
}

// ── Shared helpers (used by both agent tools and API routes) ───────

/** Infer dunning tone from invoice due date. */
export function inferToneFromInvoice(dueDate: Date): "friendly" | "firm" | "escalation" {
  const daysOverdue = Math.floor((Date.now() - dueDate.getTime()) / 86400000);
  if (daysOverdue >= 45) return "escalation";
  if (daysOverdue >= 15) return "firm";
  return "friendly";
}

/** Build dunning email body. Shared by the agent tool and the AR API route. */
export function buildDunningEmailBody(
  invoice: { invoiceNumber: string; customer: string; customerEmail?: string | null; amount: number; dueDate: Date },
  tone: "friendly" | "firm" | "escalation"
): string {
  const recipient = invoice.customerEmail || "the customer";
  const daysOverdue = Math.floor((Date.now() - invoice.dueDate.getTime()) / 86400000);
  const amountStr = `$${(invoice.amount / 1000).toFixed(1)}K`;

  if (tone === "friendly") {
    return [
      `To: ${recipient}`,
      `Subject: Friendly Reminder — Invoice ${invoice.invoiceNumber}`,
      "",
      `Hi ${invoice.customer},`,
      "",
      `This is a friendly reminder that invoice ${invoice.invoiceNumber} for ${amountStr} was due on ${invoice.dueDate.toISOString().split("T")[0]} (${daysOverdue} days ago).`,
      "",
      `If payment has already been sent, please disregard this note. Otherwise, could you confirm expected payment timing?`,
      "",
      `Thank you,`,
      `Finance Team`,
    ].join("\n");
  }

  if (tone === "firm") {
    return [
      `To: ${recipient}`,
      `Subject: Payment Overdue — Invoice ${invoice.invoiceNumber}`,
      "",
      `Dear ${invoice.customer},`,
      "",
      `Invoice ${invoice.invoiceNumber} for ${amountStr} is now ${daysOverdue} days past due (due date: ${invoice.dueDate.toISOString().split("T")[0]}).`,
      "",
      `We kindly request immediate attention to this outstanding balance. Please arrange payment at your earliest convenience or contact us to discuss payment terms.`,
      "",
      `Regards,`,
      `Finance Team`,
    ].join("\n");
  }

  // escalation
  return [
    `To: ${recipient}`,
    `Subject: URGENT — Invoice ${invoice.invoiceNumber} Significantly Overdue`,
    "",
    `Dear ${invoice.customer},`,
    "",
    `Invoice ${invoice.invoiceNumber} for ${amountStr} is now ${daysOverdue} days past due. Despite prior communications, this balance remains outstanding.`,
    "",
    `Please treat this as urgent. We require payment or a confirmed payment plan within 5 business days. Continued non-payment may affect your account status and credit terms.`,
    "",
    `If there are circumstances we should be aware of, please contact us immediately so we can find a resolution.`,
    "",
    `Regards,`,
    `Finance Team`,
  ].join("\n");
}
