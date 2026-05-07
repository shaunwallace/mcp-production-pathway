# Visual prompt — The cost curve of AI feature development

> CFO-facing visual for the Executive Brief. Output target: `fast-track/assets/exec-02-cost-curve.svg`.

## Concept

A two-line chart showing the marginal cost of building each successive AI feature in an organisation. **Without MCP**, the line is roughly flat-and-high — every new feature carries roughly the same integration cost as the first. **With MCP**, the line slopes down sharply after the first few features, because the integration is built once and reused.

The reader (a CFO, a finance-aware CEO) should grasp in under 5 seconds that the unit economics of AI feature development *change shape* under MCP — from "linear in features" to "linear in systems."

## Audience cue

Finance-literate executive. Comfortable with charts. Will not appreciate fake numbers presented as real, but will appreciate the *shape* of the relationship clearly conveyed. The chart is illustrative, not a measurement — make that obvious.

## Required elements

- A clean Cartesian chart, left-to-right.
- **X-axis:** "Number of AI features shipped" — labels at 1, 2, 3, 4, 5, 6, 7, 8.
- **Y-axis:** "Marginal cost to ship the next feature" — no specific units. A small annotation "(illustrative)" near the axis title.
- **Two lines:**
  - Line A — labelled **"Without MCP"** — starts at a high point at feature 1, stays roughly flat (small undulation, slight slow rise from accumulated tech debt) all the way to feature 8. Rendered in a warm muted accent (terracotta / amber) — slightly fatigued, dashed if the style accommodates.
  - Line B — labelled **"With MCP"** — starts at the **same high point** at feature 1 (the protocol doesn't help on day one), stays high at feature 2, then bends sharply downward between features 3 and 5, flattening out to a low asymptote by feature 8. Rendered in a cool accent (teal / slate blue), solid, confident.
- **Two annotations / call-outs:**
  - At feature 1, a small label noting "*First feature — same cost either way*" with a discreet pointer to where both lines start.
  - In the gap between the two curves at feature 6 or 7 (where they're furthest apart), a label noting "*This gap is the standardisation dividend.*"
- **Subtitle below the chart:** "From 'linear in features' to 'linear in systems integrated.'"
- **Title above the chart:** "**The cost curve of AI feature development bends.**"

## Style direction

- Clean, editorial chart. Think *Financial Times* graphics desk, or *Pudding* explainer style. Not a screenshot of Excel; not a stock dashboard.
- Muted, professional palette. Two accent colours plus a neutral grid. Grid should be very faint — suggestion of structure, not dominant.
- Generous whitespace. The two curves and their relationship are the entire visual; everything else is supporting.
- Sans-serif typography (Inter, IBM Plex Sans, GT America). Axis labels small and unobtrusive. Annotations slightly larger, in a darker neutral.
- The two lines should be visually distinguishable without relying on colour alone (one solid, one dashed, or different stroke weights) — accessibility matters for an executive audience reading on phones.

## Aspect ratio / format

- 16:9 landscape (1920×1080), SVG preferred.
- Should render cleanly inline at 900px wide.
- Transparent or very pale neutral background.

## Anti-requirements

- **No precise numbers on the Y-axis.** No dollar signs, no "$50k → $5k". The chart is illustrative; precise numbers would imply false precision and undermine credibility with the audience that matters most here.
- No 3D, no shaded "area under the curve" effects, no glossy gradients, no decorative arrows or sparkles.
- No exponential / logarithmic curve drama — the "With MCP" line bends but plausibly; it does not dive to zero.
- No clip-art or icon embellishments (no robot at one end of the chart, no money-bag at the other).
- No "ROI" language anywhere in the chart. The audience knows what they're looking at.
- Do not invert axes. X is always feature count, Y is always cost.

## Reference (structural ground truth, not for direct rendering)

```
Cost
 ^
 |  ●─●─●─●─●─●─●─●     ← Without MCP (flat-ish, high)
 |
 |  ●
 |   ●
 |     ●
 |        ●─●─●─●        ← With MCP (bends, flattens low)
 |
 +────────────────────────> Number of features
    1  2  3  4  5  6  7  8
```

The illustrator should treat the bend in the "With MCP" line as the focal point of the chart. It should be the thing the eye lands on first, supported by the annotation labelling it as the "standardisation dividend."

## Notes

If a designer wants to add a small inset legend, keep it minimal — two coloured dots with the line names, top-right corner. No box around it.
