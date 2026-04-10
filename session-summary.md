# Technical Handoff: Lyzr AI CFO

This document represents the finalized technical state of the Lyzr AI CFO project at the conclusion of this session. Future sessions should base their architecture understanding on these verified patterns.

## 1. Lyzr Studio Integration (Resolved)

The core LLM engine has been successfully migrated from Google Gemini directly to the **Lyzr Agent Studio v4 Endpoint**.
- **The Bug**: The API was returning `404 Agent not found`.
- **The Cause**: The Agent ID provided from the Lyzr Studio UI URL (`69d840...`) was a routing slug, not the backend `_id`.
- **The Fix**: Polled the `v3/agents/` API to extract the true internal ID.
- **Current Model Config**: `lyzr:69d43ccef008dd037bad64d7@https://agent-prod.studio.lyzr.ai/v4`

## 2. Universal API Key Unification

Previously, `gitclaw`, the CSV Upload parser, and the Chat endpoint were hard-checking for `GEMINI_API_KEY`, causing crashes. All checks have been abstracted:
- Core configuration in `lib/agent/index.ts`, `app/api/upload/route.ts`, `app/api/chat/route.ts`, and `app/api/seed-demo/route.ts`.
- **Unified Provider Check**: Application now checks `if (process.env.OPENAI_API_KEY || process.env.LYZR_API_KEY || process.env.GEMINI_API_KEY)`.
- **Environment**: Added `OPENAI_API_KEY` to `.env` pointing to the exact same SK as `LYZR_API_KEY` so the underlying SDK routing handles Bearer auth correctly.

## 3. Intelligent CSV Mapping Fallback

- The `inferColumnMapping` function (`lib/csv/llm-mapper.ts`) handles non-standard CSV headers (e.g. mapping "Cost Center" to "Account").
- **Migration**: Refactored entirely to prefer the Lyzr Agent Engine via standard OpenAI fetch requests, with a secondary legacy fallback to Gemini REST.
- **Robustness**: Extracts JSON explicitly using regex fence stripping `(/```(?:json)?\s*([\s\S]*?)```/)` to handle varying LLM outputs.

## 4. UI / UX Layout Overhaul

The user interface was refined to emulate the clean, modular aesthetic of the "AI CMO" interface.
- **Data Upload Flow**: Upon successful CSV upload, the application now programmatically redirects (`router.push("/")`) the user to the Dashboard instead of printing inline agent summaries, centralizing the experience.
- **Dedicated Briefing Component**: Extracted the "Morning Briefing" from the chat stream into a specialized, stateful component `components/briefing/morning-briefing.tsx`.
- **Card-Based Sidebar Styling**:
  - The right-hand dashboard pane now uses a `bg-slate-50` canvas (`app/(dashboard)/page.tsx`).
  - The `MorningBriefing` and `ChatPanel` sit inside independent, floating `rounded-xl shadow-[0_2px_12px_rgba(0,0,0,0.02)]` cards with physical `gap-4` separation.
  - The Morning Briefing is collapsible and implements manual re-fetch capabilities via the GitClaw SSE endpoint.

## 5. Agent Architecture Context (Path A)

- **Agent-First Rule**: The GitClaw agent remains the sole source of truth for variance detection.
- **Bulk Insert Tooling**: To maintain rate limits, the agent uses a batched `create_actions` Prisma tool during upload ingestion, rather than firing individual RPCs for each variance.
