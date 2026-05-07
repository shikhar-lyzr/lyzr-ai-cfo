---
name: gitclaw SDK identity and constraints
description: Which gitclaw package this project uses and what providers it supports
type: reference
---

Project uses `gitclaw@1.3.3` from **open-gitagent/gitclaw** (author: shreyaskapale), NOT `zavora-ai/gitclaw` (an unrelated git-signing SDK with the same name on GitHub). Don't confuse the two when searching.

**Supported providers** (per `node_modules/gitclaw/README.md:586-599`): anthropic, openai, google, xai, groq, mistral. Nothing else. The `LYZR_API_KEY` reference in `dist/loader.js:291-299` is a generic Bearer-token fallback — it only works if the target URL speaks OpenAI format.

**Load-bearing config:** `next.config.ts` must keep `serverExternalPackages: ["gitclaw"]`. Without it, Turbopack tries to bundle gitclaw's transitive deps (baileys → jimp) and fails. Also `replaceBuiltinTools: true` is required when calling the SDK — otherwise gitclaw loads built-in cli/read/write/memory tools that drag in the same bad deps.

**Verification script:** `node --env-file=.env scripts/verify-loadagent.mjs` loads the agent without making a model call; expect a 13,441-char system prompt with 8 sections.
