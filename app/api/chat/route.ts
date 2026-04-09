import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { chatWithAgent } from "@/lib/agent";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { userId, message, actionId } = body;

  if (!userId || !message) {
    return new Response(
      JSON.stringify({ error: "userId and message required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Save user message
  await prisma.chatMessage.create({
    data: {
      userId,
      role: "user",
      content: message,
      actionId: actionId ?? null,
    },
  });

  const encoder = new TextEncoder();
  const agentAvailable = !!process.env.LYZR_API_KEY;

  const stream = new ReadableStream({
    async start(controller) {
      let fullResponse = "";

      const sendToken = (token: string) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ token })}\n\n`)
        );
      };

      const finish = async (text: string) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`)
        );
        controller.close();

        // Save agent response
        await prisma.chatMessage.create({
          data: {
            userId,
            role: "agent",
            content: text,
            actionId: actionId ?? null,
          },
        });
      };

      if (agentAvailable) {
        // Real agent via gitclaw
        await chatWithAgent(userId, message, actionId, {
          onDelta: (text) => {
            fullResponse += text;
            sendToken(text);
          },
          onComplete: async (text) => {
            await finish(text || fullResponse);
          },
          onError: async (error) => {
            const errorMsg = `I encountered an issue processing your request. ${error}`;
            sendToken(errorMsg);
            await finish(errorMsg);
          },
        });
      } else {
        // Fallback: placeholder when agent not configured
        const recentActions = await prisma.action.findMany({
          where: { userId, status: "pending" },
          orderBy: { createdAt: "desc" },
          take: 10,
        });

        let actionContext = "";
        if (actionId) {
          const action = await prisma.action.findUnique({
            where: { id: actionId },
          });
          if (action) {
            actionContext = `\nThe user is asking about this specific action: "${action.headline}" — ${action.detail}. Driver: ${action.driver}`;
          }
        }

        fullResponse = generatePlaceholderResponse(
          message,
          recentActions,
          actionContext
        );

        // Simulate streaming word-by-word
        const words = fullResponse.split(" ");
        for (let i = 0; i < words.length; i++) {
          const chunk = (i === 0 ? "" : " ") + words[i];
          sendToken(chunk);
          await new Promise((r) => setTimeout(r, 30));
        }

        await finish(fullResponse);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

function generatePlaceholderResponse(
  _message: string,
  actions: { headline: string; detail: string; severity: string }[],
  actionContext: string
): string {
  if (actionContext) {
    return `Based on the data, ${actionContext.replace("\nThe user is asking about this specific action: ", "").replace(/"/g, "")}. I recommend reviewing the underlying transactions and comparing against the prior period to identify whether this is a one-time occurrence or a trend that needs budget reallocation.\n\nWould you like me to draft a summary for your team?`;
  }

  const critical = actions.filter((a) => a.severity === "critical");
  if (critical.length > 0) {
    return `Looking at your current financial data, the most urgent item is: ${critical[0].headline} (${critical[0].detail}). This exceeds the typical variance threshold and warrants immediate review.\n\nI can provide a detailed breakdown of the contributing line items, or draft a variance commentary for your monthly report. What would be most helpful?`;
  }

  return `I've reviewed your financial data. Currently there are ${actions.length} open items in your actions feed. The most common pattern is budget variances in operational expenditure categories.\n\nWhat specific area would you like me to analyze in more detail?`;
}
