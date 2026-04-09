/**
 * Verify gitclaw's loadAgent() can parse the agent directory.
 * Run with: node --env-file=.env scripts/verify-loadagent.mjs
 */
import { join } from "path";

const AGENT_DIR = join(process.cwd(), "agent");

async function verify() {
  // Dynamic import to handle ESM
  const { loadAgent } = await import("gitclaw");

  console.log("\n=== gitclaw loadAgent() Verification ===\n");
  console.log(`  Agent directory: ${AGENT_DIR}`);

  try {
    const loaded = await loadAgent(AGENT_DIR);

    console.log(`  Agent name: ${loaded.manifest.name}`);
    console.log(`  Agent version: ${loaded.manifest.version}`);
    console.log(`  Session ID: ${loaded.sessionId}`);
    console.log(`  Model: ${JSON.stringify(loaded.model)}`);
    console.log(`  System prompt length: ${loaded.systemPrompt.length} chars`);
    console.log(`  Plugins loaded: ${loaded.plugins.length}`);

    // Check system prompt contains key sections
    const prompt = loaded.systemPrompt;
    const sections = [
      ["SOUL", prompt.includes("AI CFO")],
      ["RULES", prompt.includes("Behavioral Constraints") || prompt.includes("Data integrity")],
      ["DUTIES", prompt.includes("Proactive Duties")],
      ["Skills", prompt.includes("variance-review") || prompt.includes("Skills")],
      ["Knowledge", prompt.includes("Variance Thresholds")],
      ["Examples", prompt.includes("Marketing is 23.5%")],
      ["Workflows", prompt.includes("variance-review") || prompt.includes("monthly-close")],
      ["Memory", prompt.includes("memory")],
    ];

    console.log("\n  System prompt sections:");
    for (const [name, found] of sections) {
      console.log(`    [${found ? "+" : "x"}] ${name}`);
    }

    const allFound = sections.every(([, found]) => found);
    console.log(`\n  ${allFound ? "All sections present in system prompt." : "WARNING: Some sections missing."}\n`);

    if (!allFound) process.exit(1);
  } catch (err) {
    console.error(`\n  FAILED to load agent: ${err.message}\n`);
    if (err.stack) console.error(err.stack);
    process.exit(1);
  }
}

verify();
