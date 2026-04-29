---
title: Leader Fast Track — Spec
description: The agreed shape for the Leader Fast Track. Source of truth for what the track is and isn't.
---

# Leader Fast Track — Spec

A standalone, consumption-oriented track that distils the 12-week MCP pathway for senior engineering leaders (CTO, VP Eng, Head of, Director). One work-week of evenings, ~5 hours total. No artefacts required.

This document is the agreed spec. Chapters are drafted against it. Changes here precede content changes.

## Audience and stance

- **Reader**: senior engineering leader. Reads code, doesn't need to run it to understand the concept. Code snippets are clearly marked as optional copy-paste.
- **Goal**: the reader leaves with enough mental model, vocabulary, and judgement to (a) make build/buy/architecture calls confidently, (b) brief their own teams, and (c) recognise good vs sketchy MCP work in the wild.
- **Non-goal**: producing memos, ADRs, or completing exercises. The 12-week track is where that lives.

## Structure

5 chapters, one per evening. Each chapter:

- 45–60 min read + skim time
- Narrative prose at altitude — explain the *why* before the *what*
- 2–4 inline Mermaid diagrams for structural concepts
- 1–2 "hero" diagrams per chapter authored as **visual prompts** in `fast-track/visual-prompts/` for external image-gen models to produce polished SVG/PNG assets — see [Visual prompt workflow](#visual-prompt-workflow)
- 1–2 runnable code snippets, each prefixed with a one-line "what this proves" header and marked **Optional — copy-paste to run**
- A recurring SaaS vignette (see [Vignette](#the-vignette-marlin)) used to ground every abstract concept

Strategy and leadership framing is woven implicitly through chapter intros and asides — not a dedicated chapter.

## Chapter outline

| # | Chapter | Working title | Distils from 12-week | What the leader leaves with |
|---|---|---|---|---|
| 1 | What MCP is, and what it changes | Honest framing of the problem; what it opens up; alternatives (A2A, function calling, OpenAPI) | W1, W12 framing | A clear answer to "what does MCP actually solve, what does it open up, and how does it relate to A2A and the other options?" |
| 2 | The mental model | "Host, client, server — and why tool names are the API" | W1–W3 | Vocabulary; ability to read an MCP architecture diagram; understanding that *tool descriptions are prompts* |
| 3 | Architecture in depth | "Transports, topologies, and tool design" | W2–W3, W8 | How real systems compose multiple servers; stdio vs HTTP transport tradeoffs; what good tool design looks like |
| 4 | The risk surface | "Prompt injection, auth, exfiltration — STRIDE for MCP" | W11–W12 | A concrete threat model; the questions to ask before letting an MCP server near production data |
| 5 | Making it reliable | "Evals, observability, cost, versioning" | W3, W8–W10 | Why "it worked in demo" is not a green light; what production-grade MCP looks like |

Progression: **why → what → how → safety → durability.**

## The vignette: Marlin

A fictional mid-market **RevOps SaaS** called **Marlin**. Used as the recurring example across all 5 chapters so concepts compound rather than reset.

- **Product**: pipeline analytics, deal-stage automation, and forecast tooling for revenue operations teams. Customers are mid-market B2B sales orgs (50–500 reps).
- **Integrations**: Salesforce, HubSpot, Slack, Gong, Snowflake. This is what makes MCP relevant — Marlin's integration surface is currently bespoke and expensive to maintain.
- **Why it works as a teaching vehicle**:
  - Multi-system integration (chapter 1's core motivation)
  - Multi-tenant SaaS — customer-data-isolation matters (chapter 4)
  - Sensitive financial/forecast data — wrong numbers are not just embarrassing, they're material (chapter 5)
  - Plausible AI agent use cases (deal summarisation, forecast Q&A, pipeline hygiene checks)
- **No named recurring characters**: Marlin is referenced as an organisation, not via personas. (Earlier draft used a Head of Engineering character; cut in chapter 1 rewrite to keep the register honest rather than narrative.)

Marlin is not real. Don't make it sound like a competitor or anything Signal-AI-adjacent.

## Repository layout

```
fast-track/
├── SPEC.md                         # this file
├── README.md                       # entry point: "Start here, ~5 hours total"
├── 01-why-mcp-exists.md
├── 02-mental-model.md
├── 03-architecture-in-depth.md
├── 04-risk-surface.md
├── 05-making-it-reliable.md
├── visual-prompts/                 # one .md per hero diagram, see workflow below
│   ├── 01-integration-tax-before-after.md
│   ├── 02-host-client-server-anatomy.md
│   └── ...
└── assets/                         # generated SVG/PNG outputs, committed once produced
    └── ...
```

Mirrored into `docs-site/` as a parallel sidebar section. Markdown is the single source of truth.

## Visual prompt workflow

The user has opted to author hero diagrams via an external image-gen model rather than hand-drawn SVG. For every hero diagram in the chapters:

1. Inline Mermaid is included in the chapter for **structural** concepts (sequence diagrams, component graphs, simple flows). These render natively in GitHub and docs-site and are cheap to maintain.
2. **Hero diagrams** — the "money shot" per chapter (e.g. integration-tax before/after, the risk-surface map, the eval feedback loop) — are not authored as Mermaid. Instead, each gets a dedicated prompt file in `fast-track/visual-prompts/`.

Each visual-prompt file contains:

- **Concept**: what the diagram is teaching, in one paragraph
- **Audience cue**: senior engineering leader; should read in <10 seconds
- **Required elements**: the entities, arrows, labels, and groupings that must appear
- **Style direction**: clean, modern, technical-illustration register; muted palette; no stock-clipart vibes; legible at thumbnail size
- **Aspect ratio / format**: target 16:9 SVG, transparent background where possible
- **Anti-requirements**: what to avoid (e.g. no 3D, no isometric clutter, no decorative humans)
- **Reference Mermaid**: a rough Mermaid version of the same idea, so the image model has structural ground truth

Outputs land in `assets/` and are referenced from chapters via standard markdown image syntax. The prompt file stays alongside as the regeneration source.

Approximate count: **2 hero prompts per chapter = 10 prompt files**.

## Code snippets

- Pulled from `server/` and `harness/` worked examples, trimmed to fit on one screen
- Each prefixed with: `> **Optional — copy-paste to run.** What this proves: <one line>.`
- No new code is invented for the fast-track. If a concept needs code that doesn't exist in the main pathway yet, it's described in prose only.

## Tone

- Direct, opinionated, no hedging. Leaders read enough wishy-washy strategy content already.
- Past-tense, first-person asides are fine ("I've seen teams ship this and regret it because...") — matches the existing pathway voice.
- Avoid "AI hype" register. The pathway's credibility depends on sounding like an engineer wrote it.

## What this track deliberately does not do

- No exercises, no checkpoints, no artefacts to produce
- No coverage of MCP SDK internals, transport implementation details, or protocol-level message shapes — those live in the 12-week track
- No vendor comparisons, no "MCP vs LangChain vs ..." — out of scope and ages badly
- No coverage of weeks not yet published in the main pathway (W4–W12 framing only, no deep technical claims that depend on unpublished material)

## Open items / decisions deferred

- Whether the fast-track gets its own top-level entry in `README.md` or sits as a sibling link — defer until chapter 1 is drafted and we can see the shape
- Whether to add a 1-page printable "cheat sheet" PDF as a stretch deliverable — not in v1
- Localisation / accessibility passes on generated SVGs — flagged but not blocking v1
