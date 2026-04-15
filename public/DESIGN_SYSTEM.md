# DESIGN_SYSTEM.md

# This file defines the visual design system for every Lyzr AgenticOS product.
# Give it to Replit / Claude Code alongside the other standard MD files.
#
# The design system is IDENTICAL across all verticals (HR OS, CFO OS, Legal OS,
# etc.). Only the domain content changes — the colors, fonts, components,
# spacing, and visual language are always the same.


# ═══════════════════════════════════════════════════════════════════════════════
# PART 1: BRAND IDENTITY
# ═══════════════════════════════════════════════════════════════════════════════

## 1.1 The aesthetic

Warm, organic, and premium. The palette is built on cream and deep brown —
it feels like aged paper and leather, not cold blue SaaS. The design evokes
trust, approachability, and craftsmanship. Every AgenticOS product should
feel like a high-end consulting tool, not a generic dashboard.

Key words: warm, earthy, refined, trustworthy, premium, organic.

Anti-patterns: cold blues, neon accents, dark mode by default, generic
SaaS gray, overly playful colors, gradients-as-decoration.

## 1.2 Logo and branding

**Lyzr logo (full):**
https://www.lyzr.ai/wp-content/uploads/2024/11/cropped_lyzr_logo_1.webp

**Lyzr icon (compact):**
https://cdn2.futurepedia.io/2026-02-26T19-07-25.498Z-q6ZO1hg4Romi6JbT7L06v7dv3Sy2zIBis.png?w=256

**Placement:**
- Sidebar header: Lyzr icon + product name + "AgenticOS" subtitle
- Footer: "Powered by Lyzr AgenticOS"
- No logo in the main content area — the sidebar owns the brand

**Product naming pattern:**
```
[Lyzr icon] CFO's Office
            AgenticOS
```
The product name is the domain ("CFO's Office", "HR Operations", "Legal"),
always followed by "AgenticOS" as the subtitle.


# ═══════════════════════════════════════════════════════════════════════════════
# PART 2: COLOR SYSTEM
# ═══════════════════════════════════════════════════════════════════════════════

## 2.1 Core palette

```css
:root {
  /* ── Backgrounds ── */
  --background:           36 33% 94%;      /* hsl(36, 33%, 94%)  — warm cream, page bg */
  --card:                 36 30% 96%;      /* hsl(36, 30%, 96%)  — slightly lighter cream */
  --card-foreground:      25 40% 18%;      /* same as foreground */
  --popover:              36 30% 96%;
  --popover-foreground:   25 40% 18%;

  /* ── Text ── */
  --foreground:           25 40% 18%;      /* hsl(25, 40%, 18%)  — dark brown-black */
  --muted:                30 20% 90%;      /* muted background */
  --muted-foreground:     25 20% 45%;      /* hsl(25, 20%, 45%)  — muted text */

  /* ── Primary (deep brown) ── */
  --primary:              25 62% 25%;      /* hsl(25, 62%, 25%)  — #67391B deep brown */
  --primary-foreground:   36 33% 94%;      /* cream text on brown */

  /* ── Secondary ── */
  --secondary:            30 15% 90%;
  --secondary-foreground: 25 40% 18%;

  /* ── Borders ── */
  --border:               30 15% 85%;      /* hsl(30, 15%, 85%)  — soft warm border */
  --input:                30 15% 85%;
  --ring:                 25 62% 25%;      /* focus ring = primary */

  /* ── Radius ── */
  --radius:               0.75rem;         /* default border-radius (12px) */

  /* ── Semantic (for status badges, alerts) ── */
  --destructive:          0 84% 60%;       /* red for errors/reject */
  --destructive-foreground: 0 0% 98%;
  --success:              142 71% 45%;     /* green for pass/approve */
  --warning:              38 92% 50%;      /* amber for warnings */
  --info:                 217 91% 60%;     /* blue for informational */

  /* ── Accent (text gradient variant) ── */
  --accent-from:          25 62% 25%;      /* hsl(25, 62%, 25%) */
  --accent-to:            30 55% 45%;      /* hsl(30, 55%, 45%) */
}
```

## 2.2 How to use the palette

**Page background:** Always `hsl(var(--background))`. Never white. Never gray.

**Cards:** `hsl(var(--card))` with `border: 1px solid hsl(var(--border))`.

**Primary actions (buttons, active states):** `hsl(var(--primary))` bg with
`hsl(var(--primary-foreground))` text.

**Text hierarchy:**
- Primary text: `hsl(var(--foreground))` — dark brown-black
- Secondary/muted text: `hsl(var(--muted-foreground))` — warm gray-brown
- Never use pure black (#000) or pure gray (#666)

**Status colors (badges, indicators):**
- Pass/Active/Approved: `hsl(var(--success))`
- Warning/Pending/Flagged: `hsl(var(--warning))`
- Error/Failed/Rejected: `hsl(var(--destructive))`
- Info/Running: `hsl(var(--info))`
- Neutral/Available/Draft: `hsl(var(--muted-foreground))`

## 2.3 Background texture

The page background has a faint grid texture:

```css
body {
  background: hsl(36, 33%, 94%);
  background-image:
    linear-gradient(rgba(103, 63, 27, 0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(103, 63, 27, 0.03) 1px, transparent 1px);
  background-size: 40px 40px;
}
```

This gives a subtle warmth and texture without being distracting. The grid
lines use the primary brown at 3% opacity.


# ═══════════════════════════════════════════════════════════════════════════════
# PART 3: TYPOGRAPHY
# ═══════════════════════════════════════════════════════════════════════════════

## 3.1 Font stack

```css
:root {
  --font-sans:  'DM Sans', system-ui, sans-serif;
  --font-serif: 'Playfair Display', Georgia, serif;
  --font-mono:  'JetBrains Mono', 'Fira Code', monospace;
}
```

**Import in index.html:**
```html
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&family=DM+Sans:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
```

## 3.2 Usage rules

**Playfair Display (serif)** — ALL headings (h1 through h6), page titles,
section titles, card titles, metric labels. Tight letter-spacing (-0.02em).
This is the signature font of the product.

**DM Sans (sans-serif)** — ALL body text, labels, buttons, inputs, table
cells, descriptions, subtitles, navigation items, badges, chips. This is
the workhorse font.

**JetBrains Mono (monospace)** — Code blocks, JSON, YAML, file paths,
terminal output, trace step details, tool call arguments. Used in the
pipeline expanded views and Agent Runs trace panels.

## 3.3 Scale

| Element | Font | Size | Weight | Tracking |
|---|---|---|---|---|
| Page title (h1) | Playfair Display | 28-32px | 600 | -0.02em |
| Section title (h2) | Playfair Display | 22-24px | 600 | -0.02em |
| Card title (h3) | Playfair Display | 18-20px | 500 | -0.01em |
| Subtitle (h4) | Playfair Display | 16px | 500 | -0.01em |
| Body text | DM Sans | 14-15px | 400 | normal |
| Small text | DM Sans | 12-13px | 400 | normal |
| Button text | DM Sans | 14px | 500 | normal |
| Badge/chip text | DM Sans | 12px | 500 | 0.02em |
| Code/mono | JetBrains Mono | 13px | 400 | normal |
| Metric number | Playfair Display | 28-36px | 600 | -0.02em |
| Metric label | DM Sans | 11-12px | 500 | 0.05em (uppercase) |

## 3.4 Anti-patterns

- NEVER use Inter, Roboto, Arial, or system-ui as the visible font
- NEVER use the same font for headings and body
- NEVER use Playfair Display for body paragraphs (it's a display font)
- NEVER use DM Sans for page titles (it's too plain for headings)
- NEVER use emoji in headings or labels — use Lucide React icons


# ═══════════════════════════════════════════════════════════════════════════════
# PART 4: GLASSMORPHISM
# ═══════════════════════════════════════════════════════════════════════════════

## 4.1 Glass utility classes

```css
.glass         { background: rgba(255, 252, 248, 0.55); backdrop-filter: blur(20px); }
.glass-strong  { background: rgba(255, 252, 248, 0.72); backdrop-filter: blur(24px); }
.glass-sidebar { background: rgba(255, 252, 248, 0.65); backdrop-filter: blur(30px); }
.glass-card    { background: rgba(255, 252, 248, 0.50); backdrop-filter: blur(16px); }
.glass-input   { background: rgba(255, 252, 248, 0.40); backdrop-filter: blur(12px); }
```

## 4.2 Usage

**Sidebar:** `glass-sidebar` — the sidebar uses heavy blur to feel
layered over the page content.

**Cards:** `glass-card` OR solid `hsl(var(--card))` — use glassmorphism
for hero cards or overlay cards. Use solid fill for data-heavy cards
(tables, lists) where readability matters more than visual effect.

**Inputs:** `glass-input` — search bars and text inputs get subtle glass.

**Rule:** Glass is for ambient surfaces (sidebar, overlays, hero sections).
Data surfaces (tables, forms, dense content) use solid backgrounds.
If the content has more than ~5 data points per card, use solid fill.


# ═══════════════════════════════════════════════════════════════════════════════
# PART 5: COMPONENT PATTERNS
# ═══════════════════════════════════════════════════════════════════════════════

## 5.1 Buttons

```
Primary:     bg-primary text-primary-foreground rounded-[var(--radius)]
             hsl(25, 62%, 25%) background, cream text
             hover: slight lighten (opacity 0.9)

Secondary:   bg-secondary text-secondary-foreground border border-border
             cream background, brown text, warm border

Destructive: bg-destructive text-destructive-foreground
             red background, white text — for Reject, Delete

Ghost:       bg-transparent hover:bg-secondary/50
             no background, shows on hover — for icon buttons

Outline:     bg-transparent border border-border text-foreground
             bordered, no fill — for secondary actions
```

## 5.2 Cards

```css
.card {
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius);        /* 0.75rem = 12px */
  padding: 1.25rem;                    /* 20px */
}
```

Cards use a warm cream fill, not white. The border is soft and warm.
Shadows are minimal — `shadow-sm` at most. No heavy drop shadows.

## 5.3 Status badges

```
Active:    bg-green-50 text-green-700 border-green-200       ● Active
Available: bg-gray-50 text-gray-600 border-gray-200          ○ Available
Draft:     bg-amber-50 text-amber-700 border-amber-200       ◐ Draft
Error:     bg-red-50 text-red-700 border-red-200              ✗ Error
Running:   bg-blue-50 text-blue-700 border-blue-200           ◌ Running
Pending:   bg-amber-50 text-amber-700 border-amber-200        ◷ Pending
```

Badges are pill-shaped (rounded-full), small (text-xs/text-sm, px-2 py-0.5).

## 5.4 Priority badges (Decision Inbox)

```
CRITICAL:  bg-red-100 text-red-800 font-semibold uppercase text-xs
HIGH:      bg-amber-100 text-amber-800 font-semibold uppercase text-xs
MEDIUM:    bg-stone-100 text-stone-700 font-semibold uppercase text-xs
LOW:       bg-gray-100 text-gray-600 font-semibold uppercase text-xs
```

## 5.5 Verdict badges (Compliance checks)

```
PASS:      bg-green-100 text-green-800 font-medium text-xs    ✅ PASS
FLAGGED:   bg-red-100 text-red-800 font-medium text-xs        ⚠ FLAGGED
WARNING:   bg-amber-100 text-amber-800 font-medium text-xs    ⚡ WARNING
```

## 5.6 Metric cards (stat display)

```
┌────────────────┐
│      7         │  ← Playfair Display, 28-36px, weight 600
│   PENDING      │  ← DM Sans, 11px, uppercase, tracking-widest
│   3 Critical   │  ← DM Sans, 12px, colored (red for critical)
└────────────────┘
```

Background: card color or slight variation. Border: standard warm border.
The large number is the hero element — serif font, large, centered.
The label below is small caps (uppercase + letter-spacing).

## 5.7 Tables

- Header row: uppercase DM Sans, 11px, tracking-wide, muted foreground
- Body rows: DM Sans, 14px, normal weight
- Row hover: subtle background shift (bg-secondary/30)
- Borders: horizontal only (border-b), warm color, 1px
- No vertical borders
- Clickable rows: cursor-pointer + hover highlight
- Alternating row colors: NOT used (too busy with warm palette)

## 5.8 Sidebar

```css
.sidebar {
  width: 220px;                        /* fixed width */
  background: rgba(255, 252, 248, 0.65);
  backdrop-filter: blur(30px);
  border-right: 1px solid hsl(var(--border));
  padding: 1rem 0.75rem;
}
```

**Section headers:** "BUILD", "OBSERVE" — DM Sans, 11px, uppercase,
tracking-widest, muted foreground, no bold.

**Nav items:** DM Sans, 14px, normal weight. Lucide icon (18px) + label.
Hover: bg-secondary/50 rounded. Active: bg-primary/10 rounded, primary
text color.

**Active item highlight:**
```css
.nav-item-active {
  background: hsl(var(--primary) / 0.08);
  color: hsl(var(--primary));
  border-radius: var(--radius);
  font-weight: 500;
}
```

## 5.9 Code blocks (pipeline expanded views, trace details)

**Input blocks (dark):**
```css
.code-input {
  background: hsl(25, 30%, 15%);       /* very dark brown */
  color: hsl(36, 20%, 80%);            /* warm light text */
  font-family: var(--font-mono);
  font-size: 13px;
  padding: 1rem;
  border-radius: var(--radius);
  overflow-x: auto;
}
```

**Output blocks (tinted):**
```css
.code-output {
  background: hsl(152, 30%, 92%);      /* light teal-green tint */
  color: hsl(152, 40%, 20%);           /* dark teal text */
  font-family: var(--font-mono);
  font-size: 13px;
  padding: 1rem;
  border-radius: var(--radius);
  overflow-x: auto;
}
```

This creates a clear visual distinction between what went IN (dark) and
what came OUT (green-tinted), matching the CFO OS execution trace.


# ═══════════════════════════════════════════════════════════════════════════════
# PART 6: ICONS
# ═══════════════════════════════════════════════════════════════════════════════

## 6.1 Icon library

Use Lucide React exclusively. No emoji anywhere in the UI.

```bash
npm install lucide-react
```

## 6.2 Standard icon mappings

### Sidebar navigation:
| Page | Icon |
|---|---|
| Home | Home |
| (Domain journeys) | Domain-specific — FileText, Calculator, Scale, etc. |
| Agent Studio | Bot |
| Skills Manager | Wrench (or Puzzle) |
| Knowledge Base | BookOpen |
| Integrations | Plug |
| Skill Flows | GitBranch |
| Decision Inbox | Inbox |
| Agent Runs | Search |
| Compliance & Guardrails | Shield |
| Audit Trail | ClipboardList |

### Pipeline step icons (from AGENT_STREAMING.md):
| Step type | Icon |
|---|---|
| agent_init | Cpu |
| skill_discovery | Compass |
| skill_load | BookOpen |
| memory_load | Brain |
| file_read | FileSearch |
| file_write | FilePlus |
| tool_exec | Terminal |
| llm_thinking | Sparkles |
| wiki_update | Network |
| output_ready | CheckCircle |
| error | AlertCircle |

### Status indicators:
| Meaning | Icon |
|---|---|
| Active/Running | circle with green dot (custom) |
| Completed/Pass | CheckCircle |
| Failed/Error | XCircle |
| Warning/Flagged | AlertTriangle |
| Pending | Clock |
| Expand | ChevronRight |
| Collapse | ChevronDown |
| Close | X |
| Settings | Settings |
| Delete | Trash2 |

## 6.3 Icon sizing

- Sidebar nav icons: 18px (size={18})
- In-line with text: 16px
- Card action buttons: 16px
- Pipeline step icons: 16px
- Metric card icons: 20px
- Empty state icons: 48px (muted)

## 6.4 No emoji rule

The product uses Lucide icons exclusively. No emoji (🔧, 📄, 🧠, etc.)
should appear in the rendered UI. Emoji may appear in agent responses
(the LLM sometimes uses them), but all UI chrome — labels, badges,
buttons, navigation, pipeline steps — uses Lucide icons.

The only exception is status indicators in agent-generated markdown
tables (✅, ⚠️), which are part of the agent's response content.


# ═══════════════════════════════════════════════════════════════════════════════
# PART 7: SPACING AND LAYOUT
# ═══════════════════════════════════════════════════════════════════════════════

## 7.1 Page layout

```
┌──────────┬───────────────────────────────────────────────┐
│          │                                               │
│ Sidebar  │            Main Content                       │
│ 220px    │            flex-1                             │
│ fixed    │            px-8 pt-8 pb-4                     │
│          │            max-width: none                    │
│          │                                               │
└──────────┴───────────────────────────────────────────────┘
```

**Page padding:** `px-8 pt-8 pb-4` (32px sides, 32px top, 16px bottom).
This gives generous breathing room.

**Content max-width:** None. Content fills the available width. This
allows tables and dashboards to use full width on large screens.

## 7.2 Spacing scale

Use Tailwind's spacing scale consistently:

| Token | Value | Usage |
|---|---|---|
| gap-2 | 8px | Between badges, between icon and label |
| gap-3 | 12px | Between list items |
| gap-4 | 16px | Between cards in a grid, between form fields |
| gap-6 | 24px | Between sections within a page |
| gap-8 | 32px | Between major page sections |
| p-4 | 16px | Card padding (compact) |
| p-5 | 20px | Card padding (standard) |
| p-6 | 24px | Card padding (spacious) |
| px-8 | 32px | Page horizontal padding |

## 7.3 Border radius

```
--radius:      0.75rem (12px)   — default (cards, inputs, buttons)
rounded-lg:    1rem (16px)      — large cards, modals
rounded-xl:    1.5rem (24px)    — hero cards, feature sections
rounded-2xl:   2rem (32px)      — largest elements only
rounded-full:  9999px           — badges, pills, avatars
```

## 7.4 Grid patterns

**Metric cards:** 4-5 across, `grid grid-cols-4 gap-4` or `grid grid-cols-5 gap-3`

**Skill/agent cards:** 2-3 across, `grid grid-cols-2 gap-4` or `grid grid-cols-3 gap-4`

**Journey cards (home page):** 2 across, `grid grid-cols-2 gap-6`


# ═══════════════════════════════════════════════════════════════════════════════
# PART 8: ANIMATION
# ═══════════════════════════════════════════════════════════════════════════════

## 8.1 Animation library

Use Framer Motion for all animations:

```bash
npm install framer-motion
```

## 8.2 Standard animations

**Pipeline steps (appearing):**
```tsx
<motion.div
  initial={{ opacity: 0, y: 8 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.2 }}
>
```

**Card hover:**
```tsx
<motion.div whileHover={{ scale: 1.01 }} transition={{ duration: 0.15 }}>
```

**Slide-over panels (Agent Runs trace):**
```tsx
<motion.div
  initial={{ x: "100%" }}
  animate={{ x: 0 }}
  exit={{ x: "100%" }}
  transition={{ type: "spring", damping: 25, stiffness: 200 }}
>
```

**Spinner (running indicator):**
```tsx
<motion.div
  animate={{ rotate: 360 }}
  transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
>
```

## 8.3 Animation rules

- Keep animations subtle and fast (150-300ms)
- No bounce effects
- No dramatic page transitions
- Pipeline steps slide in from below (y: 8 → 0)
- Panels slide in from the right (x: 100% → 0)
- Hover effects are minimal (scale 1.01, not 1.05)
- Loading states use a simple spinner, not skeleton screens


# ═══════════════════════════════════════════════════════════════════════════════
# PART 9: TECH STACK
# ═══════════════════════════════════════════════════════════════════════════════

## 9.1 Frontend dependencies

```json
{
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "vite": "^7.0.0",
    "tailwindcss": "^4.0.0",
    "framer-motion": "^11.0.0",
    "wouter": "^3.0.0",
    "lucide-react": "^0.400.0",
    "react-markdown": "^9.0.0",
    "remark-gfm": "^4.0.0",
    "recharts": "^2.12.0",
    "@tanstack/react-query": "^5.0.0",
    "d3": "^7.0.0"
  }
}
```

## 9.2 Key choices

| Concern | Choice | Why |
|---|---|---|
| Routing | wouter | ~1KB, simple, sufficient |
| Styling | Tailwind CSS 4 | Utility-first, fast iteration |
| Components | shadcn/ui (modified) | Unstyled primitives, customized with our palette |
| Icons | Lucide React | Consistent, clean, 1000+ icons |
| Charts | Recharts | Simple, React-native, sufficient for dashboards |
| Wiki graph | D3.js | Force-directed graph for wiki visualization |
| Markdown | ReactMarkdown + remark-gfm | Render agent responses with tables, code blocks |
| Animation | Framer Motion | Smooth, declarative, React-native |
| Data fetching | TanStack React Query | Cache, refetch, loading states |
| State | React state + Query cache | No Redux/Zustand needed |


# ═══════════════════════════════════════════════════════════════════════════════
# PART 10: WHAT NEVER CHANGES ACROSS VERTICALS
# ═══════════════════════════════════════════════════════════════════════════════

When building a new AgenticOS for a new vertical, the ENTIRE design system
stays the same. You do NOT change:

- Colors (the warm palette is the Lyzr brand)
- Fonts (Playfair Display + DM Sans + JetBrains Mono)
- Glassmorphism values
- Component patterns (buttons, cards, badges, tables)
- Icon library (Lucide React)
- Spacing scale
- Border radius scale
- Animation patterns
- Background texture
- Sidebar structure and styling
- Code block styling (dark input, green output)
- Pipeline step rendering

What you DO customize per client (not per vertical):
- Logo placement (if white-labeled)
- Primary color hue (if client wants their brand color instead of brown)
  In this case, shift the entire palette — don't just change one variable

For Lyzr-branded products: the palette is always warm brown. No variations.
