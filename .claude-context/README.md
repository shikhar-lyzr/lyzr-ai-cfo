# .claude-context/

Portable project context for Claude Code sessions. Anything in this directory is
committed to the repo so a fresh `git clone` gives a new Claude session the same
working knowledge as the original session.

## What's here

- `memory/MEMORY.md` — index of project memory entries, imported by `CLAUDE.md`
  via `@.claude-context/memory/MEMORY.md`. Auto-loaded into every session.
- `memory/*.md` — individual memory entries (user preferences, project facts,
  feedback, references). Loaded on-demand when MEMORY.md points to them.

## Relationship to Claude's auto-memory

Claude Code's auto-memory system writes to `~/.claude/projects/<key>/memory/` on
the local machine — outside the repo. This directory is a **committed snapshot**
of that auto-memory, so the context survives `git clone` to a new machine.

The two can drift:

- New memories Claude writes during a session land in `~/.claude/projects/...`,
  NOT here.
- To re-sync, copy from the live location into `.claude-context/memory/` and
  commit. (See `migrate/bundle-for-mac.ps1` for the Windows path; adapt for
  other OSes.)

A periodic re-sync is fine — the goal is that any fresh clone has *enough*
context to be productive, not that the snapshot is real-time.

## Adding new context types

If you find other Claude-readable artifacts that should travel with the repo
(scratch notes, decision logs, dataset descriptions), put them under
`.claude-context/` and reference them from `CLAUDE.md`.
