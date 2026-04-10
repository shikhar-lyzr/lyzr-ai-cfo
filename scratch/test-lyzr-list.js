// List agents using x-api-key auth (v3 format per Lyzr docs)
async function test() {
  const res = await fetch("https://agent-prod.studio.lyzr.ai/v3/agents/", {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": "REDACTED_LYZR_KEY"
    }
  });
  const body = await res.text();
  console.log(`Status: ${res.status}`);
  console.log(`Body: ${body.slice(0, 2000)}`);
}
test();
