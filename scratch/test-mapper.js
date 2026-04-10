const { inferColumnMapping } = require("./lib/csv/llm-mapper.ts");

// Oh wait, llm-mapper is a .ts file, so using raw node won't work well without ts-node.
// I'll make a standalone fetch script.

const MODEL = "gemini-2.5-flash-lite";

async function test() {
  const apiKey = process.env.GEMINI_API_KEY || "YOUR_KEY";
  const prompt = `You are a test.`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.1,
        },
      }),
    }
  );
  console.log("Status:", response.status);
  console.log("Body:", await response.text());
}

test();
