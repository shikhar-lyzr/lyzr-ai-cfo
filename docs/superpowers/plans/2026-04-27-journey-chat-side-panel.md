# Journey Chat Side Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reskin the journey chat from collapsed bottom drawer to persistent right-side rail with stacked suggestion cards, default expanded, user can collapse with localStorage persistence.

**Architecture:** No agent or streaming changes. Three component edits: (1) new `SuggestionCards` replaces `NudgeChips` visually inside the panel, (2) `JourneyChatPanel` switches container layout from bottom drawer to fixed-width rail and reads expanded state from localStorage, (3) `JourneyPage` becomes a two-column layout with header on top, content + rail side-by-side.

**Tech Stack:** Next.js 16 App Router, React + Tailwind, vitest + jsdom for component tests.

**Spec:** `docs/superpowers/specs/2026-04-27-journey-chat-side-panel-design.md`

**Branch:** `feature/unified-decision-inbox` (continues work on the same branch).

---

## File Structure

**New files:**
- `components/journey/suggestion-cards.tsx` — vertical stack of full-width prompt cards. Same `{ nudges, onSelect }` props as `NudgeChips`.

**Modified files:**
- `components/journey/journey-chat-panel.tsx` — container becomes a right rail; reads/writes `localStorage["inbox.chatPanel.expanded"]`; renders `<SuggestionCards>` (not `<NudgeChips>`); collapse toggle is a chevron in the rail header (not the bottom).
- `components/journey/journey-page.tsx` — layout becomes header-on-top + two-column flex (content `flex-1` + rail).

**Unchanged:**
- All journey pages (monthly-close, financial-reconciliation, regulatory-capital, ifrs9-ecl, daily-liquidity, regulatory-returns) — they pass props to `JourneyPage` exactly as today.
- `components/agent-console/chat-input.tsx`, `hooks/use-chat-stream.ts`, `components/pipeline/pipeline-container.tsx`.
- `journey-chat-bridge.tsx`.
- `nudge-chips.tsx` stays in the repo but becomes unused (per spec).

**Test files:**
- `tests/component/suggestion-cards.test.tsx` (new) — render + click.
- `tests/component/journey-chat-panel.test.tsx` (new) — collapse state, localStorage, bridge event, empty-state cards visible only when no messages.

---

## Task 1: SuggestionCards component (TDD)

**Files:**
- Create: `components/journey/suggestion-cards.tsx`
- Create: `tests/component/suggestion-cards.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/component/suggestion-cards.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SuggestionCards } from "@/components/journey/suggestion-cards";

describe("SuggestionCards", () => {
  it("renders one card per nudge", () => {
    render(<SuggestionCards nudges={["First", "Second", "Third"]} onSelect={() => {}} />);
    expect(screen.getByRole("button", { name: "First" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Second" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Third" })).toBeDefined();
  });

  it("renders nothing when nudges is empty", () => {
    const { container } = render(<SuggestionCards nudges={[]} onSelect={() => {}} />);
    expect(container.querySelectorAll("button").length).toBe(0);
  });

  it("clicking a card calls onSelect with the nudge string", () => {
    const onSelect = vi.fn();
    render(<SuggestionCards nudges={["Why is this happening?"]} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: "Why is this happening?" }));
    expect(onSelect).toHaveBeenCalledWith("Why is this happening?");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```
npx vitest run tests/component/suggestion-cards.test.tsx
```

Expected: FAIL — `Cannot find module '@/components/journey/suggestion-cards'`.

- [ ] **Step 3: Create the component**

Create `components/journey/suggestion-cards.tsx`:

```tsx
"use client";

interface SuggestionCardsProps {
  nudges: string[];
  onSelect: (nudge: string) => void;
}

export function SuggestionCards({ nudges, onSelect }: SuggestionCardsProps) {
  if (nudges.length === 0) return null;
  return (
    <div className="space-y-2">
      {nudges.map((nudge) => (
        <button
          key={nudge}
          onClick={() => onSelect(nudge)}
          className="w-full text-left px-3 py-2.5 rounded-md border border-border bg-card hover:bg-secondary/50 hover:border-primary/30 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {nudge}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```
npx vitest run tests/component/suggestion-cards.test.tsx
```

Expected: PASS, 3 tests.

- [ ] **Step 5: Typecheck**

```
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add components/journey/suggestion-cards.tsx tests/component/suggestion-cards.test.tsx
git commit -m "feat(journey): SuggestionCards component (replaces NudgeChips visually)"
```

---

## Task 2: JourneyChatPanel — rewrite as right rail with localStorage state

**Files:**
- Modify: `components/journey/journey-chat-panel.tsx`

This is a wholesale rewrite of the panel's container + state, but message/streaming/bridge logic is preserved. We swap NudgeChips → SuggestionCards in the same change.

- [ ] **Step 1: Replace `journey-chat-panel.tsx`**

Use the Write tool to fully replace `components/journey/journey-chat-panel.tsx`:

```tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useChatStream } from "@/hooks/use-chat-stream";
import { ChatInput } from "@/components/agent-console/chat-input";
import { SuggestionCards } from "./suggestion-cards";
import { PipelineContainer } from "@/components/pipeline/pipeline-container";
import {
  JOURNEY_ASK_AI_EVENT,
  type JourneyAskAiDetail,
} from "./journey-chat-bridge";

interface JourneyChatPanelProps {
  journeyId: string;
  nudges: string[];
  periodKey?: string;
}

const STORAGE_KEY = "inbox.chatPanel.expanded";

function readInitialExpanded(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === null) return true;
    return stored === "true";
  } catch {
    return true;
  }
}

export function JourneyChatPanel({ journeyId, nudges, periodKey }: JourneyChatPanelProps) {
  const [expanded, setExpanded] = useState<boolean>(readInitialExpanded);
  const [userId, setUserId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastPrefillRef = useRef<string | null>(null);

  useEffect(() => {
    try { window.localStorage.setItem(STORAGE_KEY, String(expanded)); } catch {}
  }, [expanded]);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data?.userId) setUserId(data.userId); });
  }, []);

  const { messages, pipelineSteps, isStreaming, sendMessage, stopStream } = useChatStream(userId);

  const isStreamingRef = useRef(isStreaming);
  const sendMessageRef = useRef(sendMessage);
  const journeyIdRef = useRef(journeyId);
  const periodKeyRef = useRef(periodKey);

  useEffect(() => { isStreamingRef.current = isStreaming; }, [isStreaming]);
  useEffect(() => { sendMessageRef.current = sendMessage; }, [sendMessage]);
  useEffect(() => { journeyIdRef.current = journeyId; }, [journeyId]);
  useEffect(() => { periodKeyRef.current = periodKey; }, [periodKey]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const handler = (ev: Event) => {
      const detail = (ev as CustomEvent<JourneyAskAiDetail>).detail;
      if (!detail?.message) return;
      if (isStreamingRef.current) return;
      if (lastPrefillRef.current === detail.message) return;
      lastPrefillRef.current = detail.message;
      setExpanded(true);
      sendMessageRef.current(detail.message, {
        journeyId: journeyIdRef.current,
        periodKey: periodKeyRef.current,
      });
    };
    window.addEventListener(JOURNEY_ASK_AI_EVENT, handler);
    return () => window.removeEventListener(JOURNEY_ASK_AI_EVENT, handler);
  }, []);

  const handleSend = (msg: string) => {
    if (!expanded) setExpanded(true);
    sendMessage(msg, { journeyId, periodKey });
  };

  if (!expanded) {
    return (
      <aside className="w-12 border-l border-border bg-card flex flex-col items-center py-3">
        <button
          onClick={() => setExpanded(true)}
          className="text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Expand chat panel"
        >
          <ChevronLeft size={16} />
        </button>
      </aside>
    );
  }

  return (
    <aside className="w-[380px] shrink-0 border-l border-border bg-card flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h2 className="text-sm font-semibold">Ask the agent</h2>
        <button
          onClick={() => setExpanded(false)}
          className="text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Collapse chat panel"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 ? (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Ask anything about this journey. The agent has the data context.
            </p>
            <SuggestionCards nudges={nudges} onSelect={handleSend} />
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <div key={msg.id} className={msg.role === "user" ? "flex justify-end" : "flex justify-start"}>
                {msg.role === "user" ? (
                  <div className="bg-primary text-primary-foreground rounded-xl px-3 py-2 text-xs max-w-[85%]">
                    {msg.content}
                  </div>
                ) : (
                  <div className="max-w-[95%]">
                    {pipelineSteps.length > 0 && (
                      <div className="mb-1 text-[11px]">
                        <PipelineContainer steps={pipelineSteps} isStreaming={isStreaming} />
                      </div>
                    )}
                    {msg.content && (
                      <div className="bg-background border border-border rounded-xl px-3 py-2 text-xs doc-body">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      <div className="border-t border-border">
        <ChatInput
          onSend={handleSend}
          onStop={stopStream}
          isStreaming={isStreaming}
          placeholder="Ask about this journey..."
        />
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: Typecheck**

```
npx tsc --noEmit
```

Expected: clean for the modified file. JourneyPage will fail because the panel's parent layout assumption changed; that gets fixed in Task 3.

If errors are limited to `journey-page.tsx` consumers of `<JourneyChatPanel>`, that's expected — proceed to Task 3 in the same dispatch (Tasks 2 and 3 are bundled when run by a subagent).

- [ ] **Step 3: DO NOT commit yet**

The codebase is in an intermediate state where the panel expects a flex parent but `JourneyPage` still gives it a `flex-col` parent. Task 3 fixes that. Commit at the end of Task 3.

---

## Task 3: JourneyPage — two-column layout

**Files:**
- Modify: `components/journey/journey-page.tsx`

- [ ] **Step 1: Replace `journey-page.tsx`**

Use the Write tool to fully replace `components/journey/journey-page.tsx`:

```tsx
import type { LucideIcon } from "lucide-react";
import { JourneyChatPanel } from "./journey-chat-panel";

interface JourneyPageProps {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  nudges: string[];
  children: React.ReactNode;
  periodKey?: string;
}

export function JourneyPage({ id, title, description, icon: Icon, nudges, children, periodKey }: JourneyPageProps) {
  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] -mx-8 -mt-8 -mb-4">
      <div className="px-8 py-6 border-b border-border">
        <div className="flex items-center gap-3">
          <Icon size={28} className="text-muted-foreground" />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight" style={{ fontFamily: "var(--font-playfair)" }}>
              {title}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        <div className="flex-1 overflow-y-auto px-8 py-6">
          {children}
        </div>
        <JourneyChatPanel journeyId={id} nudges={nudges} periodKey={periodKey} />
      </div>
    </div>
  );
}
```

Notes for the implementer:
- The outer `flex flex-col h-[calc(100vh-4rem)] ...` keeps the existing height math.
- The inner `flex flex-1 min-h-0` is new — the row that holds journey content + rail. `min-h-0` lets the inner overflow-y-auto on the journey content actually scroll inside its flex parent (without it, flex children can blow past their container).
- The journey content keeps its `overflow-y-auto px-8 py-6` so existing scroll behaviour is preserved.

- [ ] **Step 2: Typecheck**

```
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 3: Run vitest suite**

```
npx vitest run
```

Expected: all previously-passing tests still pass. The new `suggestion-cards.test.tsx` from Task 1 also passes (3/3).

- [ ] **Step 4: Smoke check via dev server**

The controller (parent session) restarts the dev server and visits any journey page (e.g. `/financial-reconciliation`). Expect:
- Right-side rail visible by default (380px wide).
- Title "Ask the agent" + chevron toggle at the top of the rail.
- Empty-state copy ("Ask anything about this journey. The agent has the data context.") and stacked suggestion cards.
- Click one of the cards → it sends to the agent, panel shows pipeline + response.
- Click the chevron → rail collapses to a 48px strip with a chevron pointing left.
- Reload → rail stays collapsed (or expanded, whichever was last).

If the implementer is the subagent: just verify the three previous steps' commands pass; visual smoke is the parent's job.

- [ ] **Step 5: Commit (Tasks 2 + 3 land together)**

```bash
git add components/journey/journey-chat-panel.tsx components/journey/journey-page.tsx
git commit -m "feat(journey): chat panel becomes right rail with localStorage collapse"
```

---

## Task 4: JourneyChatPanel component tests

**Files:**
- Create: `tests/component/journey-chat-panel.test.tsx`

We test the new behaviour: localStorage round-trip, collapse toggle, empty-state cards, message-state cards-hidden, bridge event auto-expand.

We mock `useChatStream` to avoid network. We mock `next/navigation` (the panel doesn't use `useRouter`, but it does fetch `/api/auth/me` — we mock global `fetch` to keep tests deterministic).

- [ ] **Step 1: Write the test**

Create `tests/component/journey-chat-panel.test.tsx`:

```tsx
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
  // Stub /api/auth/me so the inner useEffect doesn't error.
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ userId: "u1" }), { status: 200 })));
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
    // Now collapsed
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
    expect(screen.queryByText("Ask the agent")).toBeNull(); // collapsed initially

    act(() => {
      const detail: JourneyAskAiDetail = { message: "Investigate this break." };
      window.dispatchEvent(new CustomEvent(JOURNEY_ASK_AI_EVENT, { detail }));
    });

    expect(sendMessage).toHaveBeenCalledWith(
      "Investigate this break.",
      { journeyId: "financial-reconciliation", periodKey: "2026-04" },
    );
    expect(screen.getByText("Ask the agent")).toBeDefined(); // now expanded
  });
});
```

- [ ] **Step 2: Run the test**

```
npx vitest run tests/component/journey-chat-panel.test.tsx
```

Expected: 8 tests pass.

If a test fails, read the failure carefully:
- "Cannot find element with text 'Ask the agent'" → the component didn't render expanded; check `readInitialExpanded` reads localStorage correctly.
- "sendMessage not called" → check the mock is wired (`vi.mock` placement at top of file).
- A bridge-event test failure may be due to `dispatchEvent` happening before the event listener mounts — wrap with `act()` (the test does this) and ensure `JOURNEY_ASK_AI_EVENT` import resolves.

DO NOT change production code if a test fails for a setup reason. If it's a real component bug, fix it (and stop to report).

- [ ] **Step 3: Run full vitest suite to confirm no regressions**

```
npx vitest run
```

Expected: all tests pass. Pre-existing flake (`tests/chat-route/pipeline-sse.test.ts`) may or may not fire — that's not in scope.

- [ ] **Step 4: Self-review**

```
git status
git diff
```

Verify: only ONE new file at `tests/component/journey-chat-panel.test.tsx`. Nothing else touched.

- [ ] **Step 5: Commit**

```bash
git add tests/component/journey-chat-panel.test.tsx
git commit -m "test(journey): chat panel collapse + empty state + bridge event"
```

---

## Task 5: Final verification

- [ ] **Step 1: Full test run**

```
npx vitest run
```

Expected: all tests pass except the pre-existing `pipeline-sse.test.ts` flake.

- [ ] **Step 2: Typecheck**

```
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 3: Manual smoke (controller)**

The controller restarts the dev server and walks through:

| Flow | Expected |
|------|----------|
| Visit `/financial-reconciliation` | Right rail visible, "Ask the agent" header, nudges as stacked cards, subtitle visible |
| Click a card | Card sends prompt, agent streams, pipeline shows, response appears |
| Click chevron in rail header | Rail collapses to 48px strip with `<` chevron |
| Click strip's chevron | Rail re-expands, state intact (does NOT replay last message) |
| Reload page | Rail keeps last collapse state |
| Visit another journey (e.g. `/monthly-close`) | Same rail, same collapse state (shared key) |
| Click an in-page Ask AI button (if present) | Rail auto-expands, sends the message |
| Resize window narrower (~1280px) | Rail still 380px; journey content gets tighter but no breakage |

If any of these fails, do NOT mark done — report back to the controller.

---

## Done definition

- `SuggestionCards` component covered by 3 unit tests.
- `JourneyChatPanel` covered by 8 component tests (collapse state × 4, empty state × 3, bridge event × 1).
- Typecheck clean; full vitest suite passes (modulo the pre-existing pipeline-sse flake).
- Right rail renders on every existing journey page (close, recon, capital, ifrs9, liquidity, returns) without changes to those pages.
- Collapse state persists in `localStorage["inbox.chatPanel.expanded"]`.
- `nudge-chips.tsx` remains in the repo (unused) per spec; cleanup deferred.
