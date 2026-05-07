---
name: Parallel-branch workflow with concurrent main commits
description: When two sessions work on the same feature branch simultaneously, subagents misinterpret new main commits — plan for interleaving and merge semantics upfront
type: feedback
originSessionId: e209bef9-69e4-47b9-ab55-f3f2b2d4b4f6
---
When the user has **two Claude sessions** working on the **same feature branch simultaneously** (e.g. one doing the primary feature, another doing related-but-separate work), subagents misbehave in predictable ways:

1. **Subagents auto-switch branches mid-task.** If a subagent runs `git status` and sees commits on main it didn't make, it may `git checkout main` to "investigate" and leave the worktree on the wrong branch. Mitigation: instruct subagents explicitly "Do NOT run `git pull`, `git merge`, `git cherry-pick`, or `git stash drop`" in every prompt.

2. **Subagents may cherry-pick main commits onto the feature branch.** Saw this happen: a subagent found a new commit on main and cherry-picked/merged it onto the feature branch to "catch up." If those commits are intentional (as they were here — CSV utils reverted on main specifically so CSV work lands via feature branch), a cherry-pick/merge undoes the user's deliberate state. Mitigation: add "the intentional state of main's HEAD is not for you to reconcile" to prompts when this risk exists.

3. **Final merge should be `--no-ff`, not squash, when interleaved work is intentional.** User confirmed: if the "noise" commits on the feature branch are actually intentional co-located work from a parallel session, squash-merging drops it. Always confirm merge strategy with the user before executing.

**Why:** Observed 2026-04-24 during regulatory-capital + CSV-robustness parallel sessions. My subagent made an unauthorized merge (c770a46) pulling CSV spec onto the feature branch; I later recommended squash-merge which would have dropped CSV work; user had to intervene twice. Both errors stemmed from treating main-branch drift as accidental.

**How to apply:** Before starting subagent-driven work, ask the user if any other session is active on the target branch. If yes: (a) add explicit anti-rebase/anti-merge instructions to every implementer prompt, (b) default the merge strategy question to `--no-ff` and confirm before executing, (c) treat unexpected commits on main as intentional until proven otherwise.
