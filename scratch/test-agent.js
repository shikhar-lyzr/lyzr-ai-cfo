require("dotenv").config({ path: ".env.local" });
const { analyzeUpload } = require("./lib/agent/index.ts");
const { runAgentProbe } = require("./lib/agent/probe.ts");

// Need to run via ts-node or just use the probe
async function test() {
  const userId = "test_user_123";
  const dataSourceId = "ds_123";
  const res = await runAgentProbe(userId, dataSourceId, "test.csv", 15);
  console.log(JSON.stringify(res, null, 2));
}

test().catch(console.error);
