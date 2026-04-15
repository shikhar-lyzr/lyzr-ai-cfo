# COMMAND_CENTER.md

# This file defines the standard home page (Command Center) for every
# Lyzr AgenticOS product. Give it to Replit / Claude Code alongside the
# other standard MD files.
#
# The Command Center is the landing page. It is NOT a dashboard. It is a
# clean, focused entry point that lets the user ask anything, see what
# needs attention, and navigate to domain journeys.


# ═══════════════════════════════════════════════════════════════════════════════
# PART 1: DESIGN PHILOSOPHY
# ═══════════════════════════════════════════════════════════════════════════════

## 1.1 What the Command Center is NOT

It is NOT a data-heavy dashboard with charts, gauges, and KPIs filling
the screen. The whole point of an AgenticOS is that the agent surfaces
what matters — the user shouldn't have to scan 20 metrics to find the
problem.

## 1.2 What it IS

A clean, centered interface built around one core interaction: the search
bar. The user arrives, types a question or instruction, and the system
takes over. Below the search bar, the system shows what needs human
attention and where the domain journeys are.

## 1.3 The three-layer model (from your architecture diagram)

```
Layer 1: Command Center (this page)
  Full agent context. All skills. All memory. Strategic + tactical.
  "What's our AI visibility trending like?" / "Draft a board update"
  This is HOME. The agent here knows everything and can do anything.

Layer 2: Journey pages (linked from here)
  Same agent, scoped context. Each journey page gets a CONTEXT PAYLOAD.
  The agent on the Monthly Close page sees monthly close data.

Layer 3: Autonomous layer (no UI)
  Schedules, cron jobs, background processing. Results appear here
  as insights and actions.
```

The key product insight: It's ONE agent. One SOUL.md. One memory. One
skill set. But THREE surfaces. What changes between surfaces is the
CONTEXT PAYLOAD, not the agent.


# ═══════════════════════════════════════════════════════════════════════════════
# PART 2: PAGE LAYOUT
# ═══════════════════════════════════════════════════════════════════════════════

## 2.1 Full layout specification

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│                          [Lyzr Logo]                                 │
│                                                                      │
│                     Welcome, {user name}                             │
│            {Product Name} — {tagline}                                │
│                                                                      │
│         ┌──────────────────────────────────────────────┐             │
│         │ 📎  How can I help?                      🎤 ➤ │             │
│         └──────────────────────────────────────────────┘             │
│                                                                      │
│                     INTEGRATED SYSTEMS (optional)                    │
│              [Gmail] [Calendar] [Workday] [SAP] [ADP]               │
│                                                                      │
│         ✨ AGENT JOURNEYS                                             │
│         ┌─────────────────────┐  ┌─────────────────────┐            │
│         │ 📅 Monthly Close     │  │ 🔄 Financial Recon   │            │
│         │ Consolidation, trial │  │ GL vs sub-ledger     │            │
│         │ balances & close cal │  │ matching & aging     │            │
│         └─────────────────────┘  └─────────────────────┘            │
│         ┌─────────────────────┐  ┌─────────────────────┐            │
│         │ 🏛 Regulatory Capital│  │ 📊 IFRS 9 ECL        │            │
│         │ CET1, RWA, leverage │  │ Expected credit loss │            │
│         │ ratios & Basel III   │  │ staging, PD/LGD      │            │
│         └─────────────────────┘  └─────────────────────┘            │
│         ┌─────────────────────┐  ┌─────────────────────┐            │
│         │ 💧 Daily Liquidity   │  │ 📋 Regulatory Returns│            │
│         │ LCR, NSFR, cash flow│  │ COREP, FINREP, FR    │            │
│         │ forecasting          │  │ Y-9C filing          │            │
│         └─────────────────────┘  └─────────────────────┘            │
│                                                                      │
│  ┌─ Agent Insights (6) ─────────┐  ┌─ Actions Required (5) ──────┐ │
│  │                               │  │                              │ │
│  │ ⚠ SMB Revenue Miss: -$12.4M  │  │ 🔔 Q1 Board Deck Sign-Off   │ │
│  │   (-6.9%) — SMB segment      │  │    REPORTING · Mar 14, 2026  │ │
│  │   revenue of $168.6M came... │  │    Board presentation ready  │ │
│  │                               │  │    [Approve] [Reject]  HIGH │ │
│  │ ⚠ Executive T&E Anomaly      │  │                              │ │
│  │   VP Sales James Mitchell    │  │ 🔔 Vendor Contract Renewal   │ │
│  │   T&E is 312% above peer...  │  │    VENDOR MGMT · $2.4M      │ │
│  │                               │  │    Annual renewal flagged    │ │
│  │ △ 5 Vendors Below Risk       │  │    18% price increase  HIGH │ │
│  │   Threshold — High-risk:     │  │                              │ │
│  │   CloudHost Inc (3.2/10)...  │  │                              │ │
│  │                               │  │                              │ │
│  └───────────────────────────────┘  └──────────────────────────────┘ │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

## 2.2 Section-by-section specification

### Hero section (top, centered)

**Lyzr logo:** Centered, the icon version (not the full wordmark).
Approx 48-64px. This anchors the page visually.

**Welcome message:** "Welcome, {firstName}" in Playfair Display, ~28px.
The user's first name comes from auth/session.

**Product title + tagline:**
"{Product Name} — {tagline}" in DM Sans, muted foreground.
Examples:
- "CFO's Office AgenticOS — Autonomous financial intelligence"
- "HR Office AgenticOS — Autonomous people intelligence for the modern workforce"
- "Campaign Companion AgenticOS — Plan, simulate, and launch your next campaign"

### Search bar (the primary interaction)

```
┌────────────────────────────────────────────────────────┐
│ 📎  How can I help?                              🎤  ➤ │
└────────────────────────────────────────────────────────┘
```

- Full-width (within a max-width container, ~640px)
- Left icon: paperclip (📎) for file attachment
- Placeholder: "How can I help?" or "Ask anything about your {domain}..."
- Right icons: microphone (🎤, optional), send arrow (➤)
- Rounded corners (rounded-xl or rounded-2xl)
- Subtle border with glass-input background
- On focus: ring effect using --ring color

**Critical behavior: When the user types and sends a message from this
search bar, the app navigates to the Agent Console (/agent-console) and
sends that message there.** The home page search bar is a launcher, not
a chat interface. The response streams on the Agent Console page with
the full pipeline visualization.

```typescript
const handleSend = (message: string) => {
  // Navigate to Agent Console with the message as a query param
  navigate(`/agent-console?message=${encodeURIComponent(message)}`);
};
```

The Agent Console page checks for the `message` query param on mount
and auto-sends it if present:

```typescript
useEffect(() => {
  const params = new URLSearchParams(location.search);
  const initialMessage = params.get("message");
  if (initialMessage) {
    sendMessage(initialMessage);
    // Clear the query param so refresh doesn't re-send
    navigate("/agent-console", { replace: true });
  }
}, []);
```

### Integrated systems bar (optional)

A row of small integration logos showing what's connected:

```
INTEGRATED SYSTEMS
[Gmail logo] [Calendar logo] [Workday logo] [Greenhouse logo] [ADP logo]
```

- DM Sans, 11px, uppercase, tracking-widest label
- Logos are small (24-28px height), grayscale or muted, in a row
- Only shown if integrations are configured
- Clicking a logo could link to the Integrations page

### Agent Journeys grid

Header: "✨ AGENT JOURNEYS" — with sparkle icon, DM Sans small caps.

2-column grid of journey cards. Each card:

```
┌──────────────────────────────────────────┐
│  📅  Monthly Close                    >  │
│      Consolidation, trial balances,      │
│      sub-ledger postings & close         │
│      calendar                            │
└──────────────────────────────────────────┘
```

- Lucide icon (left, 24px, muted foreground)
- Journey title in Playfair Display, 16-18px, weight 500
- Description in DM Sans, 13-14px, muted foreground, 2 lines max
- Chevron (>) on the right indicating navigation
- Card background: hsl(var(--card)) with standard border
- Hover: subtle scale (1.01) or background shift
- Click: navigates to the journey page

**First card tooltip (optional):**
A small green/primary colored tooltip attached to the first journey card:
"Start here — validate trial balances & generate your close readiness
checklist". This is a first-time-user hint.

**How many journey cards:** Show all domain journeys (typically 6-8).
If more than 8, show the first 6 with a "View all N journeys" link.

### Agent Insights (bottom-left)

Header: "💡 Agent Insights" with count badge (e.g., "6").

A vertical list of insight cards, severity-coded:

```
⚠  SMB Revenue Miss: -$12.4M (-6.9%)
   SMB segment revenue of $168.6M came in $12.4M below
   the $181.0M forecast. Macro headwinds in the mid-market
   segment are the primary driver.

⚠  Executive T&E Anomaly Detected
   VP Sales James Mitchell T&E is 312% above peer average
   ($124,100 Q1 vs peer avg $30,567).

△  5 Vendors Below Risk Threshold
   High-risk vendors: CloudHost Inc (3.2/10), DataVault
   Systems (4.1/10)...
```

Each insight has:
- Severity icon: ⚠ (warning/red-amber), △ (attention/amber), 💡 (info/blue)
- Bold title with key metric
- Description text (2-3 lines, muted foreground)
- No action buttons — insights are informational

**Where insights come from:** The autonomous layer (Layer 3). Scheduled
agent runs produce findings that surface here. Currently hardcoded as
sample data; real implementation would store agent findings and serve
them via GET /api/dashboard/insights.

### Actions Required (bottom-right)

Header: "🔔 Actions Required" with count badge (e.g., "5").

A vertical list of action cards needing human decision:

```
┌──────────────────────────────────────────┐
│ 🔔 Q1 Board Deck — Final Sign-Off       │
│    REPORTING  ·  Mar 14, 2026   [HIGH]   │
│    Board presentation package ready for  │
│    CFO review. Includes revenue variance │
│    commentary and updated guidance.      │
│    [👍 Approve]  [❌ Reject]              │
└──────────────────────────────────────────┘
```

Each action card has:
- Icon (category-specific)
- Title in Playfair Display, 15-16px
- Category tag + date + priority badge (HIGH/MEDIUM/LOW)
- Description (2-3 lines)
- Amount (if applicable, shown as bold number)
- Action buttons: Approve (primary) + Reject (destructive outline)
- Clicking Approve/Reject either: resolves inline OR navigates to
  the Decision Inbox detail view for that item

**These map to Decision Inbox items.** The Actions Required section on
the home page is a preview of pending Decision Inbox items. Only show
the top 3-5, with a "View all" link to the Decision Inbox page.


# ═══════════════════════════════════════════════════════════════════════════════
# PART 3: WHAT CHANGES PER VERTICAL
# ═══════════════════════════════════════════════════════════════════════════════

## 3.1 What you customize:

1. **Product name and tagline** — "CFO's Office AgenticOS" vs
   "HR Office AgenticOS" etc.
2. **Journey cards** — different journeys per vertical
3. **Journey card icons** — domain-appropriate Lucide icons
4. **First card tooltip text** — domain-specific "start here" hint
5. **Integrated systems logos** — different integrations per vertical
6. **Agent Insights content** — domain-specific findings (sample data)
7. **Actions Required content** — domain-specific decisions (sample data)
8. **Search bar placeholder** — "Ask anything about your finances..." vs
   "Ask anything about your workforce..."

## 3.2 What stays identical:

1. Layout structure (logo → welcome → search → journeys → insights/actions)
2. Search bar → Agent Console redirect behavior
3. Card design patterns
4. Typography (Playfair headings, DM Sans body)
5. Color palette
6. Spacing and grid
7. Agent status bar in sidebar


# ═══════════════════════════════════════════════════════════════════════════════
# PART 4: IMPLEMENTATION
# ═══════════════════════════════════════════════════════════════════════════════

## 4.1 Component structure

```tsx
export default function CommandCenter() {
  const navigate = useNavigate();

  const handleSend = (message: string) => {
    navigate(`/agent-console?message=${encodeURIComponent(message)}`);
  };

  return (
    <div className="flex flex-col items-center px-8 pt-8 pb-4">
      {/* Hero */}
      <img src={LYZR_ICON_URL} className="w-16 h-16 mb-4" />
      <h1 className="font-serif text-3xl font-semibold tracking-tight">
        Welcome, {userName}
      </h1>
      <p className="text-muted-foreground text-sm mt-1">
        {productName} — {tagline}
      </p>

      {/* Search bar */}
      <SearchBar
        placeholder="How can I help?"
        onSend={handleSend}
        className="mt-8 max-w-2xl w-full"
      />

      {/* Integrated systems (optional) */}
      {integrations.length > 0 && (
        <IntegratedSystemsBar systems={integrations} className="mt-4" />
      )}

      {/* Agent Journeys */}
      <section className="w-full max-w-4xl mt-8">
        <SectionHeader icon={Sparkles} title="AGENT JOURNEYS" />
        <div className="grid grid-cols-2 gap-4 mt-4">
          {journeys.map(j => (
            <JourneyCard
              key={j.id}
              icon={j.icon}
              title={j.name}
              description={j.description}
              onClick={() => navigate(j.path)}
            />
          ))}
        </div>
      </section>

      {/* Insights + Actions */}
      <div className="w-full max-w-4xl grid grid-cols-2 gap-8 mt-8">
        <AgentInsights insights={insights} />
        <ActionsRequired actions={actions} />
      </div>
    </div>
  );
}
```

## 4.2 API endpoints

- GET /api/dashboard/insights — Agent-generated findings (sample data initially)
- GET /api/dashboard/actions — Pending Decision Inbox items (top 5)
- GET /api/dashboard/integrations — Connected systems with logos

## 4.3 The search bar component

```tsx
function SearchBar({ placeholder, onSend, className }) {
  const [value, setValue] = useState("");

  const handleSubmit = () => {
    if (value.trim()) {
      onSend(value.trim());
      setValue("");
    }
  };

  return (
    <div className={cn(
      "flex items-center gap-3 px-4 py-3 rounded-2xl",
      "border border-border glass-input",
      "focus-within:ring-2 focus-within:ring-ring/20",
      className
    )}>
      <button className="text-muted-foreground hover:text-foreground">
        <Paperclip size={18} />
      </button>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
        placeholder={placeholder}
        className="flex-1 bg-transparent outline-none text-foreground
                   placeholder:text-muted-foreground"
      />
      <button
        onClick={handleSubmit}
        disabled={!value.trim()}
        className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center",
          value.trim()
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground"
        )}
      >
        <Send size={16} />
      </button>
    </div>
  );
}
```

## 4.4 Journey card component

```tsx
function JourneyCard({ icon: Icon, title, description, onClick, tooltip }) {
  return (
    <div className="relative">
      {tooltip && (
        <div className="absolute -left-2 top-1/2 -translate-y-1/2 -translate-x-full
                        bg-primary text-primary-foreground text-xs px-3 py-2
                        rounded-lg max-w-[180px] z-10">
          {tooltip}
          <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1
                          w-2 h-2 bg-primary rotate-45" />
        </div>
      )}
      <motion.button
        onClick={onClick}
        whileHover={{ scale: 1.01 }}
        className="w-full flex items-start gap-4 p-5 rounded-[var(--radius)]
                   bg-card border border-border text-left
                   hover:border-primary/20 transition-colors"
      >
        <Icon size={24} className="text-muted-foreground mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <h3 className="font-serif text-base font-medium">{title}</h3>
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
            {description}
          </p>
        </div>
        <ChevronRight size={18} className="text-muted-foreground mt-1 shrink-0" />
      </motion.button>
    </div>
  );
}
```

## 4.5 Action card component

```tsx
function ActionCard({ action, onApprove, onReject }) {
  return (
    <div className="p-4 rounded-[var(--radius)] bg-card border border-border">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center
                        justify-center shrink-0">
          <Bell size={16} className="text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-serif text-sm font-medium truncate">
              {action.title}
            </h4>
            <PriorityBadge priority={action.priority} />
          </div>
          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
            <span className="uppercase tracking-wider">{action.category}</span>
            <span>·</span>
            <span>{action.date}</span>
            {action.amount && (
              <>
                <span>·</span>
                <span className="font-semibold text-foreground">{action.amount}</span>
              </>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
            {action.description}
          </p>
          <div className="flex items-center gap-2 mt-3">
            <button onClick={() => onApprove(action.id)}
                    className="text-xs px-3 py-1.5 rounded bg-primary
                               text-primary-foreground font-medium">
              Approve
            </button>
            <button onClick={() => onReject(action.id)}
                    className="text-xs px-3 py-1.5 rounded border
                               border-destructive text-destructive font-medium">
              Reject
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```


# ═══════════════════════════════════════════════════════════════════════════════
# PART 5: COMPONENT CHECKLIST
# ═══════════════════════════════════════════════════════════════════════════════

- [ ] CommandCenterPage — full page layout (centered, scrollable)
- [ ] HeroSection — logo + welcome + product name
- [ ] SearchBar — input with paperclip, mic (optional), send button
- [ ] IntegratedSystemsBar — row of small integration logos
- [ ] JourneyCardsGrid — 2-column grid of journey entry points
- [ ] JourneyCard — icon + title + description + chevron + optional tooltip
- [ ] AgentInsights — left column, severity-coded insight list
- [ ] InsightCard — severity icon + bold title + description
- [ ] ActionsRequired — right column, actionable decision list
- [ ] ActionCard — icon + title + category + date + priority + approve/reject
- [ ] PriorityBadge — HIGH/MEDIUM/LOW colored badge
- [ ] SectionHeader — icon + uppercase label + optional count badge
