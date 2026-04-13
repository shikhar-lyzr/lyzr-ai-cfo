# V2 — Dashboard Polish: Doc Viewer, Tabbed Data Sources, Google Sheets, Stats Strip, Compact Cards

**Date:** 2026-04-14
**Branch:** main
**Groups:** A (Document Polish), B (Tabbed Data Sources + Google Sheets + Re-analyze), C (Stats Strip + Compact Cards + Slide-over Modal)
**Deferred:** Groups D (Daily Scheduler) and E (Cash Anomaly Detection) — separate specs

---

## Context

V1.5 (AR follow-ups) and V1.6 (documents, action card audit trail) are fully implemented. This spec covers the V2 polish pass across three areas:

- **A** — Fix the document viewer (react-markdown rendering, error visibility, race condition)
- **B** — Make the data sources page tab-aware by data type, add Google Sheets ingest via CSV export URL (no API key), add a re-analyze trigger
- **C** — Add a stats strip above the action feed, collapse action cards to compact rows that open a slide-over modal

---

## Group A: Document Polish

### A1 — react-markdown in document viewer

**File:** `components/documents/document-viewer.tsx`, `app/globals.css`

Install `react-markdown`. Replace the manual `body.split("\n").map(...)` rendering block with:

```tsx
import ReactMarkdown from "react-markdown";

<div className="doc-body max-w-none">
  <ReactMarkdown>{document.body}</ReactMarkdown>
</div>
```

Add `.doc-body` utility classes in `app/globals.css` inside `@layer components`:

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

If `next build` fails with an ESM error, add `"react-markdown"` to `transpilePackages` in `next.config.ts`.

### A2 — Error banners in documents page

**File:** `app/(dashboard)/documents/page.tsx`

The three `catch {}` blocks are currently silent. Changes:

1. Add `const [error, setError] = useState<string | null>(null)`
2. In each `catch` block, call `setError(message)` with a descriptive string
3. Call `setError(null)` in each success branch
4. Render a dismissable error banner between the page header and content area:

```tsx
{error && (
  <div className="mx-6 mt-3 flex items-center justify-between gap-3 px-4 py-2.5 bg-danger/10 border border-danger/20 rounded-card text-sm text-danger">
    <span>{error}</span>
    <button onClick={() => setError(null)} className="shrink-0 text-danger/60 hover:text-danger text-lg leading-none">×</button>
  </div>
)}
```

### A3 — Race condition fix in handleGenerate

**File:** `app/(dashboard)/documents/page.tsx`

`handleGenerate` currently calls `fetchDocuments()` without awaiting before `handleSelect(newDoc.id)`. The document list may not yet contain the new doc when the viewer tries to select it. Fix:

```ts
await fetchDocuments();
await handleSelect(newDoc.id);
```

---

## Group B: Tabbed Data Sources + Google Sheets + Re-analyze

### Architecture overview

```
Data Sources Page
├── Tab: Variance / P&L         Tab: AR / Invoices
│   ├── UploadArea (CSV)            UploadArea (CSV)
│   ├── LinkSheetArea               LinkSheetArea
│   └── SourceList (filtered)       SourceList (filtered)
│       └── [Re-analyze ↺]              [Re-analyze ↺]
```

Shape (`"variance"` or `"ar"`) is already stored in `metadata.shape` JSON by the upload route for all existing records. Tab filtering reads this field client-side.

### B1 — Shape filter on data-sources GET

**File:** `app/api/data-sources/route.ts`

Add optional `?shape=variance|ar` query param. After the Prisma query, filter client-side:

```ts
const shape = searchParams.get("shape");
const filtered = shape
  ? sources.filter(s => {
      try { return JSON.parse(s.metadata ?? "{}").shape === shape; }
      catch { return false; }
    })
  : sources;
return NextResponse.json(filtered);
```

No schema change. Backwards compatible — omitting `shape` returns all sources.

### B2 — Extract shared CSV helpers

**File:** `lib/csv/variance-parser.ts` (new)

Extract `parseCSV`, `autoDetectColumns`, and `parseRows` from `app/api/upload/route.ts` into this module and export them. Update the upload route to import from here. The link-sheet route (B3) will also import from here.

AR parsing is already in `lib/csv/ar-parser.ts` — no change needed.

### B3 — Google Sheets link endpoint

**File:** `app/api/data-sources/link-sheet/route.ts` (new)

`POST /api/data-sources/link-sheet` — accepts `{ url: string, shape: "variance" | "ar" }`.

**No API key required.** Uses Google Sheets' built-in CSV export URL:

```
https://docs.google.com/spreadsheets/d/{SHEET_ID}/export?format=csv&gid=0
```

The sheet must be shared with "Anyone with link can view". This is documented in the UI.

Implementation steps:
1. Extract sheet ID from URL with regex: `/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/`
2. Construct export URL and `fetch()` it server-side
3. On non-200 response: return `{ error: "Could not access sheet. Make sure it is shared with 'Anyone with link'." }` (422)
4. Parse CSV text using the same `parseCSV` from `lib/csv/variance-parser.ts`
5. For `shape === "ar"`: call `parseArCsv(headers, rows)`, upsert invoices, fire `analyzeArUpload` fire-and-forget
6. For `shape === "variance"`: call `autoDetectColumns`/`parseRows`, create `FinancialRecord` rows, fire `analyzeUpload` fire-and-forget
7. Create `DataSource` row with `type: "sheets"`, `status: "ready"`, `metadata: JSON.stringify({ shape, headers, sheetId })`
8. Return `{ dataSource, analysisStatus: "processing" }` (201)

Auth: call `getSession()` from `lib/auth.ts` — 401 if not authenticated.

### B4 — Re-analyze endpoint

**File:** `app/api/data-sources/[id]/reanalyze/route.ts` (new, requires creating directory)

`POST /api/data-sources/[id]/reanalyze`:
1. `getSession()` → 401 if not authenticated
2. Fetch data source, verify `dataSource.userId === session.userId` → 403
3. `dataSource.status !== "ready"` → 409
4. Read `metadata.shape` → call `analyzeUpload` or `analyzeArUpload` fire-and-forget
5. `await prisma.dataSource.update({ status: "processing" })`
6. Return `{ status: "processing" }`

### B5 — LinkSheetArea component

**File:** `components/data-sources/link-sheet-area.tsx` (new)

Props: `shape: "variance" | "ar"`, `onLink: (url: string) => Promise<void>`, `isLinking: boolean`

A compact card containing:
- Label: "Link a Google Sheet"
- Helper text: "Share your sheet with 'Anyone with link' first"
- URL `<input type="url">` with placeholder `https://docs.google.com/spreadsheets/d/...`
- Submit button "Connect Sheet" with spinner when `isLinking`

### B6 — Tabbed data sources page

**File:** `app/(dashboard)/data-sources/page.tsx` (refactor)

New state:
- `activeTab: "variance" | "ar"` (default `"variance"`)
- `isLinking: boolean`

Tab header (no new library):
```tsx
<div className="flex border-b border-border">
  {(["variance", "ar"] as const).map(tab => (
    <button
      key={tab}
      onClick={() => setActiveTab(tab)}
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
```

Client-side source filtering:
```ts
const filteredSources = sources.filter(s => {
  try { return JSON.parse((s.metadata as string) ?? "{}").shape === activeTab; }
  catch { return false; }
});
```

`handleLink` function:
```ts
const handleLink = async (url: string) => {
  setIsLinking(true);
  const res = await fetch("/api/data-sources/link-sheet", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, shape: activeTab }),
  });
  if (res.ok) {
    setUploadResult("✓ Sheet connected. AI is analyzing in the background...");
    fetchSources();
    setTimeout(() => router.push("/"), 1500);
  } else {
    const data = await res.json().catch(() => ({}));
    setUploadResult(`Error: ${(data as { error?: string }).error ?? "Failed to connect sheet"}`);
  }
  setIsLinking(false);
};
```

`handleReanalyze` function:
```ts
const handleReanalyze = async (id: string) => {
  await fetch(`/api/data-sources/${id}/reanalyze`, { method: "POST" });
  fetchSources();
  setTimeout(() => router.push("/"), 1000);
};
```

### B7 — Re-analyze button in SourceList

**File:** `components/data-sources/source-list.tsx`

- Add `"use client"` directive
- Add prop `onReanalyze?: (id: string) => Promise<void>`
- Add `reanalyzingIds` state (`useState<Set<string>>(new Set())`)
- For `status === "ready"` sources, render a `RefreshCw` icon button that calls `onReanalyze` and tracks state in `reanalyzingIds`

---

## Group C: Stats Strip + Compact Cards + Slide-over Modal

### C1 — Stats API

**File:** `app/api/stats/route.ts` (new)

`GET /api/stats` — reads `userId` from session (via `getSession()`).

Three parallel Prisma queries:

```ts
const [actionGroups, invoices, records] = await Promise.all([
  prisma.action.groupBy({ by: ["severity"], where: { userId }, _count: true }),
  prisma.invoice.findMany({ where: { dataSource: { userId } }, select: { dueDate: true, status: true } }),
  prisma.financialRecord.findMany({ where: { dataSource: { userId } }, select: { category: true, actual: true, budget: true } }),
]);
```

Response shape:
```ts
{
  actions: { critical: number; warning: number; info: number; total: number };
  ar: { info: number; warning: number; critical: number; total: number } | null;
  topCategories: Array<{ category: string; variance: number; direction: "over" | "under" }>;
}
```

AR bucketing (JS-side, skip `status === "paid"`):
- `info`: due in > 30 days or not yet due
- `warning`: 1–30 days overdue
- `critical`: > 30 days overdue

Return `ar: null` if no invoices exist (hides the donut from the strip).

Top categories: group `financialRecord` by `category`, sum `actual - budget`, sort by `Math.abs`, top 3.

Add `StatsData` type to `lib/types.ts`.

### C2 — Stats strip component

**File:** `components/feed/stats-strip.tsx` (new)

Props: `stats: StatsData`

Layout: `flex gap-3 px-4 py-3 border-b border-border shrink-0`

Three sections:

**1. Action counts**
Three stat blocks side by side. Each: `text-2xl font-bold` number + `text-[10px] uppercase tracking-wide text-text-secondary` label. Colors: danger/warning/success.

**2. AR aging donut** (hidden when `stats.ar === null`)
CSS conic-gradient donut:
```tsx
<div className="relative w-12 h-12 rounded-full shrink-0" style={{
  background: `conic-gradient(
    var(--success) 0% ${infoPct}%,
    var(--warning) ${infoPct}% ${infoPct + warnPct}%,
    var(--danger) ${infoPct + warnPct}% 100%
  )`
}}>
  <div className="absolute inset-[6px] bg-bg-card rounded-full flex items-center justify-center">
    <span className="text-[9px] font-bold text-text-primary">{stats.ar.total}</span>
  </div>
</div>
```

**3. Top variances**
Ranked list (max 3 items). Each item: category name + proportional inline CSS bar (max 80px wide) + `TrendingUp`/`TrendingDown` icon from lucide-react.

### C3 — ActionModal (slide-over)

**File:** `components/feed/action-modal.tsx` (new)

Renders via `ReactDOM.createPortal(content, document.body)`.

Structure:
- **Backdrop**: `fixed inset-0 bg-black/40 backdrop-blur-[2px] z-40` — click closes modal
- **Panel**: `fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-bg-card flex flex-col shadow-xl`

Entry animation:
```tsx
const [visible, setVisible] = useState(false);
useEffect(() => { requestAnimationFrame(() => setVisible(true)); }, []);
// panel className includes: transition-transform duration-200
// translate-x-full when !visible, translate-x-0 when visible
```

Side effects on mount/unmount:
- Escape key listener: `document.addEventListener("keydown", handler)`
- Body scroll lock: `document.body.style.overflow = "hidden"`, restored on unmount

State (all lives here, not in ActionCard):
- `draftBody: string | null`
- `loadingDraft: boolean`
- `showHistory: boolean`
- `events: ActionEvent[]`
- `loadingEvents: boolean`

AR cards auto-fetch draft body on mount via `useEffect`.

Content: full current card body — headline, detail, driver, source, action buttons, history toggle. All action button handlers (`onFlag`, `onApprove`, `onAskAI`, `onDismiss`, `onArOp`) passed as props from `ActionCard` → `ActionModal`.

### C4 — ActionCard rewrite to compact row

**File:** `components/feed/action-card.tsx` (rewrite)

New props (additions):
```ts
isSelected: boolean;
onSelect: (id: string) => void;
onClose: () => void;
```

Zero local state. All state lives in `ActionModal`.

Compact row (~52px):
```
[● severity dot] [headline truncated flex-1] [status chip?] [source] [time ago] [›]
```

Classes:
```
flex items-center gap-3 bg-bg-card rounded-card border border-border shadow-card
px-3 h-[52px] cursor-pointer hover:border-accent-primary/40 transition-all group
```

- **Severity dot**: `w-2.5 h-2.5 rounded-full shrink-0` colored by severity
- **Status chip** (only when not pending): `text-[10px] px-1.5 py-0.5 rounded-full bg-border/20 text-text-secondary border-border shrink-0`
- **Source**: `text-xs text-text-secondary hidden sm:block truncate max-w-[100px]`
- **Time**: `text-xs text-text-secondary shrink-0`
- **Chevron**: `ChevronRight` icon, `text-text-secondary group-hover:text-text-primary`
- `onClick={() => onSelect(action.id)}`
- Renders `<ActionModal>` when `isSelected === true`

### C5 — Wire stats into ActionFeed + dashboard page

**File:** `components/feed/action-feed.tsx`

- Add `userId: string` to `ActionFeedProps`
- Fetch stats on mount: `fetch("/api/stats")`
- Render `{stats && <StatsStrip stats={stats} />}` as `shrink-0` between feed header and `FilterBar`
- Add `selectedActionId: string | null` state
- Pass `isSelected={selectedActionId === action.id}`, `onSelect={setSelectedActionId}`, `onClose={() => setSelectedActionId(null)}` to each `ActionCard`

**File:** `app/(dashboard)/page.tsx`

- Pass `userId={userId}` to `<ActionFeed>`

---

## Execution Order

| Step | File(s) | Notes |
|------|---------|-------|
| 1 | `npm install react-markdown` | First |
| 2 | `app/globals.css` | Add `.doc-body` styles |
| 3 | `components/documents/document-viewer.tsx` | A1 — replace manual render |
| 4 | `app/(dashboard)/documents/page.tsx` | A2+A3 — error banners + race fix |
| 5 | `lib/csv/variance-parser.ts` | B2 — extract shared CSV helpers |
| 6 | `app/api/upload/route.ts` | B2 — update imports |
| 7 | `app/api/data-sources/route.ts` | B1 — shape filter |
| 8 | `app/api/data-sources/link-sheet/route.ts` | B3 — new route |
| 9 | `app/api/data-sources/[id]/reanalyze/route.ts` | B4 — new route |
| 10 | `components/data-sources/link-sheet-area.tsx` | B5 — new component |
| 11 | `components/data-sources/source-list.tsx` | B7 — re-analyze button |
| 12 | `app/(dashboard)/data-sources/page.tsx` | B6 — tabbed page |
| 13 | `lib/types.ts` | C1 — add StatsData type |
| 14 | `app/api/stats/route.ts` | C1 — stats endpoint |
| 15 | `components/feed/stats-strip.tsx` | C2 — stats strip |
| 16 | `components/feed/action-modal.tsx` | C3 — slide-over modal |
| 17 | `components/feed/action-card.tsx` | C4 — compact row rewrite |
| 18 | `components/feed/action-feed.tsx` | C5 — wire stats + selection |
| 19 | `app/(dashboard)/page.tsx` | C5 — pass userId |

---

## Verification Checklist

- [ ] Documents: markdown headings/bold/lists render correctly. Network failure shows dismissable error banner.
- [ ] Race fix: newly generated document is selected immediately without stale list.
- [ ] Data sources tabs: Variance tab shows only variance sources; AR tab shows only AR sources.
- [ ] Upload on either tab routes to correct pipeline (auto-detected by existing `detectCsvShape`).
- [ ] Google Sheets: paste a public sheet URL → "Connect Sheet" → data ingested → agent runs → actions appear on dashboard.
- [ ] Google Sheets: private/invalid URL shows clear error message.
- [ ] Re-analyze: click ↺ on a ready source → status flips to processing → new actions appear.
- [ ] Stats strip: shows action counts (danger/warning/success), AR donut only when AR data exists, top 3 variance categories.
- [ ] Compact cards: 52px rows in feed. Click → slide-over opens from right. Escape closes. Backdrop click closes.
- [ ] AR modal: draft auto-loads on open. Copy & Mark Sent / Snooze / Escalate work inside modal.
- [ ] Variance modal: Approve / Flag / Ask AI / Dismiss work inside modal.
- [ ] History toggle works inside modal for resolved cards.
- [ ] No regressions: existing upload flow, chat, documents generation still work.

---

## Deferred

- **Group D — Daily Scheduler**: proactive agent cron, Inngest integration, `lastScannedAt` on User model
- **Group E — Cash Anomaly Detection**: `detect_cash_anomalies` tool, new action type, filter bar chip
