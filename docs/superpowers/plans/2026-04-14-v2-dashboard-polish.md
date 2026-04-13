# V2 Dashboard Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish the dashboard with react-markdown documents, tabbed data sources with Google Sheets ingest, stats strip, compact action cards with slide-over modals, and a Budget vs Actual chart replacing the briefing panel.

**Architecture:** Four groups executed sequentially: A (document viewer fixes), B (tabbed data sources + Google Sheets CSV-export + re-analyze), C (stats strip + compact cards + modal), D (Recharts budget chart + briefing-to-chat migration). Each group commits independently.

**Tech Stack:** Next.js 16.2 (App Router), React 19, Prisma 6 (SQLite), Tailwind v4 (CSS vars), react-markdown, recharts, Vitest, lucide-react

---

## File Map

### Group A — Document Polish
| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `app/globals.css` | Add `.doc-body` prose classes |
| Modify | `components/documents/document-viewer.tsx` | Replace manual markdown parser with `ReactMarkdown` |
| Modify | `app/(dashboard)/documents/page.tsx` | Error banners + race condition fix |

### Group B — Tabbed Data Sources + Google Sheets + Re-analyze
| Action | File | Responsibility |
|--------|------|----------------|
| Create | `lib/csv/variance-parser.ts` | Extracted `parseCSV`, `autoDetectColumns`, `parseRows` |
| Modify | `app/api/upload/route.ts` | Import from extracted module |
| Modify | `app/api/data-sources/route.ts` | Add `?shape=` filter |
| Create | `app/api/data-sources/link-sheet/route.ts` | Google Sheets CSV export ingest |
| Create | `app/api/data-sources/[id]/reanalyze/route.ts` | Re-analyze trigger |
| Create | `components/data-sources/link-sheet-area.tsx` | Google Sheets URL input form |
| Modify | `components/data-sources/source-list.tsx` | Re-analyze button per source |
| Modify | `app/(dashboard)/data-sources/page.tsx` | Tabbed layout + link handler |

### Group C — Stats Strip + Compact Cards + Modal
| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `lib/types.ts` | Add `StatsData`, `BudgetChartData` types |
| Create | `app/api/stats/route.ts` | Aggregated stats endpoint |
| Create | `components/feed/stats-strip.tsx` | Pure-CSS stats strip |
| Create | `components/feed/action-modal.tsx` | Slide-over modal (portal) |
| Modify | `components/feed/action-card.tsx` | Rewrite to compact 52px row |
| Modify | `components/feed/action-feed.tsx` | Wire stats + card selection |

### Group D — Budget Chart + Briefing-in-Chat
| Action | File | Responsibility |
|--------|------|----------------|
| Create | `app/api/chart/budget-vs-actual/route.ts` | Chart data endpoint |
| Create | `components/dashboard/budget-chart.tsx` | Recharts bar chart |
| Modify | `app/(dashboard)/page.tsx` | Replace briefing with chart, inject briefing into chat |

---

## Task 1: Install dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install react-markdown and recharts**

```bash
npm install react-markdown recharts
```

- [ ] **Step 2: Verify Next.js dev server starts**

```bash
npm run dev
```

Expected: compiles without errors. If react-markdown causes ESM issues, that will be handled in Task 2.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install react-markdown and recharts"
```

---

## Task 2: A1 — react-markdown in document viewer

**Files:**
- Modify: `app/globals.css:42` (append after line 41)
- Modify: `components/documents/document-viewer.tsx:1-79`
- Possibly modify: `next.config.ts:1-7`

- [ ] **Step 1: Add `.doc-body` prose styles to `app/globals.css`**

Append after the closing `}` of `@theme inline` block (after line 41):

```css
@layer components {
  .doc-body h1 { @apply text-lg font-bold mt-4 mb-2 text-text-primary; }
  .doc-body h2 { @apply text-base font-semibold mt-3 mb-1.5 text-text-primary; }
  .doc-body h3 { @apply text-sm font-semibold mt-2 mb-1 text-text-primary; }
  .doc-body p  { @apply text-sm leading-relaxed text-text-primary mt-1; }
  .doc-body ul { @apply list-disc ml-5 space-y-0.5 text-sm text-text-primary; }
  .doc-body ol { @apply list-decimal ml-5 space-y-0.5 text-sm text-text-primary; }
  .doc-body li { @apply leading-relaxed; }
  .doc-body strong { @apply font-semibold; }
  .doc-body code { @apply font-mono text-xs bg-border/30 px-1 py-0.5 rounded; }
  .doc-body pre  { @apply bg-border/30 rounded-card p-3 overflow-x-auto text-xs; }
  .doc-body blockquote { @apply border-l-4 border-border pl-4 italic text-text-secondary; }
  .doc-body a { @apply text-accent-primary underline; }
}
```

- [ ] **Step 2: Replace manual markdown rendering in `document-viewer.tsx`**

Replace the entire `<div className="prose prose-sm ...">` block (lines 65-76) with:

```tsx
import ReactMarkdown from "react-markdown";
// ... (add import at top of file)

// In JSX, replace lines 65-76 with:
<div className="doc-body max-w-none">
  <ReactMarkdown>{document.body}</ReactMarkdown>
</div>
```

The full updated return for the document case (lines 38-79) becomes:

```tsx
return (
  <div className="flex flex-col h-full overflow-y-auto">
    <div className="p-6">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-semibold text-text-primary">
          {document.title}
        </h1>
        {onRegenerate && (
          <button
            onClick={() => onRegenerate(document.type)}
            disabled={isRegenerating}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-btn border border-border text-text-secondary hover:bg-border/30 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRegenerating ? "animate-spin" : ""}`} />
            Regenerate
          </button>
        )}
      </div>
      <p className="text-xs text-text-secondary mb-6">
        Generated {new Date(document.createdAt).toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })}
      </p>
      <div className="doc-body max-w-none">
        <ReactMarkdown>{document.body}</ReactMarkdown>
      </div>
    </div>
  </div>
);
```

- [ ] **Step 3: Test in browser**

Run: `npm run dev`

Navigate to `/documents`, select a document. Verify headings, bold, lists, code blocks render properly with the dark-on-light theme.

- [ ] **Step 4: If ESM error occurs, fix `next.config.ts`**

If Next.js build fails with `ERR_REQUIRE_ESM` for react-markdown, update `next.config.ts`:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["gitclaw"],
  transpilePackages: ["react-markdown"],
};

export default nextConfig;
```

- [ ] **Step 5: Commit**

```bash
git add app/globals.css components/documents/document-viewer.tsx next.config.ts
git commit -m "feat(docs): replace manual markdown with react-markdown in document viewer"
```

---

## Task 3: A2+A3 — Error banners + race fix in documents page

**Files:**
- Modify: `app/(dashboard)/documents/page.tsx:1-161`

- [ ] **Step 1: Add error state and update catch blocks**

In the component, add after the existing state declarations (around line 31):

```tsx
const [error, setError] = useState<string | null>(null);
```

Update `fetchDocuments` (lines 33-45):

```tsx
const fetchDocuments = useCallback(async () => {
  try {
    const res = await fetch("/api/documents");
    if (res.ok) {
      const data = await res.json();
      setDocuments(data.documents);
      setError(null);
    } else {
      setError("Failed to load documents.");
    }
  } catch {
    setError("Connection failed. Could not load documents.");
  } finally {
    setIsLoadingList(false);
  }
}, []);
```

Update `handleSelect` (lines 51-65):

```tsx
const handleSelect = async (id: string) => {
  setSelectedId(id);
  setIsLoadingDoc(true);
  try {
    const res = await fetch(`/api/documents/${id}`);
    if (res.ok) {
      const data = await res.json();
      setSelectedDoc(data);
      setError(null);
    } else {
      setError("Failed to load document.");
    }
  } catch {
    setError("Connection failed. Could not load document.");
  } finally {
    setIsLoadingDoc(false);
  }
};
```

Update `handleGenerate` (lines 67-86) — **also apply the race fix (A3)** by ensuring we `await` both calls:

```tsx
const handleGenerate = async (type: "variance_report" | "ar_summary") => {
  setShowDropdown(false);
  setIsGenerating(true);
  try {
    const res = await fetch("/api/documents/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type }),
    });
    if (res.ok) {
      const newDoc = await res.json();
      await fetchDocuments();
      await handleSelect(newDoc.id);
      setError(null);
    } else {
      setError("Failed to generate document.");
    }
  } catch {
    setError("Connection failed. Could not generate document.");
  } finally {
    setIsGenerating(false);
  }
};
```

- [ ] **Step 2: Add error banner JSX**

Insert between the header `</div>` and the content `<div className="flex flex-1 min-h-0">` (after line 129):

```tsx
{error && (
  <div className="mx-6 mt-3 flex items-center justify-between gap-3 px-4 py-2.5 bg-danger/10 border border-danger/20 rounded-card text-sm text-danger">
    <span>{error}</span>
    <button onClick={() => setError(null)} className="shrink-0 text-danger/60 hover:text-danger text-lg leading-none">&times;</button>
  </div>
)}
```

- [ ] **Step 3: Test in browser**

1. Navigate to `/documents`. Verify no error banner on success.
2. Disconnect network, try to generate — verify error banner appears.
3. Click dismiss (x) — verify banner disappears.
4. Reconnect network, generate a report — verify it selects the new doc immediately (race fix).

- [ ] **Step 4: Commit**

```bash
git add app/(dashboard)/documents/page.tsx
git commit -m "fix(docs): add error banners and fix race condition in document generation"
```

---

## Task 4: B2 — Extract shared CSV helpers

**Files:**
- Create: `lib/csv/variance-parser.ts`
- Modify: `app/api/upload/route.ts:1-52`
- Test: `__tests__/lib/csv/variance-parser.test.ts`

- [ ] **Step 1: Write tests for the extracted functions**

Create `__tests__/lib/csv/variance-parser.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseCSV, autoDetectColumns, parseRows } from "@/lib/csv/variance-parser";

describe("parseCSV", () => {
  it("parses headers and rows from CSV text", () => {
    const text = "Account,Period,Actual,Budget,Category\nSalaries,Q1,50000,45000,HR\nRent,Q1,10000,10000,Facilities";
    const { headers, rows } = parseCSV(text);
    expect(headers).toEqual(["account", "period", "actual", "budget", "category"]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual(["Salaries", "Q1", "50000", "45000", "HR"]);
  });

  it("trims whitespace from headers and cells", () => {
    const text = " Account , Period , Actual \n Salaries , Q1 , 50000 ";
    const { headers, rows } = parseCSV(text);
    expect(headers).toEqual(["account", "period", "actual"]);
    expect(rows[0]).toEqual(["Salaries", "Q1", "50000"]);
  });
});

describe("autoDetectColumns", () => {
  it("detects standard variance headers", () => {
    const headers = ["account", "period", "actual", "budget", "category"];
    const mapping = autoDetectColumns(headers);
    expect(mapping.account).toBe(0);
    expect(mapping.period).toBe(1);
    expect(mapping.actual).toBe(2);
    expect(mapping.budget).toBe(3);
    expect(mapping.category).toBe(4);
  });

  it("detects alternative header names", () => {
    const headers = ["line item", "month", "spent", "forecast", "department"];
    const mapping = autoDetectColumns(headers);
    expect(mapping.account).toBe(0);
    expect(mapping.period).toBe(1);
    expect(mapping.actual).toBe(2);
    expect(mapping.budget).toBe(3);
    expect(mapping.category).toBe(4);
  });
});

describe("parseRows", () => {
  it("parses rows using column mapping", () => {
    const rows = [["Salaries", "Q1", "50000", "45000", "HR"]];
    const mapping = { account: 0, period: 1, actual: 2, budget: 3, category: 4 };
    const parsed = parseRows(rows, mapping);
    expect(parsed).toEqual([
      { account: "Salaries", period: "Q1", actual: 50000, budget: 45000, category: "HR" },
    ]);
  });

  it("skips rows with zero actual and budget", () => {
    const rows = [
      ["Salaries", "Q1", "50000", "45000", "HR"],
      ["Empty", "Q1", "0", "0", "Other"],
    ];
    const mapping = { account: 0, period: 1, actual: 2, budget: 3, category: 4 };
    const parsed = parseRows(rows, mapping);
    expect(parsed).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npx vitest run __tests__/lib/csv/variance-parser.test.ts
```

Expected: FAIL — module `@/lib/csv/variance-parser` does not exist yet.

- [ ] **Step 3: Create `lib/csv/variance-parser.ts`**

```ts
export interface ParsedVarianceRow {
  account: string;
  period: string;
  actual: number;
  budget: number;
  category: string;
}

export function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.trim().split("\n");
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const rows = lines.slice(1).map((line) => line.split(",").map((cell) => cell.trim()));
  return { headers, rows };
}

export function autoDetectColumns(headers: string[]): Record<string, number> {
  const mapping: Record<string, number> = {};

  for (let i = 0; i < headers.length; i++) {
    const h = headers[i];
    if (/account|name|description|line.?item|gl/i.test(h)) mapping.account = i;
    else if (/period|month|date|quarter/i.test(h)) mapping.period = i;
    else if (/actual|spent|real/i.test(h)) mapping.actual = i;
    else if (/budget|plan|forecast|target/i.test(h)) mapping.budget = i;
    else if (/category|type|class|dept|department/i.test(h)) mapping.category = i;
  }

  return mapping;
}

export function parseRows(
  rows: string[][],
  mapping: Record<string, number>
): ParsedVarianceRow[] {
  return rows
    .filter((row) => row.length > Math.max(...Object.values(mapping)))
    .map((row) => ({
      account: row[mapping.account] ?? "Unknown",
      period: row[mapping.period] ?? "Unknown",
      actual: parseFloat(row[mapping.actual]) || 0,
      budget: parseFloat(row[mapping.budget]) || 0,
      category: row[mapping.category] ?? "General",
    }))
    .filter((r) => r.account !== "Unknown" && (r.actual > 0 || r.budget > 0));
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npx vitest run __tests__/lib/csv/variance-parser.test.ts
```

Expected: 6 tests pass.

- [ ] **Step 5: Update `app/api/upload/route.ts` to import from extracted module**

Remove the inline `ParsedRow` interface and the functions `parseCSV`, `autoDetectColumns`, `parseRows` (lines 8-52). Replace with imports:

```ts
import { parseCSV, autoDetectColumns, parseRows } from "@/lib/csv/variance-parser";
```

Keep everything else the same. The `handleVarianceUpload` function at line 185 already calls these by name — no change needed there.

- [ ] **Step 6: Run full test suite**

```bash
npx vitest run
```

Expected: all tests pass (existing + new).

- [ ] **Step 7: Commit**

```bash
git add lib/csv/variance-parser.ts __tests__/lib/csv/variance-parser.test.ts app/api/upload/route.ts
git commit -m "refactor: extract shared CSV variance parser to lib/csv/variance-parser.ts"
```

---

## Task 5: B1 — Shape filter on data-sources GET

**Files:**
- Modify: `app/api/data-sources/route.ts:1-18`

- [ ] **Step 1: Add shape filter**

Replace the full content of `app/api/data-sources/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  const sources = await prisma.dataSource.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  const shape = searchParams.get("shape");
  const filtered = shape
    ? sources.filter((s) => {
        try {
          return JSON.parse(s.metadata ?? "{}").shape === shape;
        } catch {
          return false;
        }
      })
    : sources;

  return NextResponse.json(filtered);
}
```

- [ ] **Step 2: Test manually**

```bash
curl http://localhost:3000/api/data-sources?userId=<your-user-id>&shape=variance
curl http://localhost:3000/api/data-sources?userId=<your-user-id>&shape=ar
curl http://localhost:3000/api/data-sources?userId=<your-user-id>
```

The first two should return only matching sources. The third should return all.

- [ ] **Step 3: Commit**

```bash
git add app/api/data-sources/route.ts
git commit -m "feat(api): add shape filter to data-sources GET endpoint"
```

---

## Task 6: B3 — Google Sheets link endpoint

**Files:**
- Create: `app/api/data-sources/link-sheet/route.ts`

- [ ] **Step 1: Create the link-sheet route**

```ts
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parseCSV, autoDetectColumns, parseRows } from "@/lib/csv/variance-parser";
import { parseArCsv } from "@/lib/csv/ar-parser";
import { detectCsvShape } from "@/lib/csv/detect-shape";
import { analyzeUpload, analyzeArUpload } from "@/lib/agent";

function extractSheetId(url: string): string | null {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match?.[1] ?? null;
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { url, shape } = (await request.json()) as {
    url: string;
    shape: "variance" | "ar";
  };

  const sheetId = extractSheetId(url);
  if (!sheetId) {
    return NextResponse.json({ error: "Invalid Google Sheets URL" }, { status: 400 });
  }

  // Google Sheets CSV export — no API key needed, sheet must be "Anyone with link"
  const exportUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=0`;
  let csvText: string;
  try {
    const res = await fetch(exportUrl, { redirect: "follow" });
    if (!res.ok) {
      return NextResponse.json(
        { error: "Could not access sheet. Make sure it is shared with 'Anyone with link'." },
        { status: 422 }
      );
    }
    csvText = await res.text();
  } catch {
    return NextResponse.json(
      { error: "Could not access sheet. Make sure it is shared with 'Anyone with link'." },
      { status: 422 }
    );
  }

  const { headers, rows } = parseCSV(csvText);
  if (rows.length === 0) {
    return NextResponse.json({ error: "Sheet is empty or has no data rows" }, { status: 422 });
  }

  // Verify shape matches what was claimed by the tab, or auto-detect
  const detectedShape = await detectCsvShape(headers);
  const effectiveShape = detectedShape !== "unknown" ? detectedShape : shape;

  const dataSource = await prisma.dataSource.create({
    data: {
      userId: session.userId,
      type: "sheets",
      name: `Google Sheet (${sheetId.slice(0, 8)}...)`,
      status: "processing",
      recordCount: rows.length,
      metadata: JSON.stringify({ shape: effectiveShape, headers, sheetId }),
    },
  });

  if (effectiveShape === "ar") {
    const parseResult = await parseArCsv(headers, rows);
    if (parseResult.invoices.length > 0) {
      for (const inv of parseResult.invoices) {
        await prisma.invoice.upsert({
          where: {
            dataSourceId_invoiceNumber: {
              dataSourceId: dataSource.id,
              invoiceNumber: inv.invoiceNumber,
            },
          },
          create: {
            dataSourceId: dataSource.id,
            invoiceNumber: inv.invoiceNumber,
            customer: inv.customer,
            customerEmail: inv.customerEmail,
            amount: inv.amount,
            invoiceDate: inv.invoiceDate,
            dueDate: inv.dueDate,
          },
          update: {
            customer: inv.customer,
            customerEmail: inv.customerEmail,
            amount: inv.amount,
            invoiceDate: inv.invoiceDate,
            dueDate: inv.dueDate,
          },
        });
      }
    }

    await prisma.dataSource.update({
      where: { id: dataSource.id },
      data: { status: "ready", recordCount: parseResult.invoices.length },
    });

    analyzeArUpload(session.userId, dataSource.id, dataSource.name, parseResult.invoices.length)
      .catch((err) => console.error("[link-sheet] AR agent failed:", err));
  } else {
    const mapping = autoDetectColumns(headers);
    const parsedRows = parseRows(rows, mapping);

    for (const row of parsedRows) {
      await prisma.financialRecord.create({
        data: { dataSourceId: dataSource.id, ...row },
      });
    }

    await prisma.dataSource.update({
      where: { id: dataSource.id },
      data: { status: "ready", recordCount: parsedRows.length },
    });

    analyzeUpload(session.userId, dataSource.id, dataSource.name, parsedRows.length)
      .catch((err) => console.error("[link-sheet] Variance agent failed:", err));
  }

  return NextResponse.json(
    { dataSource: { id: dataSource.id, name: dataSource.name, recordCount: dataSource.recordCount }, analysisStatus: "processing" },
    { status: 201 }
  );
}
```

- [ ] **Step 2: Test manually**

Create a public Google Sheet with variance-shaped data, then:

```bash
curl -X POST http://localhost:3000/api/data-sources/link-sheet \
  -H "Content-Type: application/json" \
  -H "Cookie: lyzr-session=<session-cookie>" \
  -d '{"url":"https://docs.google.com/spreadsheets/d/<SHEET_ID>/edit","shape":"variance"}'
```

Expected: 201 with `{ dataSource: {...}, analysisStatus: "processing" }`.

- [ ] **Step 3: Commit**

```bash
git add app/api/data-sources/link-sheet/route.ts
git commit -m "feat(api): add Google Sheets link endpoint via CSV export URL"
```

---

## Task 7: B4 — Re-analyze endpoint

**Files:**
- Create: `app/api/data-sources/[id]/reanalyze/route.ts`

- [ ] **Step 1: Create the reanalyze route**

```ts
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { analyzeUpload, analyzeArUpload } from "@/lib/agent";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;

  const dataSource = await prisma.dataSource.findUnique({ where: { id } });
  if (!dataSource) {
    return NextResponse.json({ error: "Data source not found" }, { status: 404 });
  }
  if (dataSource.userId !== session.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (dataSource.status !== "ready") {
    return NextResponse.json({ error: "Data source is not ready" }, { status: 409 });
  }

  let shape = "variance";
  try {
    shape = JSON.parse(dataSource.metadata ?? "{}").shape ?? "variance";
  } catch {
    // default to variance
  }

  await prisma.dataSource.update({
    where: { id },
    data: { status: "processing" },
  });

  if (shape === "ar") {
    const invoiceCount = await prisma.invoice.count({ where: { dataSourceId: id } });
    analyzeArUpload(session.userId, id, dataSource.name, invoiceCount)
      .catch((err) => console.error("[reanalyze] AR agent failed:", err));
  } else {
    analyzeUpload(session.userId, id, dataSource.name, dataSource.recordCount)
      .catch((err) => console.error("[reanalyze] Variance agent failed:", err));
  }

  return NextResponse.json({ status: "processing" });
}
```

Note: Next.js 16 requires `params` to be `Promise<{id: string}>` and must be awaited.

- [ ] **Step 2: Commit**

```bash
git add app/api/data-sources/[id]/reanalyze/route.ts
git commit -m "feat(api): add re-analyze endpoint for data sources"
```

---

## Task 8: B5 — LinkSheetArea component

**Files:**
- Create: `components/data-sources/link-sheet-area.tsx`

- [ ] **Step 1: Create the component**

```tsx
"use client";

import { useState } from "react";
import { Sheet, Loader2 } from "lucide-react";

interface LinkSheetAreaProps {
  shape: "variance" | "ar";
  onLink: (url: string) => Promise<void>;
  isLinking: boolean;
}

export function LinkSheetArea({ shape, onLink, isLinking }: LinkSheetAreaProps) {
  const [url, setUrl] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    await onLink(url.trim());
    setUrl("");
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 p-5 border border-border rounded-card bg-bg-card"
    >
      <div className="flex items-center gap-2">
        <Sheet className="w-5 h-5 text-accent-primary" />
        <h3 className="text-sm font-medium text-text-primary">Link a Google Sheet</h3>
      </div>
      <p className="text-xs text-text-secondary">
        Share your sheet with &quot;Anyone with link&quot; first.
        {shape === "variance"
          ? " Sheet should have columns like Account, Period, Actual, Budget."
          : " Sheet should have columns like Invoice #, Customer, Amount, Due Date."}
      </p>
      <div className="flex gap-2">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://docs.google.com/spreadsheets/d/..."
          disabled={isLinking}
          className="flex-1 px-3 py-2 text-sm border border-border rounded-btn bg-bg-primary text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:border-accent-primary disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={isLinking || !url.trim()}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-btn bg-accent-primary text-white hover:bg-accent-hover disabled:opacity-50 transition-colors shrink-0"
        >
          {isLinking ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Connecting...
            </>
          ) : (
            "Connect Sheet"
          )}
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/data-sources/link-sheet-area.tsx
git commit -m "feat(ui): add LinkSheetArea component for Google Sheets URL input"
```

---

## Task 9: B7 — Re-analyze button in SourceList

**Files:**
- Modify: `components/data-sources/source-list.tsx:1-63`

- [ ] **Step 1: Update SourceList with re-analyze button**

Replace the full content of `components/data-sources/source-list.tsx`:

```tsx
"use client";

import { useState } from "react";
import { FileSpreadsheet, Sheet, CheckCircle, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { clsx } from "clsx";
import type { DataSource } from "@/lib/types";
import { relativeTime } from "@/lib/utils";

interface SourceListProps {
  sources: DataSource[];
  onReanalyze?: (id: string) => Promise<void>;
}

const statusConfig = {
  ready: { icon: CheckCircle, label: "Ready", className: "text-success" },
  processing: { icon: Loader2, label: "Processing", className: "text-warning animate-spin" },
  error: { icon: AlertCircle, label: "Error", className: "text-danger" },
};

const typeIcons = {
  csv: FileSpreadsheet,
  sheets: Sheet,
};

export function SourceList({ sources, onReanalyze }: SourceListProps) {
  const [reanalyzingIds, setReanalyzingIds] = useState<Set<string>>(new Set());

  const handleReanalyze = async (id: string) => {
    if (!onReanalyze) return;
    setReanalyzingIds((prev) => new Set(prev).add(id));
    try {
      await onReanalyze(id);
    } finally {
      setReanalyzingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  if (sources.length === 0) {
    return (
      <div className="text-center py-8 text-text-secondary text-sm">
        No data sources connected yet. Upload a CSV or link a Google Sheet to get started.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {sources.map((source) => {
        const TypeIcon = typeIcons[source.type] ?? FileSpreadsheet;
        const status = statusConfig[source.status] ?? statusConfig.error;
        const StatusIcon = status.icon;
        const isReanalyzing = reanalyzingIds.has(source.id);

        return (
          <div
            key={source.id}
            className="flex items-center gap-3 p-3 bg-bg-card rounded-card border border-border"
          >
            <div className="w-10 h-10 rounded-card bg-accent-primary/10 flex items-center justify-center shrink-0">
              <TypeIcon className="w-5 h-5 text-accent-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text-primary truncate">
                {source.name}
              </p>
              <p className="text-xs text-text-secondary">
                {source.type.toUpperCase()} · {source.recordCount} records · uploaded{" "}
                {relativeTime(source.createdAt)}
              </p>
            </div>
            <div className={clsx("flex items-center gap-1.5 text-xs font-medium", status.className)}>
              <StatusIcon className="w-4 h-4" />
              {status.label}
            </div>
            {onReanalyze && source.status === "ready" && (
              <button
                onClick={() => handleReanalyze(source.id)}
                disabled={isReanalyzing}
                title="Re-analyze this data source"
                className="p-1.5 text-text-secondary hover:text-accent-primary rounded-btn hover:bg-accent-primary/10 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={clsx("w-4 h-4", isReanalyzing && "animate-spin")} />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/data-sources/source-list.tsx
git commit -m "feat(ui): add re-analyze button to source list"
```

---

## Task 10: B6 — Tabbed data sources page

**Files:**
- Modify: `app/(dashboard)/data-sources/page.tsx:1-119`

- [ ] **Step 1: Rewrite data sources page with tabs**

Replace the full content of `app/(dashboard)/data-sources/page.tsx`:

```tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { UploadArea } from "@/components/data-sources/upload-area";
import { LinkSheetArea } from "@/components/data-sources/link-sheet-area";
import { SourceList } from "@/components/data-sources/source-list";
import type { DataSource } from "@/lib/types";

type TabShape = "variance" | "ar";

export default function DataSourcesPage() {
  const router = useRouter();
  const [sources, setSources] = useState<DataSource[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const [uploadResult, setUploadResult] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabShape>("variance");

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.userId) setUserId(data.userId);
      });
  }, []);

  const fetchSources = useCallback(async () => {
    if (!userId) return;
    const res = await fetch(`/api/data-sources?userId=${userId}`);
    if (res.ok) {
      const data = await res.json();
      setSources(
        data.map((s: Record<string, unknown>) => ({
          ...s,
          createdAt: new Date(s.createdAt as string),
        }))
      );
    }
  }, [userId]);

  useEffect(() => {
    fetchSources();
  }, [fetchSources]);

  const filteredSources = sources.filter((s) => {
    try {
      const meta = typeof s.metadata === "string" ? JSON.parse(s.metadata) : s.metadata;
      return meta?.shape === activeTab;
    } catch {
      return false;
    }
  });

  const handleUpload = async (file: File) => {
    if (!userId) return;
    setIsUploading(true);
    setUploadResult(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("userId", userId);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const result = await res.json();
        const mappingNote =
          result.mappingSource === "llm"
            ? " (columns mapped by AI — non-standard headers detected)"
            : "";
        const analysisNote =
          result.analysisStatus === "processing"
            ? " AI is analyzing in the background — actions will appear on the dashboard shortly."
            : ` Generated ${result.actionsGenerated} actions.`;
        setUploadResult(
          `Processed ${result.dataSource.recordCount} records.${analysisNote}${mappingNote} Redirecting to dashboard...`
        );
        fetchSources();
        setTimeout(() => router.push("/"), 1500);
      } else {
        const err = await res.json();
        setUploadResult(`Error: ${err.error}`);
      }
    } catch {
      setUploadResult("Upload failed. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleLink = async (url: string) => {
    setIsLinking(true);
    setUploadResult(null);
    try {
      const res = await fetch("/api/data-sources/link-sheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, shape: activeTab }),
      });
      if (res.ok) {
        setUploadResult("Sheet connected. AI is analyzing in the background...");
        fetchSources();
        setTimeout(() => router.push("/"), 1500);
      } else {
        const data = await res.json().catch(() => ({}));
        setUploadResult(
          `Error: ${(data as { error?: string }).error ?? "Failed to connect sheet"}`
        );
      }
    } catch {
      setUploadResult("Connection failed. Please try again.");
    } finally {
      setIsLinking(false);
    }
  };

  const handleReanalyze = async (id: string) => {
    await fetch(`/api/data-sources/${id}/reanalyze`, { method: "POST" });
    fetchSources();
    setTimeout(() => router.push("/"), 1000);
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto p-8 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Data Sources</h1>
          <p className="text-sm text-text-secondary mt-1">
            Upload financial data to get AI-powered variance analysis and recommendations.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border">
          {(["variance", "ar"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                setUploadResult(null);
              }}
              className={clsx(
                "px-5 py-3 text-sm font-medium border-b-2 transition-colors",
                activeTab === tab
                  ? "border-accent-primary text-accent-primary"
                  : "border-transparent text-text-secondary hover:text-text-primary"
              )}
            >
              {tab === "variance" ? "Variance / P&L" : "AR / Invoices"}
            </button>
          ))}
        </div>

        {/* Upload + Link areas */}
        <div className="grid gap-4 md:grid-cols-2">
          <UploadArea onUpload={handleUpload} isUploading={isUploading} />
          <LinkSheetArea shape={activeTab} onLink={handleLink} isLinking={isLinking} />
        </div>

        {uploadResult && (
          <div
            className={`px-4 py-3 rounded-card text-sm ${
              uploadResult.startsWith("Error")
                ? "bg-danger/10 text-danger border border-danger/20"
                : "bg-success/10 text-success border border-success/20"
            }`}
          >
            {uploadResult}
          </div>
        )}

        <div>
          <h2 className="text-sm font-semibold text-text-primary mb-3">
            Connected Sources
          </h2>
          <SourceList sources={filteredSources} onReanalyze={handleReanalyze} />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Test in browser**

1. Navigate to `/data-sources`
2. Verify two tabs appear: "Variance / P&L" and "AR / Invoices"
3. Toggle tabs — source list filters correctly
4. Upload area and link area appear side by side (stacked on mobile)
5. Upload a CSV — redirects to dashboard
6. Click re-analyze on a ready source — spinner, then redirect

- [ ] **Step 3: Commit**

```bash
git add app/(dashboard)/data-sources/page.tsx
git commit -m "feat(ui): tabbed data sources page with Google Sheets link and re-analyze"
```

---

## Task 11: C1 — Stats types and API endpoint

**Files:**
- Modify: `lib/types.ts:1-63`
- Create: `app/api/stats/route.ts`

- [ ] **Step 1: Add types to `lib/types.ts`**

Append at end of file:

```ts
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
```

- [ ] **Step 2: Create `app/api/stats/route.ts`**

```ts
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const userId = session.userId;

  const [actionGroups, invoices, records] = await Promise.all([
    prisma.action.groupBy({
      by: ["severity"],
      where: { userId },
      _count: true,
    }),
    prisma.invoice.findMany({
      where: { dataSource: { userId } },
      select: { dueDate: true, status: true },
    }),
    prisma.financialRecord.findMany({
      where: { dataSource: { userId } },
      select: { category: true, actual: true, budget: true },
    }),
  ]);

  // Action counts
  const actionCounts = { critical: 0, warning: 0, info: 0, total: 0 };
  for (const g of actionGroups) {
    const sev = g.severity as "critical" | "warning" | "info";
    if (sev in actionCounts) {
      actionCounts[sev] = g._count;
    }
    actionCounts.total += g._count;
  }

  // AR aging buckets
  let ar: { info: number; warning: number; critical: number; total: number } | null = null;
  const openInvoices = invoices.filter((i) => i.status !== "paid");
  if (openInvoices.length > 0) {
    const now = Date.now();
    ar = { info: 0, warning: 0, critical: 0, total: openInvoices.length };
    for (const inv of openInvoices) {
      const daysOverdue = Math.floor((now - new Date(inv.dueDate).getTime()) / 86400000);
      if (daysOverdue <= 0) ar.info++;
      else if (daysOverdue <= 30) ar.warning++;
      else ar.critical++;
    }
  }

  // Top variance categories
  const categoryMap = new Map<string, number>();
  for (const r of records) {
    const prev = categoryMap.get(r.category) ?? 0;
    categoryMap.set(r.category, prev + (r.actual - r.budget));
  }
  const topCategories = [...categoryMap.entries()]
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .slice(0, 3)
    .map(([category, variance]) => ({
      category,
      variance: Math.round(variance),
      direction: (variance > 0 ? "over" : "under") as "over" | "under",
    }));

  return NextResponse.json({ actions: actionCounts, ar, topCategories });
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/types.ts app/api/stats/route.ts
git commit -m "feat(api): add stats endpoint and StatsData/BudgetChartData types"
```

---

## Task 12: C2 — Stats strip component

**Files:**
- Create: `components/feed/stats-strip.tsx`

- [ ] **Step 1: Create the component**

```tsx
"use client";

import { TrendingUp, TrendingDown } from "lucide-react";
import type { StatsData } from "@/lib/types";

interface StatsStripProps {
  stats: StatsData;
}

function StatBlock({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className={`text-2xl font-bold ${color}`}>{value}</span>
      <span className="text-[10px] uppercase tracking-wide text-text-secondary">{label}</span>
    </div>
  );
}

export function StatsStrip({ stats }: StatsStripProps) {
  const { actions, ar, topCategories } = stats;

  return (
    <div className="flex items-center gap-6 px-4 py-3 border-b border-border shrink-0 overflow-x-auto">
      {/* Action counts */}
      <div className="flex items-center gap-4 shrink-0">
        <StatBlock value={actions.critical} label="Critical" color="text-danger" />
        <StatBlock value={actions.warning} label="Warning" color="text-warning" />
        <StatBlock value={actions.info} label="Info" color="text-success" />
      </div>

      {/* Divider */}
      <div className="w-px h-8 bg-border shrink-0" />

      {/* AR aging donut */}
      {ar && ar.total > 0 && (
        <>
          <div className="flex items-center gap-2 shrink-0">
            <div
              className="relative w-12 h-12 rounded-full shrink-0"
              style={{
                background: (() => {
                  const total = ar.total || 1;
                  const infoPct = (ar.info / total) * 100;
                  const warnPct = (ar.warning / total) * 100;
                  return `conic-gradient(var(--success) 0% ${infoPct}%, var(--warning) ${infoPct}% ${infoPct + warnPct}%, var(--danger) ${infoPct + warnPct}% 100%)`;
                })(),
              }}
            >
              <div className="absolute inset-[6px] bg-bg-card rounded-full flex items-center justify-center">
                <span className="text-[9px] font-bold text-text-primary">{ar.total}</span>
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-wide text-text-secondary">AR Aging</span>
              <span className="text-[10px] text-text-secondary">
                {ar.critical} overdue
              </span>
            </div>
          </div>
          <div className="w-px h-8 bg-border shrink-0" />
        </>
      )}

      {/* Top variances */}
      {topCategories.length > 0 && (
        <div className="flex flex-col gap-1 min-w-0">
          {topCategories.map((cat) => {
            const maxVariance = Math.max(...topCategories.map((c) => Math.abs(c.variance)));
            const barWidth = maxVariance > 0 ? Math.round((Math.abs(cat.variance) / maxVariance) * 80) : 0;
            const Icon = cat.direction === "over" ? TrendingUp : TrendingDown;
            const color = cat.direction === "over" ? "text-danger" : "text-success";

            return (
              <div key={cat.category} className="flex items-center gap-2">
                <span className="text-[10px] text-text-secondary w-16 truncate shrink-0">{cat.category}</span>
                <div
                  className={`h-1.5 rounded-full shrink-0 ${cat.direction === "over" ? "bg-danger/40" : "bg-success/40"}`}
                  style={{ width: `${barWidth}px` }}
                />
                <Icon className={`w-3 h-3 shrink-0 ${color}`} />
                <span className={`text-[10px] font-medium ${color}`}>
                  ${Math.abs(cat.variance).toLocaleString()}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/feed/stats-strip.tsx
git commit -m "feat(ui): add pure-CSS stats strip with action counts, AR donut, top variances"
```

---

## Task 13: C3 — ActionModal slide-over

**Files:**
- Create: `components/feed/action-modal.tsx`

- [ ] **Step 1: Create the modal component**

```tsx
"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  X,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  Flag,
  MessageSquare,
  Copy,
  Clock,
  ArrowUpCircle,
  History,
} from "lucide-react";
import { clsx } from "clsx";
import type { Action } from "@/lib/types";
import { relativeTime, severityColor } from "@/lib/utils";

interface ActionModalProps {
  action: Action;
  onClose: () => void;
  onFlag?: (id: string) => void;
  onApprove?: (id: string) => void;
  onAskAI?: (id: string) => void;
  onDismiss?: (id: string) => void;
  onArOp?: (id: string, op: "mark_sent" | "snooze" | "escalate") => void;
}

const severityIcons = {
  critical: AlertTriangle,
  warning: AlertCircle,
  info: CheckCircle,
};

const severityLabels = {
  critical: "Critical",
  warning: "Warning",
  info: "Info",
};

export function ActionModal({
  action,
  onClose,
  onFlag,
  onApprove,
  onAskAI,
  onDismiss,
  onArOp,
}: ActionModalProps) {
  const [visible, setVisible] = useState(false);
  const [draftBody, setDraftBody] = useState<string | null>(action.draftBody ?? null);
  const [loadingDraft, setLoadingDraft] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [events, setEvents] = useState<
    Array<{ id: string; fromStatus: string; toStatus: string; createdAt: string }>
  >([]);
  const [loadingEvents, setLoadingEvents] = useState(false);

  const Icon = severityIcons[action.severity] ?? AlertCircle;
  const isAr = action.type === "ar_followup";

  // Slide-in animation
  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  // Escape key closes modal
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  // Body scroll lock
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Auto-fetch AR draft on mount
  useEffect(() => {
    if (isAr && !draftBody && action.status === "pending") {
      setLoadingDraft(true);
      fetch(`/api/actions/${action.id}/ar`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.draftBody) setDraftBody(data.draftBody);
        })
        .catch(() => {})
        .finally(() => setLoadingDraft(false));
    }
  }, [isAr, draftBody, action.id, action.status]);

  const toggleHistory = async () => {
    if (showHistory) {
      setShowHistory(false);
      return;
    }
    if (events.length === 0) {
      setLoadingEvents(true);
      try {
        const res = await fetch(`/api/actions/${action.id}/events`);
        if (res.ok) {
          const data = await res.json();
          setEvents(data.events);
        }
      } catch {
        // silent
      } finally {
        setLoadingEvents(false);
      }
    }
    setShowHistory(true);
  };

  const handleCopyAndSend = async () => {
    if (draftBody) {
      await navigator.clipboard.writeText(draftBody);
    }
    onArOp?.(action.id, "mark_sent");
    onClose();
  };

  const content = (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-40"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={clsx(
          "fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-bg-card flex flex-col shadow-xl transition-transform duration-200",
          visible ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <span
            className={clsx(
              "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border",
              severityColor(action.severity)
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {severityLabels[action.severity]}
          </span>
          <button
            onClick={onClose}
            className="p-1.5 text-text-secondary hover:text-text-primary rounded-btn hover:bg-border/30 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-text-primary mb-1">
              {action.headline}
            </h2>
            <p className="text-sm text-text-secondary">{action.detail}</p>
          </div>

          <p className="text-xs text-text-secondary">{action.driver}</p>

          <p className="text-xs text-text-secondary">
            Source:{" "}
            <span className="text-accent-primary font-medium">
              {action.sourceName}
            </span>
            <span className="ml-2">{relativeTime(action.createdAt)}</span>
          </p>

          {/* AR draft body */}
          {isAr && (
            <div className="p-3 rounded-lg bg-bg-primary border border-border">
              {loadingDraft ? (
                <p className="text-xs text-text-secondary">Loading draft email...</p>
              ) : draftBody ? (
                <pre className="text-xs text-text-primary whitespace-pre-wrap font-mono leading-relaxed">
                  {draftBody}
                </pre>
              ) : (
                <p className="text-xs text-text-secondary">Draft unavailable.</p>
              )}
            </div>
          )}

          {/* History */}
          {action.status !== "pending" && (
            <div className="pt-2 border-t border-border">
              <button
                onClick={toggleHistory}
                className="inline-flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary transition-colors"
              >
                <History className="w-3 h-3" />
                {showHistory ? "Hide history" : "History"}
              </button>
              {showHistory && (
                <ul className="mt-1.5 space-y-1">
                  {loadingEvents ? (
                    <li className="text-xs text-text-secondary">Loading...</li>
                  ) : events.length === 0 ? (
                    <li className="text-xs text-text-secondary">No history recorded.</li>
                  ) : (
                    events.map((e) => (
                      <li key={e.id} className="text-xs text-text-secondary">
                        <span className="font-medium">{e.fromStatus}</span>
                        {" → "}
                        <span className="font-medium">{e.toStatus}</span>
                        <span className="ml-2 opacity-60">
                          {relativeTime(new Date(e.createdAt))}
                        </span>
                      </li>
                    ))
                  )}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Footer — action buttons */}
        <div className="flex items-center gap-2 px-6 py-4 border-t border-border shrink-0">
          {action.status === "pending" && isAr && (
            <>
              <button
                onClick={handleCopyAndSend}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-btn border border-success/30 text-success hover:bg-success/10 transition-colors"
              >
                <Copy className="w-3.5 h-3.5" />
                Copy & Mark Sent
              </button>
              <button
                onClick={() => { onArOp?.(action.id, "snooze"); onClose(); }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-btn border border-border text-text-secondary hover:bg-border/30 transition-colors"
              >
                <Clock className="w-3.5 h-3.5" />
                Snooze 7d
              </button>
              <button
                onClick={() => { onArOp?.(action.id, "escalate"); onClose(); }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-btn border border-warning/30 text-warning hover:bg-warning/10 transition-colors"
              >
                <ArrowUpCircle className="w-3.5 h-3.5" />
                Escalate
              </button>
            </>
          )}
          {action.status === "pending" && !isAr && (
            <>
              <button
                onClick={() => { onApprove?.(action.id); onClose(); }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-btn border border-success/30 text-success hover:bg-success/10 transition-colors"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                Approve
              </button>
              <button
                onClick={() => { onFlag?.(action.id); onClose(); }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-btn border border-border text-text-secondary hover:bg-border/30 transition-colors"
              >
                <Flag className="w-3.5 h-3.5" />
                Flag
              </button>
            </>
          )}
          {action.status === "pending" && (
            <>
              <button
                onClick={() => { onAskAI?.(action.id); onClose(); }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-btn bg-accent-primary text-white hover:bg-accent-hover transition-colors"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                Ask AI
              </button>
              <button
                onClick={() => { onDismiss?.(action.id); onClose(); }}
                className="ml-auto inline-flex items-center p-1.5 text-text-secondary hover:text-danger rounded-btn hover:bg-danger/10 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </>
          )}
          {action.status === "flagged" && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-warning">
              <Flag className="w-3.5 h-3.5" />
              Flagged for Review
            </span>
          )}
          {action.status === "dismissed" && (
            <span className="text-xs text-text-secondary">Dismissed</span>
          )}
          {action.status === "approved" && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-success">
              <CheckCircle className="w-3.5 h-3.5" />
              {isAr ? "Sent" : "Approved"}
            </span>
          )}
        </div>
      </div>
    </>
  );

  return createPortal(content, document.body);
}
```

- [ ] **Step 2: Commit**

```bash
git add components/feed/action-modal.tsx
git commit -m "feat(ui): add slide-over action modal with portal rendering"
```

---

## Task 14: C4 — Rewrite ActionCard to compact row

**Files:**
- Modify: `components/feed/action-card.tsx:1-267` (full rewrite)

- [ ] **Step 1: Rewrite the component**

Replace the full content of `components/feed/action-card.tsx`:

```tsx
"use client";

import { ChevronRight } from "lucide-react";
import { clsx } from "clsx";
import type { Action } from "@/lib/types";
import { relativeTime } from "@/lib/utils";
import { ActionModal } from "@/components/feed/action-modal";

interface ActionCardProps {
  action: Action;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onClose: () => void;
  onFlag?: (id: string) => void;
  onApprove?: (id: string) => void;
  onAskAI?: (id: string) => void;
  onDismiss?: (id: string) => void;
  onArOp?: (id: string, op: "mark_sent" | "snooze" | "escalate") => void;
}

const severityDotColor: Record<string, string> = {
  critical: "bg-danger",
  warning: "bg-warning",
  info: "bg-success",
};

const statusLabels: Record<string, string> = {
  flagged: "Flagged",
  dismissed: "Dismissed",
  approved: "Approved",
};

export function ActionCard({
  action,
  isSelected,
  onSelect,
  onClose,
  onFlag,
  onApprove,
  onAskAI,
  onDismiss,
  onArOp,
}: ActionCardProps) {
  return (
    <>
      <div
        onClick={() => onSelect(action.id)}
        className={clsx(
          "flex items-center gap-3 bg-bg-card rounded-card border shadow-card px-3 h-[52px] cursor-pointer transition-all group",
          isSelected
            ? "border-accent-primary"
            : "border-border hover:border-accent-primary/40"
        )}
      >
        {/* Severity dot */}
        <div
          className={clsx(
            "w-2.5 h-2.5 rounded-full shrink-0",
            severityDotColor[action.severity] ?? "bg-border"
          )}
        />

        {/* Headline */}
        <p className="text-sm text-text-primary truncate flex-1">{action.headline}</p>

        {/* Status chip (non-pending only) */}
        {action.status !== "pending" && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-border/20 text-text-secondary border border-border shrink-0">
            {statusLabels[action.status] ?? action.status}
          </span>
        )}

        {/* Source */}
        <span className="text-xs text-text-secondary hidden sm:block truncate max-w-[100px]">
          {action.sourceName}
        </span>

        {/* Time */}
        <span className="text-xs text-text-secondary shrink-0">
          {relativeTime(action.createdAt)}
        </span>

        {/* Chevron */}
        <ChevronRight className="w-4 h-4 text-text-secondary group-hover:text-text-primary shrink-0" />
      </div>

      {/* Slide-over modal */}
      {isSelected && (
        <ActionModal
          action={action}
          onClose={onClose}
          onFlag={onFlag}
          onApprove={onApprove}
          onAskAI={onAskAI}
          onDismiss={onDismiss}
          onArOp={onArOp}
        />
      )}
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/feed/action-card.tsx
git commit -m "feat(ui): rewrite action card to compact 52px row with modal"
```

---

## Task 15: C5 — Wire stats + selection into ActionFeed

**Files:**
- Modify: `components/feed/action-feed.tsx:1-77`

- [ ] **Step 1: Update ActionFeed**

Replace the full content of `components/feed/action-feed.tsx`:

```tsx
"use client";

import { useState, useEffect } from "react";
import type { Action, ActionType, Severity, ActionStatus, StatsData } from "@/lib/types";
import { ActionCard } from "@/components/feed/action-card";
import { FilterBar } from "@/components/feed/filter-bar";
import { StatsStrip } from "@/components/feed/stats-strip";

interface ActionFeedProps {
  actions: Action[];
  userId: string;
  onFlag?: (id: string) => void;
  onApprove?: (id: string) => void;
  onAskAI?: (id: string) => void;
  onDismiss?: (id: string) => void;
  onArOp?: (id: string, op: "mark_sent" | "snooze" | "escalate") => void;
}

const severityOrder: Record<Severity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

export function ActionFeed({ actions, userId, onFlag, onApprove, onAskAI, onDismiss, onArOp }: ActionFeedProps) {
  const [typeFilter, setTypeFilter] = useState<ActionType | "all">("all");
  const [severityFilter, setSeverityFilter] = useState<Severity | "all">("all");
  const [statusFilter, setStatusFilter] = useState<ActionStatus | "all">("all");
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);
  const [stats, setStats] = useState<StatsData | null>(null);

  useEffect(() => {
    fetch("/api/stats")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (data) setStats(data); })
      .catch(() => {});
  }, [userId]);

  const filtered = actions
    .filter((a) => typeFilter === "all" || a.type === typeFilter)
    .filter((a) => severityFilter === "all" || a.severity === severityFilter)
    .filter((a) => statusFilter === "all" || a.status === statusFilter)
    .sort((a, b) => {
      const sevDiff = severityOrder[a.severity] - severityOrder[b.severity];
      if (sevDiff !== 0) return sevDiff;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-border bg-bg-card">
        <h2 className="text-lg font-semibold text-text-primary">Actions</h2>
        <p className="text-xs text-text-secondary mt-0.5">
          {filtered.length} item{filtered.length !== 1 ? "s" : ""}
        </p>
      </div>

      {stats && <StatsStrip stats={stats} />}

      <FilterBar
        activeType={typeFilter}
        activeSeverity={severityFilter}
        activeStatus={statusFilter}
        onTypeChange={setTypeFilter}
        onSeverityChange={setSeverityFilter}
        onStatusChange={setStatusFilter}
      />

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-text-secondary text-sm">
            No actions match the current filters.
          </div>
        ) : (
          filtered.map((action) => (
            <ActionCard
              key={action.id}
              action={action}
              isSelected={selectedActionId === action.id}
              onSelect={setSelectedActionId}
              onClose={() => setSelectedActionId(null)}
              onFlag={onFlag}
              onApprove={onApprove}
              onAskAI={onAskAI}
              onDismiss={onDismiss}
              onArOp={onArOp}
            />
          ))
        )}
      </div>
    </div>
  );
}
```

Note: `space-y-3` changed to `space-y-2` for compact cards.

- [ ] **Step 2: Update `app/(dashboard)/page.tsx` — pass `userId` to ActionFeed**

In `app/(dashboard)/page.tsx`, update the `<ActionFeed>` usage (around line 284) to pass `userId`:

```tsx
<ActionFeed
  actions={actions}
  userId={userId}
  onFlag={handleFlag}
  onApprove={handleApprove}
  onAskAI={handleAskAI}
  onDismiss={handleDismiss}
  onArOp={handleArOp}
/>
```

- [ ] **Step 3: Test in browser**

1. Navigate to `/` (dashboard)
2. Stats strip visible above the filter bar with action counts
3. If AR data exists, donut is shown
4. Top variances shown as a ranked list
5. Action cards are compact 52px rows
6. Click a card → slide-over opens from right
7. Escape closes modal. Backdrop click closes modal.
8. Approve/Flag/Dismiss/Ask AI buttons work in modal
9. AR cards show draft body automatically

- [ ] **Step 4: Commit**

```bash
git add components/feed/action-feed.tsx app/(dashboard)/page.tsx
git commit -m "feat(ui): wire stats strip and compact card selection into action feed"
```

---

## Task 16: D1 — Budget vs Actual API endpoint

**Files:**
- Create: `app/api/chart/budget-vs-actual/route.ts`

- [ ] **Step 1: Create the chart endpoint**

```ts
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const records = await prisma.financialRecord.findMany({
    where: { dataSource: { userId: session.userId } },
    select: { category: true, actual: true, budget: true },
  });

  // Group by category, sum actual and budget
  const categoryMap = new Map<string, { actual: number; budget: number }>();
  for (const r of records) {
    const prev = categoryMap.get(r.category) ?? { actual: 0, budget: 0 };
    categoryMap.set(r.category, {
      actual: prev.actual + r.actual,
      budget: prev.budget + r.budget,
    });
  }

  // Sort by budget descending, top 8
  const data = [...categoryMap.entries()]
    .sort((a, b) => b[1].budget - a[1].budget)
    .slice(0, 8)
    .map(([category, { actual, budget }]) => ({
      category,
      actual: Math.round(actual),
      budget: Math.round(budget),
      variance: Math.round(actual - budget),
    }));

  return NextResponse.json(data);
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/chart/budget-vs-actual/route.ts
git commit -m "feat(api): add budget vs actual chart data endpoint"
```

---

## Task 17: D2 — BudgetChart component

**Files:**
- Create: `components/dashboard/budget-chart.tsx`

- [ ] **Step 1: Create the chart component**

```tsx
"use client";

import { useState, useEffect } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";
import type { BudgetChartData } from "@/lib/types";

function formatCompact(value: number): string {
  if (Math.abs(value) >= 1000) {
    return `$${(value / 1000).toFixed(0)}k`;
  }
  return `$${value}`;
}

export function BudgetChart() {
  const [data, setData] = useState<BudgetChartData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch("/api/chart/budget-vs-actual")
      .then((res) => (res.ok ? res.json() : []))
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return (
      <div className="bg-bg-card rounded-xl border border-border/60 shadow-[0_2px_12px_rgba(0,0,0,0.02)] p-4 flex items-center justify-center h-[280px]">
        <div className="w-6 h-6 border-2 border-accent-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="bg-bg-card rounded-xl border border-border/60 shadow-[0_2px_12px_rgba(0,0,0,0.02)] p-4 flex items-center justify-center h-[280px]">
        <p className="text-sm text-text-secondary">No financial data yet</p>
      </div>
    );
  }

  return (
    <div className="bg-bg-card rounded-xl border border-border/60 shadow-[0_2px_12px_rgba(0,0,0,0.02)] p-4">
      <h3 className="text-sm font-semibold text-text-primary mb-3">Budget vs Actual</h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 40 }}>
          <XAxis
            dataKey="category"
            tick={{ fontSize: 10, fill: "var(--text-secondary)" }}
            angle={-30}
            textAnchor="end"
            interval={0}
          />
          <YAxis
            tickFormatter={formatCompact}
            tick={{ fontSize: 10, fill: "var(--text-secondary)" }}
            width={50}
          />
          <Tooltip
            formatter={(value: number, name: string) => [
              `$${value.toLocaleString()}`,
              name.charAt(0).toUpperCase() + name.slice(1),
            ]}
            contentStyle={{
              backgroundColor: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-card)",
              fontSize: "12px",
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
          />
          <Bar dataKey="budget" fill="var(--border)" radius={[3, 3, 0, 0]} name="Budget" />
          <Bar dataKey="actual" fill="var(--accent-primary)" radius={[3, 3, 0, 0]} name="Actual" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/dashboard/budget-chart.tsx
git commit -m "feat(ui): add Recharts budget vs actual bar chart component"
```

---

## Task 18: D3+D4 — Replace briefing with chart + inject briefing into chat

**Files:**
- Modify: `app/(dashboard)/page.tsx`

- [ ] **Step 1: Update imports and remove MorningBriefing**

In `app/(dashboard)/page.tsx`:

Remove these imports:
```tsx
import { MorningBriefing } from "@/components/briefing/morning-briefing";
```

Add these imports:
```tsx
import { BudgetChart } from "@/components/dashboard/budget-chart";
```

- [ ] **Step 2: Remove `dataSources` state and `fetchDataSources`**

Remove:
- `const [dataSources, setDataSources] = useState<DataSource[]>([]);` (line 16)
- The entire `fetchDataSources` callback (lines 44-51)
- `fetchDataSources();` from the useEffect (line 56)
- `DataSource` from the type imports if no longer used

The `DataSource` import can be removed since it was only used for `dataSources` state.

- [ ] **Step 3: Add briefing-into-chat logic**

After the `userId` effect resolves, add a new effect to auto-load the briefing into chat. Add this after the existing effects:

```tsx
// Auto-load morning briefing as first chat message
useEffect(() => {
  if (!userId) return;

  const cacheKey = `briefing_${userId}`;
  const cached = sessionStorage.getItem(cacheKey);

  if (cached) {
    setMessages([{
      id: "briefing_initial",
      userId,
      role: "agent",
      content: cached,
      timestamp: new Date(),
    }]);
    return;
  }

  // Stream briefing from chat API
  (async () => {
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          message: "Give me my morning briefing. Summarize my current financial position, list items needing attention by priority, and highlight anything that changed since last review. Be concise and executive-level.",
        }),
      });

      if (!res.ok || !res.body) return;

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let content = "";
      const msgId = "briefing_initial";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value);
        const lines = text.split("\n").filter((l) => l.startsWith("data: "));

        for (const line of lines) {
          try {
            const json = JSON.parse(line.replace("data: ", ""));
            if (json.done) break;
            if (json.token) {
              content += json.token;
              setMessages((prev) => {
                const existing = prev.find((m) => m.id === msgId);
                if (existing) {
                  return prev.map((m) =>
                    m.id === msgId ? { ...m, content } : m
                  );
                }
                return [{
                  id: msgId,
                  userId,
                  role: "agent" as const,
                  content,
                  timestamp: new Date(),
                }];
              });
            }
          } catch {
            // skip malformed SSE
          }
        }
      }

      if (content) {
        sessionStorage.setItem(cacheKey, content);
      }
    } catch {
      // Silent — briefing is non-critical
    }
  })();
}, [userId]);
```

- [ ] **Step 4: Replace MorningBriefing with BudgetChart in the right panel**

Replace the right panel content (the `right` prop of `ResizableSplitPane`, around line 292-309):

```tsx
right={
  <div className="flex flex-col h-full bg-slate-50/50 p-4 gap-4 border-l border-border/40">
    {/* Budget vs Actual Chart */}
    <div className="shrink-0 drop-shadow-sm">
      <BudgetChart />
    </div>

    {/* Chat Panel — briefing auto-loads + follow-up questions */}
    <div className="flex-1 min-h-0 rounded-xl border border-border/60 shadow-[0_2px_12px_rgba(0,0,0,0.02)] overflow-hidden">
      <ChatPanel
        messages={messages}
        onSend={(content) => handleSendMessage(content)}
        isStreaming={isStreaming}
      />
    </div>
  </div>
}
```

- [ ] **Step 5: Test in browser**

1. Navigate to `/` — Budget vs Actual chart shows in right panel top
2. Chat panel shows below chart
3. If data exists, briefing text streams into the chat as the first message
4. On next page visit (same tab), briefing loads instantly from sessionStorage cache
5. User can still send messages normally in the chat
6. All action card interactions still work

- [ ] **Step 6: Commit**

```bash
git add app/(dashboard)/page.tsx
git commit -m "feat(ui): replace briefing with budget chart, inject briefing into chat"
```

---

## Task 19: Final verification

- [ ] **Step 1: Run full test suite**

```bash
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 2: Check build**

```bash
npm run build
```

Expected: builds without errors. If `react-markdown` ESM error occurs, ensure `transpilePackages: ["react-markdown"]` is in `next.config.ts` (should be handled in Task 2).

- [ ] **Step 3: Full browser walkthrough**

1. `/documents` — react-markdown renders properly, error banners show on failure, generate race fix works
2. `/data-sources` — tabs switch between Variance and AR, upload works on both tabs, Google Sheet link form appears, re-analyze button on ready sources
3. `/` (dashboard) — stats strip above actions with counts + donut + top variances, compact card rows, click opens slide-over, all action buttons work in modal, chart shows budget vs actual, briefing streams into chat
4. Chat still works for follow-up questions after briefing loads

- [ ] **Step 4: Final commit (if any fixups needed)**

```bash
git add -A
git commit -m "fix: final V2 polish fixups"
```
