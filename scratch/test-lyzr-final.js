// Verify the correct agent ID works
async function test() {
  const res = await fetch("https://agent-prod.studio.lyzr.ai/v4/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer REDACTED_LYZR_KEY"
    },
    body: JSON.stringify({
      model: "69d43ccef008dd037bad64d7",
      messages: [{ role: "user", content: "Say hello in one word" }]
    })
  });
  console.log("Status:", res.status);
  const body = await res.text();
  console.log("Body:", body.slice(0, 500));
}
test();
