# Visual prompt — Internal AI as an emergent property

> CEO-facing visual for the Executive Brief. Output target: `fast-track/assets/exec-04-emergent-internal-ai.svg`.

## Concept

A two-panel illustration showing the change in *how internal AI arrives* once a company has published a few MCP servers. **Before:** "internal AI" is a project — a single big initiative, slow, IT-led, with a delivery date. **After:** internal AI is *emergent* — every AI tool an employee already uses (Claude Desktop, Cursor, an internal copilot) connects to the published servers automatically. The capability appears as a side-effect of the servers existing.

The reader (a CEO or COO) should grasp in under 8 seconds: *the question changes from "when will IT deliver internal AI?" to "what should we connect next?"*

## Audience cue

Strategic leader thinking about pace and dependencies. Will recognise the difference between "ship a thing" and "create conditions for things to ship themselves." The visual must convey that distinction without hand-waving.

## Required elements

**Two panels, side by side, with a clear visual contrast.**

### Left panel — labelled **"Before: internal AI as a project"**

- A single large rounded rectangle in the centre labelled **"Internal AI Assistant (v1)"**, rendered as a heavy, monolithic block.
- A small icon-free silhouette of a Gantt-bar above it labelled "Q3 delivery."
- Three small employee-representing nodes (rendered as plain labelled rectangles: "Engineer", "Analyst", "Sales") sitting *outside* and *waiting* — connected to the central block by faint dotted lines or no lines at all, with a small caption: "Waiting for delivery."
- Small caption beneath the panel: *"One project. One owner. One date. Everyone else waits."*
- Mood: heavy, static, slow. Use a fatigued warm accent (muted amber / terracotta) on the central block.

### Right panel — labelled **"After: internal AI as an emergent property"**

- Three MCP server nodes stacked vertically in the centre, each labelled:
  - "Warehouse MCP server"
  - "CRM MCP server"
  - "Docs MCP server"
- Around them, a constellation of *existing* AI tools that employees already use, labelled (without logos):
  - "Claude Desktop"
  - "Code editor copilot"
  - "Internal chatbot"
  - "Customer support assistant"
- Clean lines from each AI tool to each MCP server — the network is *already connected*. No central project block, no Gantt bar.
- The same three employee nodes (Engineer, Analyst, Sales), now sitting **inside** the network, with arrows showing them already using the AI tools that already connect to the servers.
- Small caption beneath the panel: *"Servers exist. Tools connect. Capability appears."*
- Mood: light, distributed, alive. Use a cool confident accent (teal / slate blue) on the servers and connections.

### Across the top, spanning both panels

- Banner: **"The question changes."**
- Subtitle: *"From 'when will IT ship internal AI?' to 'what should we connect next?'"*

## Style direction

- Clean editorial. Think *Stripe Press*, *Linear* changelog illustrations, *Anthropic* brand. Calm, confident, slightly architectural.
- Muted palette. Two accent colours (warm for the "before" panel, cool for the "after"), plus neutral. The contrast between the heavy monolithic left and the distributed light right is the entire visual argument.
- Generous whitespace. The right panel especially should *breathe* — the looseness is part of the message.
- Sans-serif typography (Inter, IBM Plex Sans, GT America). Labels small, captions slightly larger.
- Subtle elevation, no heavy outlines.

## Aspect ratio / format

- 16:9 landscape (1920×1080), SVG preferred. Renders cleanly at 1200px wide for inline use.
- Transparent or very pale neutral background.

## Anti-requirements

- **No literal "AI brain" or "neural network" imagery.** No glowing nodes, no abstract neural meshes, no chatbot bubbles.
- No human figures with faces. The "Engineer / Analyst / Sales" nodes are simple labelled rectangles, not avatars.
- No rocket-ship / lightbulb / "innovation" clip-art.
- No 3D, no isometric, no skeuomorphic devices.
- No corporate logos for Claude / Cursor / specific copilots — use neutral labels.
- No timeline or Gantt-bar imagery in the right panel. The whole point is that there isn't one.
- Avoid making the "before" panel look *bad* in a moralising way (no dust clouds, no cobwebs, no sad-face). It is just *heavier*.

## Reference (structural ground truth, not for direct rendering)

```
Before                              After
┌──────────────────────┐            ┌──────────────────────┐
│   [Q3 delivery]      │            │  [Claude Desktop]    │
│                      │            │   ─┐                 │
│  ┌────────────────┐  │            │    ├─→ [Warehouse]   │
│  │ Internal AI    │  │            │    │                 │
│  │ Assistant (v1) │  │            │  [Code copilot] ─┐   │
│  └────────────────┘  │            │    ├─→ [CRM]     │   │
│                      │            │    │             │   │
│  Engineer (waits)    │            │  [Internal bot] ─┤   │
│  Analyst  (waits)    │            │    └─→ [Docs]   ─┘   │
│  Sales    (waits)    │            │                      │
│                      │            │  Engineer (using)    │
│                      │            │  Analyst  (using)    │
│                      │            │  Sales    (using)    │
└──────────────────────┘            └──────────────────────┘
```

The illustrator should treat the *contrast in density and motion* between the two panels as the hero. The left is a single heavy block with people queueing; the right is a connected, breathing network where everyone's already plugged in.

## Notes

If the right panel feels too crowded with four AI tools and three servers, it's fine to reduce to three tools and two servers — the *pattern* matters more than the specific count. Do not reduce below 2× server count, though, or the "constellation" feel collapses.
