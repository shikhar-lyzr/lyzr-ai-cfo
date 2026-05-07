---
name: Superpowers discipline under pressure
description: Must use superpowers skills proactively EVERY TIME even when task seems simple — user has flagged this repeatedly as ongoing issue
type: feedback
originSessionId: d7a4a5dd-4d0d-4c71-8dc5-d4781e04098c
---
Use systematic-debugging from the FIRST sign of a bug, not after multiple failed patch attempts. Use brainstorming before rewriting tools or changing architecture. Use verification-before-completion before telling the user to re-test.

**Why:** User has flagged this multiple times (as of 2026-04-13) as an ongoing issue. Even with memory updated, Claude keeps skipping skills. User was frustrated after multiple "upload again" cycles and after sessions where skills were not invoked despite being required.

**How to apply:** This is a BLOCKING requirement. When ANY task arrives:
1. Check which superpowers skills apply BEFORE doing anything else
2. Invoke the skill via the Skill tool — do not just mentally apply it
3. For bugs: systematic-debugging FIRST, always
4. For features/changes: brainstorming FIRST, always
5. Before claiming done: verification-before-completion FIRST, always
6. NEVER rationalize skipping a skill ("this is simple enough", "I already know the answer")
