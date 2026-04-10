async function test() {
  const Endpoints = {
    Lyzr_v4: "https://agent-prod.studio.lyzr.ai/v4/chat/completions",
    Lyzr_v3: "https://agent-prod.studio.lyzr.ai/v3/chat/completions",
    OpenRouter: "https://openrouter.ai/api/v1/chat/completions",
    Lyzr_Agent_API: "https://agent.api.lyzr.ai/v1/chat/completions"
  };

  for (const [name, url] of Object.entries(Endpoints)) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer REDACTED_LYZR_KEY"
        },
        body: JSON.stringify({
          model: "69d84038e3ab0dccd6ab6625",
          messages: [{ role: "user", content: "Hello" }]
        })
      });
      console.log(`${name} -> ${res.status}`);
      if (res.status === 404 && name === "Lyzr_v4") {
        console.log("Response:", await res.text());
      }
    } catch(e) {
      console.log(`${name} -> Error`);
    }
  }
}
test();
