# Worked examples

Reference artefacts that show the shape of a good memo, ADR, iteration log, and harness trace. Use them to calibrate your own work when you're unsure whether you're on the right track.

**These are not answer keys.** There is no single correct memo or ADR for any given brief. Two of the files here (`memo-example-a.md` and `memo-example-b.md`) intentionally solve the same Week 1 brief in different ways, because a senior engineer should see more than one defensible shape before fixing on their own voice.

## What's here

| File | Use |
|------|-----|
| [`memo-example-a.md`](memo-example-a.md) | A Week 1 "why MCP" memo in a prose-first shape. Strong TL;DR, argument, honest closing. |
| [`memo-example-b.md`](memo-example-b.md) | The same Week 1 brief, written as a decision-tree memo for a different audience. Shows legitimate variation. |
| [`adr-example.md`](adr-example.md) | A Week 1 SDK/backend ADR, filled in fully. Shows the bar for rationale and consequences. |
| [`iteration-log-example.md`](iteration-log-example.md) | Two fully-worked Week 3 iteration entries with before/after numbers and residual-failure analysis. |
| [`harness-trace-example.md`](harness-trace-example.md) | Sample harness output — single-prompt and eval-mode — so you can calibrate what "good" looks like. |
| [`progress-entry-example.md`](progress-entry-example.md) | Two worked progress-log entries showing the Did / Saw / Next / Stuck on shape. The artefact you'll write most often. |

## How to use these when you're stuck

1. **Draft your own artefact first.** Don't open the example, then write against it — you'll anchor on the shape rather than developing your own.
2. **When you feel stuck or uncertain, open one example.** Note what it does structurally (headings, length, pacing) that your draft doesn't.
3. **Don't copy the content.** The examples use invented scenarios; your work should use yours. If your memo's "what I changed my mind on" is the same as the example's, something is wrong.

## Further reading on the craft

If you want to go deeper on memo/ADR craft, these are the canonical references:

**On writing memos:**

- **Amazon's 6-pager / narrative memo culture.** Widely written about; Jeff Bezos's 2017 shareholder letter is a primary source. The underlying principle — narrative forces clearer thinking than bullets — carries even if you never work at Amazon.
- **Jacob Kaplan-Moss, "Technical writing" series.** <https://jacobian.org/> (search the site). Practical and specific.
- **Gergely Orosz, "The Pragmatic Engineer."** Many good posts on tech-lead writing artefacts; search for "RFC" or "design doc."

**On writing ADRs:**

- **Michael Nygard, "Documenting architecture decisions"** (2011). The original. Short. Read it.
- **Joel Parker Henderson's ADR collection.** <https://github.com/joelparkerhenderson/architecture-decision-record> — examples, templates, and variants. Skim the different templates; notice that most are lightweight by design.
- **ThoughtWorks Technology Radar** on "Lightweight Architecture Decision Records." A good short case for the practice.

**On writing progress logs:**

- **Julia Evans, "Blogging about incidents."** Search julia.evans — she writes well about honest progress logging.
- **Engineering-manager handbooks** (many exist) often have sections on "how to write weekly updates" that port to individual work.

These links worked at time of writing; if anything 404s, search for the title — these authors tend to keep stable URLs.
