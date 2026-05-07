---
name: Turbopack root must be pinned in worktrees
description: Worktrees under C:\Users\shikh\ need turbopack.root in next.config.ts; otherwise .env loads from wrong location and process.env keys are undefined
type: feedback
originSessionId: 465f934f-6788-4251-9641-526cb10e5f76
---
When `next dev --turbopack` runs from a path under `C:\Users\shikh\`, Turbopack
walks up looking for the topmost `package-lock.json` and picks
`C:\Users\shikh\` as the "workspace root" (a stray lockfile sits there from
some earlier global install). Result: Next loads `.env` from `C:\Users\shikh\`
(which has no AI keys), not from the project / worktree.

**Symptom:** route handler reads `process.env.OPENAI_API_KEY` and gets
`undefined`, falls into a fallback branch — for `app/api/chat/route.ts` that's
the literal "AI engine isn't configured — set OPENAI_API_KEY, LYZR_API_KEY, or
GEMINI_API_KEY" message even though the worktree's `.env` has all three keys.

**Fix:** add to `next.config.ts`:
```ts
turbopack: { root: process.cwd() },
```

The v1.5-ar-followups worktree already has this; main and any new worktree
must too. Look for the warning line in dev startup output:
`We detected multiple lockfiles and selected the directory of
C:\Users\shikh\package-lock.json as the root directory.`

**Why:** Confirmed 2026-04-27 in the unified-decision-inbox worktree.
Without the config, dev server loaded `.env` from the wrong place; chat
returned a hardcoded placeholder reply that looked like a missing-key error
even though SDK init logs showed `Injected 22 external tools`.

**How to apply:** When setting up a new worktree, copy `next.config.ts` from
a working sibling (or just add the `turbopack.root` block) BEFORE first
`npm run dev`. If you see the multiple-lockfiles warning during startup, the
config is missing.
