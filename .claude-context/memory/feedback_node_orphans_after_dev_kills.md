---
name: Node orphan processes accumulate after dev-server kill cycles
description: Killing Next dev with taskkill /F leaves child workers behind; over many restart cycles they exhaust the process table and vitest workers start crashing
type: feedback
originSessionId: 465f934f-6788-4251-9641-526cb10e5f76
---
On Windows + bash, repeatedly starting and force-killing `next dev --turbopack`
(or interrupting `npm install`, etc.) leaves dozens of orphan `node.exe`
processes behind — Turbopack's worker pool, npm's install workers, and any
SDK that spawned children. They show as 2-MB-each ghost processes that aren't
listening on any port and aren't doing real work.

**Symptom**: vitest worker forks start failing intermittently with
"Worker exited unexpectedly" or "Failed to start forks worker". Test files
appear to fail but the assertions never ran. Free RAM may also collapse
(seen 15.7 GB total → 2 GB free with 971 node processes alive).

**Detection** (PowerShell):
```ps1
Get-Process -Name node | Measure-Object  # count
Get-Process -Name node | Group-Object @{E={[int]($_.WorkingSet/1MB)}} | Sort-Object Count -Desc
```
If you see hundreds of 2-MB nodes, that's the orphan herd.

**Cleanup** (PowerShell, kills only small orphans, preserves working processes):
```ps1
Get-Process -Name node | Where-Object { $_.WorkingSet/1MB -lt 10 } | Stop-Process -Force
```
Caveat: in this session the cleanup also took down the active dev server
because it had spawned children that were all under 10MB at that moment.
Safer: identify the dev server PID via `netstat -ano | grep :3100` first
and exclude it explicitly.

**Why it matters**: when the test suite shows "N tests failed" without
real assertion errors, check the process table BEFORE blaming the diff.
Confirmed 2026-04-27: 18 spurious vitest failures vanished after killing
963 orphans; full suite went from 364/382 to 398/398.

**Prevention**: prefer `kill -INT` / SIGTERM where possible over taskkill
/F so Next gets a chance to reap its workers. Or accept that long sessions
with many dev restarts will need a periodic process-table sweep.
