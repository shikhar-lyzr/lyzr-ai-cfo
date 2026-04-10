// Test all possible auth header patterns for Lyzr
async function test() {
  const authMethods = [
    { name: "Bearer auth", headers: { "Authorization": "Bearer REDACTED_LYZR_KEY" } },
    { name: "x-api-key",   headers: { "x-api-key": "REDACTED_LYZR_KEY" } },
    { name: "Both",        headers: { "Authorization": "Bearer REDACTED_LYZR_KEY", "x-api-key": "REDACTED_LYZR_KEY" } },
  ];

  for (const method of authMethods) {
    const res = await fetch("https://agent-prod.studio.lyzr.ai/v4/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...method.headers },
      body: JSON.stringify({
        model: "69d84038e3ab0dccd6ab6625",
        messages: [{ role: "user", content: "Say hello in one word" }]
      })
    });
    const body = await res.text();
    console.log(`${method.name}: ${res.status} -> ${body.slice(0, 200)}`);
  }
}
test();
