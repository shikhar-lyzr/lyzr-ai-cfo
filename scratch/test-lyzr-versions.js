// Try different API versions and URL patterns
async function test() {
  const endpoints = [
    "https://agent-prod.studio.lyzr.ai/v4/chat/completions",
    "https://agent-prod.studio.lyzr.ai/v3/chat/completions",
    "https://agent-prod.studio.lyzr.ai/v2/chat/completions",
    "https://agent-prod.studio.lyzr.ai/v1/chat/completions",
    "https://agent-prod.studio.lyzr.ai/chat/completions",
  ];

  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer REDACTED_LYZR_KEY"
        },
        body: JSON.stringify({
          model: "69d84038e3ab0dccd6ab6625",
          messages: [{ role: "user", content: "Say hello" }]
        })
      });
      const body = await res.text();
      console.log(`${url}\n  -> ${res.status}: ${body.slice(0, 150)}\n`);
    } catch(e) {
      console.log(`${url}\n  -> ERROR: ${e.message}\n`);
    }
  }
}
test();
