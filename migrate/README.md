# Windows → Mac handoff bundle

Moves the non-git pieces of a Claude Code session for this project:

- `.env*` files (excluding `.env.example`, which is already in git)
- Claude auto-memory for this project (`~/.claude/projects/<key>/memory/`)

Everything else (code, specs, plans, CLAUDE.md, AGENTS.md) is in git — push from Windows, clone on Mac.

## On Windows

```powershell
# from repo root
git status                                # make sure work is committed/stashed
git push
pwsh ./migrate/bundle-for-mac.ps1
```

Outputs `migrate/lyzr-cfo-handoff-<timestamp>.tar.gz`. Transfer it to the Mac (AirDrop / scp / iCloud / USB).

## On Mac

```bash
# 1. install Claude Code
npm install -g @anthropic-ai/claude-code

# 2. clone the repo
git clone <your-remote> ~/lyzr-ai-cfo

# 3. unpack the bundle and restore
mkdir -p /tmp/lyzr-handoff
tar -xzf ~/Downloads/lyzr-cfo-handoff-*.tar.gz -C /tmp/lyzr-handoff
bash /tmp/lyzr-handoff/restore-on-mac.sh ~/lyzr-ai-cfo

# 4. install deps and start
cd ~/lyzr-ai-cfo
npm install
claude
```

The restore script computes the Mac-side Claude project key automatically from the cloned path.

## What does NOT travel

- Global Claude settings (`~/.claude/settings.json`) — copy manually if you want plugins/MCP servers/permissions to match
- Installed plugins under `~/.claude/plugins/` — re-install on Mac
- `node_modules/` — `npm install` regenerates these

## Windows-specific memory entries

A few memory files are Windows-only (taskkill behavior, Node orphans, Turbopack `.env` path issue). They're harmless on Mac, just stale context. Delete if you want a cleaner index:

- `feedback_windows_gotchas.md`
- `feedback_node_orphans_after_dev_kills.md`
- `feedback_turbopack_root_in_worktrees.md` (verify the next.config.ts pin still applies)

Also drop the matching lines from `MEMORY.md`.
