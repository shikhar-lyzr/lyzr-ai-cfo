---
name: Debug systemically, not reactively
description: When a bug symptom appears, map the full path and verify each layer in isolation before making changes
type: feedback
---

**Rule:** When debugging a multi-layer failure (e.g. "chat returns blank"), resist the urge to fix whatever the next log line complains about and restart. Instead: (1) map the full request path end-to-end, (2) identify what each layer expects (env vars, model IDs, request bodies, auth), (3) test each layer in isolation — especially external dependencies — with a minimal tool like `curl` *before* wiring through the full stack, (4) only then make code changes.

**Why:** On 2026-04-09 the user called this out mid-debugging. I had been chain-reacting on a "blank chat" symptom: restarted server → hit "No API key for provider: google" → patched env var name → restarted → hit Gemini 429 quota → about to propose a provider switch. Two of those restarts were unnecessary — a single upfront `curl https://generativelanguage.googleapis.com/...` would have shown both that the key name was wrong AND that the specific model had zero quota, in one shot, without touching any code. The user asked "are you doing systemic debugging?" and they were right that I wasn't.

**How to apply:**
- Before editing code to chase an error, ask: "can I reproduce this outside the app?" If yes, do that first — usually one or two curl/shell commands.
- For any external API dependency (LLM providers, third-party services), the first diagnostic step is a direct call bypassing your own code. This separates "our code is broken" from "the dependency is broken".
- When fixing a silent-failure class of bug (blank response, hung request, empty result), treat error-path handling as a parallel bug that's independent of the immediate cause — fix both in the same pass, since the next upstream failure will reproduce the silent symptom.
- If a memory entry says "X works this way" and reality disagrees, verify against the source (node_modules, official docs) rather than trusting the memory — memories go stale.
