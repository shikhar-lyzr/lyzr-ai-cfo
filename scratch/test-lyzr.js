async function test() {
  const modelNames = ["69d84038e3ab0dccd6ab6625", "lyzr:69d84038e3ab0dccd6ab6625", "lyzr-69d84038e3ab0dccd6ab6625"];
  
  for (const m of modelNames) {
    const res = await fetch("https://agent-prod.studio.lyzr.ai/v4/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer REDACTED_LYZR_KEY"
      },
      body: JSON.stringify({
        model: m,
        messages: [{ role: "user", content: "Hello" }]
      })
    });
    console.log(`Model: ${m} - Status: ${res.status}`);
  }
}
test();
