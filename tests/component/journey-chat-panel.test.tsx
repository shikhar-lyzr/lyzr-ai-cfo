import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { JourneyChatPanel } from "@/components/journey/journey-chat-panel";
import {
  JOURNEY_ASK_AI_EVENT,
  type JourneyAskAiDetail,
} from "@/components/journey/journey-chat-bridge";

const STORAGE_KEY = "inbox.chatPanel.expanded";

let mockMessages: { id: string; role: "user" | "agent"; content: string }[] = [];
const sendMessage = vi.fn();
const stopStream = vi.fn();

vi.mock("@/hooks/use-chat-stream", () => ({
  useChatStream: () => ({
    messages: mockMessages,
    pipelineSteps: [],
    isStreaming: false,
    sendMessage,
    stopStream,
  }),
}));

beforeEach(() => {
  localStorage.clear();
  mockMessages = [];
  sendMessage.mockReset();
  stopStream.mockReset();
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ userId: "u1" }), { status: 200 })));
  // jsdom does not implement scrollIntoView
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("JourneyChatPanel — collapse state", () => {
  it("defaults to expanded when localStorage is empty", () => {
    render(<JourneyChatPanel journeyId="financial-reconciliation" nudges={["a", "b"]} />);
    expect(screen.getByText("Ask the agent")).toBeDefined();
  });

  it("renders collapsed when localStorage stores 'false'", () => {
    localStorage.setItem(STORAGE_KEY, "false");
    render(<JourneyChatPanel journeyId="financial-reconciliation" nudges={["a", "b"]} />);
    expect(screen.queryByText("Ask the agent")).toBeNull();
    expect(screen.getByLabelText("Expand chat panel")).toBeDefined();
  });

  it("clicking collapse writes 'false' to localStorage", () => {
    render(<JourneyChatPanel journeyId="financial-reconciliation" nudges={["a", "b"]} />);
    fireEvent.click(screen.getByLabelText("Collapse chat panel"));
    expect(localStorage.getItem(STORAGE_KEY)).toBe("false");
    expect(screen.queryByText("Ask the agent")).toBeNull();
    expect(screen.getByLabelText("Expand chat panel")).toBeDefined();
  });

  it("clicking expand from collapsed state writes 'true'", () => {
    localStorage.setItem(STORAGE_KEY, "false");
    render(<JourneyChatPanel journeyId="financial-reconciliation" nudges={["a", "b"]} />);
    fireEvent.click(screen.getByLabelText("Expand chat panel"));
    expect(localStorage.getItem(STORAGE_KEY)).toBe("true");
    expect(screen.getByText("Ask the agent")).toBeDefined();
  });
});

describe("JourneyChatPanel — empty state", () => {
  it("shows suggestion cards and subtitle when messages is empty", () => {
    render(
      <JourneyChatPanel
        journeyId="financial-reconciliation"
        nudges={["First nudge", "Second nudge"]}
      />,
    );
    expect(
      screen.getByText("Ask anything about this journey. The agent has the data context."),
    ).toBeDefined();
    expect(screen.getByRole("button", { name: "First nudge" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Second nudge" })).toBeDefined();
  });

  it("hides suggestion cards once a message exists", () => {
    mockMessages = [{ id: "m1", role: "user", content: "hi" }];
    render(
      <JourneyChatPanel
        journeyId="financial-reconciliation"
        nudges={["First nudge"]}
      />,
    );
    expect(screen.queryByRole("button", { name: "First nudge" })).toBeNull();
  });

  it("clicking a suggestion card calls sendMessage with that nudge", () => {
    render(
      <JourneyChatPanel
        journeyId="financial-reconciliation"
        nudges={["Why is variance high?"]}
        periodKey="2026-04"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Why is variance high?" }));
    expect(sendMessage).toHaveBeenCalledWith(
      "Why is variance high?",
      { journeyId: "financial-reconciliation", periodKey: "2026-04" },
    );
  });
});

describe("JourneyChatPanel — bridge event", () => {
  it("dispatching JOURNEY_ASK_AI_EVENT auto-expands and sends", () => {
    localStorage.setItem(STORAGE_KEY, "false");
    render(
      <JourneyChatPanel
        journeyId="financial-reconciliation"
        nudges={[]}
        periodKey="2026-04"
      />,
    );
    expect(screen.queryByText("Ask the agent")).toBeNull();

    act(() => {
      const detail: JourneyAskAiDetail = { message: "Investigate this break." };
      window.dispatchEvent(new CustomEvent(JOURNEY_ASK_AI_EVENT, { detail }));
    });

    expect(sendMessage).toHaveBeenCalledWith(
      "Investigate this break.",
      { journeyId: "financial-reconciliation", periodKey: "2026-04" },
    );
    expect(screen.getByText("Ask the agent")).toBeDefined();
  });
});
