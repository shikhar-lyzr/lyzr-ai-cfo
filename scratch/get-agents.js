async function getAgents() {
  const res = await fetch("https://agent-prod.studio.lyzr.ai/v4/agents", {
    headers: {
      "Authorization": "Bearer REDACTED_LYZR_KEY"
    }
  });
  console.log(res.status, await res.text());
}
getAgents();
