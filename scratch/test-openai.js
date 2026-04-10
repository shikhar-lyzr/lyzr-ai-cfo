async function test() {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer REDACTED_LYZR_KEY"
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [{ role: "user", content: "Hello" }]
    })
  });
  console.log("Status:", res.status);
  console.log("Body:", await res.text());
}
test();
