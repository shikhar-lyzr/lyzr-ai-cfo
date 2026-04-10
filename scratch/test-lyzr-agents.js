// Try to list agents on the Lyzr platform
async function test() {
  const endpoints = [
    { url: "https://agent-prod.studio.lyzr.ai/v4/agents", method: "GET" },
    { url: "https://agent-prod.studio.lyzr.ai/v3/agents/", method: "GET" },
    { url: "https://agent-prod.studio.lyzr.ai/v2/agents/", method: "GET" },
    { url: "https://agent-prod.studio.lyzr.ai/v4/models", method: "GET" },
  ];

  for (const {url, method} of endpoints) {
    try {
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer REDACTED_LYZR_KEY"
        }
      });
      const body = await res.text();
      console.log(`${method} ${url}\n  -> ${res.status}: ${body.slice(0, 300)}\n`);
    } catch(e) {
      console.log(`${method} ${url}\n  -> ERROR: ${e.message}\n`);
    }
  }
}
test();
