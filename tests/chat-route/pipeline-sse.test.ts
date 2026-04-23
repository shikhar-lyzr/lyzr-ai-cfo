// tests/chat-route/pipeline-sse.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { prisma } from "@/lib/db";
import { NextRequest } from "next/server";
import { deleteTestUser } from "../integration/cleanup";
import { deltaMsg, scriptedQuery, toolUseMsg, toolResultMsg } from "../agent/mock-query";

process.env.LYZR_API_KEY = process.env.LYZR_API_KEY ?? "test-dummy";
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? "test-dummy";

vi.mock("gitclaw", () => ({
  query: vi.fn(),
  tool: (name: string, description: string, inputSchema: unknown, handler: unknown) => ({
    name, description, inputSchema, handler,
  }),
}));

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
}));

import { query } from "gitclaw";
import { getSession } from "@/lib/auth";
import { POST } from "@/app/api/chat/route";

// Parse an SSE body into frames. Each frame is `event: <name>\ndata: <json>\n\n`.
async function readSseFrames(
  body: ReadableStream<Uint8Array> | null,
): Promise<Array<{ event: string; data: Record<string, unknown> }>> {
  if (!body) return [];
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const frames: Array<{ event: string; data: Record<string, unknown> }> = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() || "";
    for (const part of parts) {
      const ev = part.match(/^event: (.+)$/m)?.[1];
      const data = part.match(/^data: (.+)$/m)?.[1];
      if (!ev || !data) continue;
      try {
        frames.push({ event: ev, data: JSON.parse(data) });
      } catch {
        // skip malformed frame
      }
    }
  }
  return frames;
}

function makeReq(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("SSE pipeline_step wire", { timeout: 30_000 }, () => {
  let userId = "";

  beforeEach(async () => {
    vi.clearAllMocks();
    const u = await prisma.user.create({
      data: {
        lyzrAccountId: `t_${Date.now()}_${Math.random()}`,
        email: `t_${Date.now()}_${Math.random()}@test.local`,
        name: "Test",
      },
    });
    userId = u.id;
    vi.mocked(getSession).mockResolvedValue({ userId } as Awaited<ReturnType<typeof getSession>>);
  });

  afterEach(async () => {
    await deleteTestUser(userId);
  });

  it("emits step-0 running then completed bracketing the delta", async () => {
    vi.mocked(query).mockReturnValue(
      scriptedQuery([deltaMsg("hello")]) as ReturnType<typeof query>,
    );

    const res = await POST(makeReq({ userId, message: "hi" }));
    const frames = await readSseFrames(res.body);

    const eventSequence = frames.map((f) => f.event);
    expect(eventSequence[0]).toBe("pipeline_step");
    expect((frames[0].data as { id: string }).id).toBe("step-0");
    expect((frames[0].data as { status: string }).status).toBe("running");

    // Somewhere after: a delta with "hello"
    const deltaFrame = frames.find((f) => f.event === "delta");
    expect(deltaFrame).toBeDefined();

    // Last pipeline_step should mark step-0 completed
    const pipelineFrames = frames.filter((f) => f.event === "pipeline_step");
    const finalStep0 = [...pipelineFrames].reverse().find((f) => (f.data as { id: string }).id === "step-0");
    expect((finalStep0!.data as { status: string }).status).toBe("completed");

    // Terminal done event
    expect(frames.at(-1)?.event).toBe("done");
  });
});
