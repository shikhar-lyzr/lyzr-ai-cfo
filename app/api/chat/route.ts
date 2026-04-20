import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { chatWithAgent } from "@/lib/agent";
import { resetStepCounter } from "@/lib/agent/classify-event";
import { JOURNEY_TITLES } from "@/lib/agent/journey-context";
import type { PipelineStep } from "@/lib/agent/pipeline-types";

function sseWrite(controller: ReadableStreamDefaultController, encoder: TextEncoder, event: string, data: unknown) {
  controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { userId, message, actionId, journeyId, periodKey } = body;

  if (!userId || !message) {
    return new Response(
      JSON.stringify({ error: "userId and message required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Save user message
  await prisma.chatMessage.create({
    data: { userId, role: "user", content: message, actionId: actionId ?? null },
  });

  const encoder = new TextEncoder();
  const agentAvailable = !!(process.env.OPENAI_API_KEY || process.env.LYZR_API_KEY || process.env.GEMINI_API_KEY);

  const stream = new ReadableStream({
    async start(controller) {
      resetStepCounter();
      let fullResponse = "";

      // Send initial pipeline step
      const initStep: PipelineStep = {
        id: "step-0",
        type: "agent_init",
        label: "Initializing agent...",
        status: "running",
      };
      sseWrite(controller, encoder, "pipeline_step", initStep);

      const finish = async (text: string) => {
        // Mark init as completed if still running
        sseWrite(controller, encoder, "pipeline_step", { id: "step-0", status: "completed" });
        sseWrite(controller, encoder, "done", { finished: true });
        controller.close();

        await prisma.chatMessage.create({
          data: { userId, role: "agent", content: text, actionId: actionId ?? null },
        });
      };

      if (agentAvailable) {
        await chatWithAgent(userId, message, actionId, {
          onDelta: (text) => {
            fullResponse += text;
            sseWrite(controller, encoder, "delta", { text });
          },
          onComplete: async (text) => {
            await finish(text || fullResponse);
          },
          onError: async (errorMsg) => {
            sseWrite(controller, encoder, "error", { error: errorMsg });
            await finish(fullResponse || `Error: ${errorMsg}`);
          },
        }, { journeyId, periodKey });
      } else {
        // Fallback placeholder
        const recentActions = await prisma.action.findMany({
          where: { userId, status: "pending" },
          orderBy: { createdAt: "desc" },
          take: 10,
        });

        const journeyTitle = journeyId ? (JOURNEY_TITLES[journeyId] ?? journeyId) : null;
        fullResponse = journeyTitle
          ? `You're on the ${journeyTitle} journey. AI engine isn't configured — set OPENAI_API_KEY, LYZR_API_KEY, or GEMINI_API_KEY to enable analysis.`
          : `I've reviewed your financial data. Currently there are ${recentActions.length} open items in your actions feed. What specific area would you like me to analyze?`;

        // Simulate streaming
        const words = fullResponse.split(" ");
        for (let i = 0; i < words.length; i++) {
          const chunk = (i === 0 ? "" : " ") + words[i];
          sseWrite(controller, encoder, "delta", { text: chunk });
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
