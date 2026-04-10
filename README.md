# lyzr-ai-cfo

AI CFO Terminal — proactive financial variance detection powered by the Lyzr Agent Studio via gitclaw.

## Getting Started

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Requires `LYZR_API_KEY` in `.env`.

## Architecture

- **Actions feed** — primary surface. Variance flags created by the gitclaw agent after CSV upload.
- **Morning Briefing** — auto-generated executive summary on dashboard load.
- **Chat** — follow-up questions routed through the Lyzr agent.
- **CSV upload** — regex column autodetect with LLM fallback for non-standard headers.

See `session-summary.md` for full technical handoff.
