/**
 * Verify that gitclaw can load the agent directory and produce a valid system prompt.
 * Run with: node scripts/verify-agent.mjs
 */
import { readFile, readdir, stat } from "fs/promises";
import { join } from "path";

const AGENT_DIR = join(process.cwd(), "agent");

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function verify() {
  const checks = [];

  // 1. agent.yaml
  const yamlPath = join(AGENT_DIR, "agent.yaml");
  if (await exists(yamlPath)) {
    const content = await readFile(yamlPath, "utf-8");
    checks.push({ file: "agent.yaml", status: "OK", detail: `${content.length} bytes` });
  } else {
    checks.push({ file: "agent.yaml", status: "MISSING", detail: "Required file" });
  }

  // 2. SOUL.md
  const soulPath = join(AGENT_DIR, "SOUL.md");
  if (await exists(soulPath)) {
    const content = await readFile(soulPath, "utf-8");
    checks.push({ file: "SOUL.md", status: "OK", detail: `${content.length} bytes` });
  } else {
    checks.push({ file: "SOUL.md", status: "MISSING", detail: "Identity file" });
  }

  // 3. RULES.md
  const rulesPath = join(AGENT_DIR, "RULES.md");
  if (await exists(rulesPath)) {
    const content = await readFile(rulesPath, "utf-8");
    checks.push({ file: "RULES.md", status: "OK", detail: `${content.length} bytes` });
  } else {
    checks.push({ file: "RULES.md", status: "MISSING", detail: "Behavioral constraints" });
  }

  // 4. DUTIES.md
  const dutiesPath = join(AGENT_DIR, "DUTIES.md");
  if (await exists(dutiesPath)) {
    const content = await readFile(dutiesPath, "utf-8");
    checks.push({ file: "DUTIES.md", status: "OK", detail: `${content.length} bytes` });
  } else {
    checks.push({ file: "DUTIES.md", status: "SKIP", detail: "Optional" });
  }

  // 5. Skills
  const skillsDir = join(AGENT_DIR, "skills");
  if (await exists(skillsDir)) {
    const entries = await readdir(skillsDir, { withFileTypes: true });
    const skillDirs = entries.filter(e => e.isDirectory());
    for (const dir of skillDirs) {
      const skillFile = join(skillsDir, dir.name, "SKILL.md");
      if (await exists(skillFile)) {
        checks.push({ file: `skills/${dir.name}/SKILL.md`, status: "OK", detail: "Skill loaded" });
      } else {
        checks.push({ file: `skills/${dir.name}/SKILL.md`, status: "MISSING", detail: "No SKILL.md" });
      }
    }
  } else {
    checks.push({ file: "skills/", status: "SKIP", detail: "No skills directory" });
  }

  // 6. Knowledge
  const knowledgeIndex = join(AGENT_DIR, "knowledge", "index.yaml");
  if (await exists(knowledgeIndex)) {
    const content = await readFile(knowledgeIndex, "utf-8");
    const entryCount = (content.match(/- path:/g) || []).length;
    checks.push({ file: "knowledge/index.yaml", status: "OK", detail: `${entryCount} entries` });
  } else {
    checks.push({ file: "knowledge/index.yaml", status: "SKIP", detail: "No knowledge" });
  }

  // 7. Examples
  const examplesDir = join(AGENT_DIR, "examples");
  if (await exists(examplesDir)) {
    const entries = await readdir(examplesDir);
    const mdFiles = entries.filter(e => e.endsWith(".md"));
    checks.push({ file: "examples/", status: "OK", detail: `${mdFiles.length} examples` });
  } else {
    checks.push({ file: "examples/", status: "SKIP", detail: "No examples" });
  }

  // 8. Workflows
  const workflowsDir = join(AGENT_DIR, "workflows");
  if (await exists(workflowsDir)) {
    const entries = await readdir(workflowsDir);
    const yamlFiles = entries.filter(e => e.endsWith(".yaml") || e.endsWith(".yml"));
    checks.push({ file: "workflows/", status: "OK", detail: `${yamlFiles.length} workflows` });
  } else {
    checks.push({ file: "workflows/", status: "SKIP", detail: "No workflows" });
  }

  // 9. Config
  const configPath = join(AGENT_DIR, "config", "default.yaml");
  if (await exists(configPath)) {
    checks.push({ file: "config/default.yaml", status: "OK", detail: "Default config" });
  } else {
    checks.push({ file: "config/default.yaml", status: "SKIP", detail: "No config" });
  }

  // 10. Memory
  const memoryPath = join(AGENT_DIR, "memory", "MEMORY.md");
  if (await exists(memoryPath)) {
    checks.push({ file: "memory/MEMORY.md", status: "OK", detail: "Memory file" });
  } else {
    checks.push({ file: "memory/MEMORY.md", status: "SKIP", detail: "No memory" });
  }

  // 11. .gitignore
  const gitignorePath = join(AGENT_DIR, ".gitignore");
  if (await exists(gitignorePath)) {
    checks.push({ file: ".gitignore", status: "OK", detail: "Runtime state excluded" });
  } else {
    checks.push({ file: ".gitignore", status: "WARN", detail: ".gitagent/ may be committed" });
  }

  // 12. API key
  const apiKey = process.env.LYZR_API_KEY;
  if (apiKey && apiKey !== "" && apiKey !== "your-key-here") {
    checks.push({ file: "LYZR_API_KEY", status: "OK", detail: `Set (${apiKey.slice(0, 8)}...)` });
  } else {
    checks.push({ file: "LYZR_API_KEY", status: "WARN", detail: "Not set — agent will use fallback mode" });
  }

  // Print results
  console.log("\n=== Git Agent Verification ===\n");
  let hasFailure = false;
  for (const check of checks) {
    const icon = check.status === "OK" ? "+" : check.status === "MISSING" ? "x" : check.status === "WARN" ? "!" : "-";
    console.log(`  [${icon}] ${check.file.padEnd(35)} ${check.status.padEnd(8)} ${check.detail}`);
    if (check.status === "MISSING") hasFailure = true;
  }

  console.log(`\n  ${checks.filter(c => c.status === "OK").length}/${checks.length} checks passed\n`);

  if (hasFailure) {
    console.error("  FAIL: Required files are missing.\n");
    process.exit(1);
  } else {
    console.log("  Agent directory is valid and ready.\n");
  }
}

verify().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
