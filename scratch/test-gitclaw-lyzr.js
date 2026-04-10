require("dotenv").config({ path: ".env" });
process.env.OPENAI_API_KEY = "REDACTED_LYZR_KEY";

const { query } = require("gitclaw");

async function test() {
  const result = query({
    prompt: "Hello! What can you help me with?",
    dir: process.cwd() + "/agent",
    model: "lyzr:69d84038e3ab0dccd6ab6625@https://agent-prod.studio.lyzr.ai/v4"
  });

  try {
    for await (const msg of result) {
      if (msg.type === "assistant") console.log(msg.content);
    }
  } catch (err) {
    console.error("GitClaw API Error:", err.message);
  }
}
test().catch(console.error);
