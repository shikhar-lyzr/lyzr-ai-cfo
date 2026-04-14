/**
 * Build the `allowedTools` list for gitclaw `query()` calls.
 *
 * Includes every provided tool name plus the gitclaw builtins that the agent
 * needs to function as a learning git-agent:
 *
 *  - `read`           — load skill/knowledge files from the agent directory
 *  - `memory`         — git-backed memory (load/save → commits to repo)
 *  - `task_tracker`   — track multi-step tasks within a session
 *  - `skill_learner`  — crystallize repeated patterns into new skills
 *
 * Deliberately excluded:
 *  - `cli`   — arbitrary shell execution on the server; memory tool already
 *              handles git commits internally
 *  - `write` — arbitrary file writes; skill_learner handles skill file
 *              creation through a controlled interface
 */

const REQUIRED_BUILTINS = [
  "read",
  "memory",
  "task_tracker",
  "skill_learner",
];

export function buildAllowedTools(tools: ReadonlyArray<{ name: string }>): string[] {
  const names = tools.map((t) => t.name);
  for (const builtin of REQUIRED_BUILTINS) {
    if (!names.includes(builtin)) names.push(builtin);
  }
  return names;
}
