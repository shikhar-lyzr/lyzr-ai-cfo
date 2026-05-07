---
name: Okra AI CMO target product reference
description: The Okra AI CMO Terminal is the shape the user is building toward — CFO equivalent, not a dashboard
type: reference
---

The user's target product shape is **Okra's AI CMO Terminal** (not the Okra/Plaid-for-Africa data API). They're building the CFO equivalent.

**Key shape elements from screenshot (2026-04-10):**
- Header status "AI CMO Terminal · Running Daily" — it's a scheduled/proactive agent, not user-triggered
- **Actions Feed** is the primary surface (not chat). Cards are AI-produced deliverables categorized by source: Reddit Opportunities, SEO & GEO Recommendations, X Writer, Articles, Hacker News, LinkedIn Writer. Each shows a count/status like "2 mentions ready" or "Found 2 issues".
- **Talk to AI CMO** chat is secondary. Opens with morning-briefing style: *"hi, i'm your cmo. thanks for bringing me on. if you've paid to rent me fully, every day i'll send you: • 2 seo/geo issues to fix • 1 written article • 2 reddit opportunities..."* The pitch is "rent an AI executive", not "buy dashboarding software".
- **Analytics** side panel with real integrations (Search Console, Lighthouse scores, Core Web Vitals) — actual data in, not just uploads
- **Documents** section (Product Information, Competitor Analysis, Brand Voice, Marketing Strategy, Articles) — agent-generated artifacts marked "New" when updated
- **Plan gating** — "unlock on the Max plan" overlays on premium features

**CFO translation for this project:**
- Action feed categories: Variance (have), AR Aging (missing), Cash Anomalies (missing), Vendor Alerts (missing), Forecast Deltas (missing), Close Prep (missing)
- Daily deliverables from chat opener should list: N variance flags, N AR follow-ups, N anomaly reviews, monthly commentary draft
- Documents section: monthly variance report, board commentary draft, audit log, close checklist
- Integrations tier per spec: CSV (have), Google Sheets (missing), QuickBooks/Xero (future)
- Scheduler is required — "Running Daily" is the whole point, not just on-upload analysis

**Why this matters:** When the user says "build on top of gitagent like Okra", they mean the agent OWNS the workflow and produces the deliverables on a schedule. The web app renders what the agent produces and accepts user approvals. The current code has variance math in TypeScript route handlers and treats the agent as a commentator on top — that's inverted from the target shape.
