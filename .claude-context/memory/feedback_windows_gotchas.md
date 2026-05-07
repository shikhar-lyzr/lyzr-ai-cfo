---
name: Windows bash gotchas for this project
description: Non-obvious Windows+bash behaviors that bit us during dev server management
type: feedback
---

**Rule:** On Windows bash, `TaskStop` of a background `npm run dev` leaves the underlying node process alive holding port 3000. Always follow with `taskkill //PID <pid> //F` if you need the port freed.

**Why:** During the 2026-04-09 demo debugging session, `TaskStop` reported success but the next `npm run dev` failed with "Another next dev server is already running. PID: 26128". The TaskStop killed the bash wrapper, not the node child.

**How to apply:**
- Use `//PID` and `//F` (double slashes) in Windows bash for taskkill flags — single slash is interpreted as a path.
- After stopping a dev server task, verify port is free with `netstat -ano | grep :3000` before restarting.
- Next.js only reads `.env` at startup, so any env var change requires a full restart (not just HMR).
