---
name: tsx in worktrees resolves to parent repo's node_modules
description: One-off scripts run via tsx from outside a worktree's cwd resolve `@/lib/db` to the parent repo's Prisma client, missing new schema additions
type: feedback
originSessionId: 94b023d6-a34f-4093-ad5a-d92f03f76b66
---
When running a tsx script in a git worktree that has a different Prisma schema than the parent repo (e.g. a feature branch with a new model), invoke tsx from **inside** the worktree's cwd, not from the parent. From the parent, Node's module resolution climbs up and uses the parent's `node_modules/@prisma/client`, which doesn't have the new schema's models — error looks like `TypeError: Cannot read properties of undefined (reading 'create')` on `tx.<newModel>.create`.

**Why:** `npx --prefix <worktree-path> tsx <worktree-path>/script.ts` is not enough — the resolver still considers parent paths. Only fix is to actually `cd` into the worktree before invoking.

**How to apply:** When seeding/debugging in a worktree, always `cd <worktree>` first. Verified during Phase 1 smoke test (2026-04-27) — the seed script ran fine with `cd .worktrees/phase1-honest-observe && npx tsx scripts/seed-test-decision.ts <userId>` after failing from the parent root.
