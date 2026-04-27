# Journey Chat Side Panel

**Date:** 2026-04-27
**Status:** Spec — pending implementation plan
**Reference visual:** Performance Review screenshot (right rail with empty state, suggested-prompt cards, and chat input)

## Problem

Today, every journey page (monthly-close, financial-reconciliation, regulatory-capital, ifrs9-ecl, daily-liquidity, regulatory-returns) wraps its content in `<JourneyPage>`, which renders a chat panel as a **collapsed bottom drawer**. To use the agent, the user has to click an "Ask about this journey…" button, which opens a 40vh-tall drawer at the bottom of the screen.

The reference application's pattern is a **persistent right-rail panel** that's visible from first paint, with suggested prompts displayed as full-width cards and a fixed input at the bottom. That's the journey chat experience we want.

## Decision

Reskin the existing `JourneyChatPanel` from bottom drawer to right rail, plus refresh the suggested-prompt visuals. **No agent or streaming changes** — `useChatStream`, `/api/chat`, the `JOURNEY_ASK_AI_EVENT` bridge, and pipeline rendering all stay as-is.

Locked decisions:

- **(b)** Reskin the panel container + replace nudge chips with stacked suggestion cards. Skip pixel-perfect screenshot match (separate spec if needed).
- **(c)** Default expanded, user can collapse via a chevron toggle, choice persists in `localStorage`.
- **(a)** Keep the `nudges: string[]` schema. Each existing journey nudge becomes one suggestion card.

## Out of scope

- **Pixel-perfect match of the Performance Review screenshot** — robot icon empty state, exact card padding, exact send-icon styling. Phase-2 polish if needed.
- **`suggestionCards: { label, prompt }[]` schema** — adding a richer card schema where the visible label differs from the prompt sent to the agent. YAGNI; revisit if a journey actually needs it.
- **Mobile / narrow-viewport responsive behaviour** — the rail will be visible on the same viewports the journey content is. We're not introducing a new collapse-for-mobile state machine.
- **Adding the chat panel to non-journey pages** (`/decision-inbox`, `/audit-trail`, `/data-sources`, etc.). Out of scope here; those don't pass through `JourneyPage`.
- **Chat endpoint or agent behaviour changes.** A separate already-fixed config issue (`turbopack.root` in `next.config.ts`) restored the agent; no further chat-engine work in this spec.

## Layout

`JourneyPage` becomes a **two-column flex container** at viewport scope:

```
┌──────────────────────────────────────────────────────┐
│ [Header: icon, title, description]                   │
├──────────────────────────────────────────┬───────────┤
│                                          │           │
│   {children} — journey content           │   Chat    │
│   (scrollable, takes remaining width)    │   panel   │
│                                          │   (rail)  │
│                                          │           │
└──────────────────────────────────────────┴───────────┘
```

- **Left column:** journey content. `flex-1`, scrollable, vertical padding consistent with today.
- **Right column:** chat rail. Fixed width `w-[380px]`. When collapsed, becomes a thin column (`w-12`) showing only the toggle button.
- **Header:** spans the full width above both columns, unchanged from today.

When `expanded === false`, the rail collapses to a 48px-wide vertical strip with a `<ChevronRight>` toggle button at the top. Clicking it expands back to 380px.

The viewport-height calculation today is `h-[calc(100vh-4rem)]`; we keep it. The rail uses the same height, so its content (suggestion cards + messages + input) is independently scrollable.

## Right-rail content

Three vertical sections, top to bottom:

1. **Header strip** (sticky top). Contains:
   - Title text: **"Ask the agent"**
   - Collapse chevron on the right
2. **Body** (flex-1, scrollable). Branches on state:
   - **Empty state (no messages yet):** stack of suggestion cards (the existing `nudges` array, rendered as cards — see below). Above the stack, a one-line subtitle: "Ask anything about this journey. The agent has the data context."
   - **Streaming or has messages:** the existing message + pipeline rendering. Suggestion cards hide while there are messages (matches today's behaviour).
3. **Input** (sticky bottom). Existing `<ChatInput>` component, unchanged.

## Suggestion card visuals

Replace `nudge-chips.tsx`'s row of pills with `suggestion-cards.tsx` — a vertical stack of full-width cards. Each card:

```tsx
<button
  onClick={() => onSelect(nudge)}
  className="w-full text-left px-3 py-2.5 rounded-md border border-border bg-card hover:bg-secondary/50 hover:border-primary/30 text-xs text-muted-foreground hover:text-foreground transition-colors"
>
  {nudge}
</button>
```

Stacked with `space-y-2` in the parent. No icons, no two-line label/prompt split (deferred). Width fills the rail (`w-full`).

The existing `nudge-chips.tsx` stays in place — but is no longer imported by `journey-chat-panel.tsx`. We keep it for now so any other component that imports it (audit-trail nudges, etc.) doesn't break. Cleanup deferred until a callers grep confirms it's safe to remove.

## Collapse state

State location: `useState<boolean>` in `JourneyChatPanel`, initialized from `localStorage` key `inbox.chatPanel.expanded`. The key is shared across journeys — collapsing on one journey collapses on the next.

```ts
const [expanded, setExpanded] = useState<boolean>(() => {
  if (typeof window === "undefined") return true;  // SSR: default expanded
  const stored = localStorage.getItem("inbox.chatPanel.expanded");
  return stored === null ? true : stored === "true";
});

useEffect(() => {
  localStorage.setItem("inbox.chatPanel.expanded", String(expanded));
}, [expanded]);
```

To avoid a hydration mismatch on first paint (server renders default, client may flip immediately), we accept a one-frame flicker for users who collapsed previously. Acceptable; alternatives (cookie persistence, suspended client component) cost more complexity than the bug costs.

## Auto-expand on `JOURNEY_ASK_AI_EVENT`

Existing behaviour: when an in-page button dispatches the bridge event, the panel auto-expands and sends the message. We preserve this — `setExpanded(true)` already happens in the existing handler. No change needed except verifying the new layout still sends the message correctly.

## Files

**New:**
- `components/journey/suggestion-cards.tsx` — vertical stack of full-width prompt cards. Same `{ nudges, onSelect }` props as `NudgeChips` so the swap is mechanical.

**Modified:**
- `components/journey/journey-page.tsx` — rewrite layout from "header + scrollable content + bottom drawer" to "header + two-column flex (content + chat rail)". Keep prop signature unchanged.
- `components/journey/journey-chat-panel.tsx` —
  - Switch container from bottom-drawer styling to right-rail (fixed width, full height, vertical content stack).
  - Replace `<NudgeChips>` import with `<SuggestionCards>`.
  - Replace local `useState(false)` with the localStorage-backed expanded state described above.
  - Replace the bottom `ChevronUp/ChevronDown` toggle row with a `ChevronLeft/ChevronRight` collapse toggle in the rail header.
  - When collapsed, render only the 48px-wide strip with the toggle. When expanded, render the full rail.

**Unchanged:**
- All journey pages. They pass `nudges` and other props to `JourneyPage` exactly as today.
- `useChatStream`, `/api/chat`, agent SDK, pipeline rendering.
- `journey-chat-bridge.tsx` (the `JOURNEY_ASK_AI_EVENT` bus).

## Testing

Component-level (vitest + jsdom):

- `SuggestionCards` renders one card per nudge; clicking a card calls `onSelect(nudge)` with that string.
- `JourneyChatPanel` (new tests):
  - Default state is expanded when localStorage is empty.
  - Reads `localStorage["inbox.chatPanel.expanded"] = "false"` and renders collapsed.
  - Toggle click flips state and writes to localStorage.
  - Empty state shows `SuggestionCards`; once a message exists, cards are hidden.
  - `JOURNEY_ASK_AI_EVENT` triggers expand + sendMessage.

No integration tests — `/api/chat` behaviour is unchanged.

## Risks / open questions

- **Existing layout assumes drawer at bottom.** If any journey content uses CSS that depends on the drawer occupying the bottom of the viewport (e.g. sticky-bottom elements styled to clear the drawer), they may need adjustment. Spot-check during implementation; not a known issue today.
- **Width math on smaller screens.** 380px rail + 32px page padding + journey content gets tight under ~1280px. If a user reports cramped journey content, the cheap fix is collapsing the rail. Real responsive support is out of scope.
- **`localStorage` SSR hydration flicker.** Documented above. Acceptable for now.
