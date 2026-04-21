---
title: MCP Production Pathway
description: A 12-week learning pathway for building a production-grade Model Context Protocol server.
---

# MCP Production Pathway

A 12-week learning pathway for building a production-grade Model Context Protocol server, covering protocol internals, deployment, authentication, observability, evals, cost, and security. Written for senior engineers and engineering leaders who want practitioner-level fluency with the production MCP stack.

## What you'll build

By the end of the pathway, you will have a deployed, authenticated, observable, multi-tenant MCP server with a real threat model, a load test, and an eval harness, plus a set of memos and a decision log that could stand up to scrutiny in an exec review or technical interview.

The reference implementation is TypeScript end to end, using the official MCP SDK, Anthropic SDK, and OpenTelemetry.

## Who this is for

Engineers with production experience who are new to MCP specifically. The pathway assumes comfort with TypeScript, HTTP, JSON-RPC concepts, OAuth at a basic level, and some form of container or serverless deployment. It does not assume any prior MCP work.

## Who this is not for

Not a quickstart. Not a "build an AI agent in 10 lines" tutorial. The work is deliberate, the timelines are weeks not hours, and the point is depth.

## How to use this repo

This is a template repository. It contains four kinds of content:

- **Curriculum** (the textbook): `weeks/`, this README. Read-only reference material.
- **Templates and worked examples** (calibration): `templates/` (blank scaffolds for memos, ADRs, progress entries) and `templates/examples/` (worked examples of each artefact, for when you're stuck or want to check the shape of your own work).
- **Scaffolds** (the workbook starter): `server/`, `harness/`. Empty code with TODOs that you fill in.
- **Supporting material**: `PATHWAY.md` (12-week artefact-dependency map), `docs/` (pinned Claude model IDs), `scripts/` (small helpers like the 300-line harness check), `.env.example` (placeholder for the env vars you'll need).

The right way to use it is to create your own private workbook from this template (GitHub → "Use this template" → "Create a new repository") and do your work there. See `REPO-ARCHITECTURE.md` for the full pattern.

## The 12-week arc

| Phase | Weeks | Focus | Status |
|-------|-------|-------|--------|
| 0 | 1 | Mental model: what MCP is, what it isn't | **Available** |
| 1 | 2-3 | First server, tool design, agent harness | **Available** |
| 2 | 4-5 | Protocol internals, transports, resumability | Coming soon |
| 3 | 6-7 | OAuth and identity | Coming soon |
| 4 | 8-9 | Deployment and SLOs | Coming soon |
| 5 | 10-11 | Observability, evals, cost | Coming soon |
| 6 | 12 | Security, multi-tenancy, hostile inputs | Coming soon |

This pathway is released iteratively as modules, not all up-front. Weeks 1-3 are live. Weeks 4-12 are outlined below and will be published as they're written. You can start Phase 0 today; later phases will land as you need them.

### What each week covers

One-paragraph preview per week so you can see the whole arc before you begin.

- **Week 1 — Mental model.** What MCP actually is, honestly, including what it is not. Reading: spec, JSON-RPC 2.0, Anthropic's announcement, critical pieces on MCP's limits. Output: a one-page "why MCP" memo and your first ADR pinning SDK and backend choice.
- **Week 2 — First server.** Design 4-6 tools against a real third-party backend of your choice (Week 0 has a criteria-based menu; GitHub is the "no preference" default), fill in the server scaffold, wire up structured logging, and build a minimal agent harness that drives the server through Claude. Output: a working end-to-end MCP server you've exercised in Claude Desktop.
- **Week 3 — Iterate and measure.** Write your first eval dataset. Extend the harness to run it. Use tool-selection pass rate to drive concrete iterations — rename, re-describe, redesign. Output: Phase 1 memo plus an eval set that becomes the regression guard for every subsequent phase.
- **Week 4 — Streamable HTTP transport.** Port your server off stdio to the HTTP transport defined in the spec. Understand the implications for connection lifecycle, statelessness, and latency. Rerun the Week 3 eval under HTTP to confirm nothing regressed.
- **Week 5 — Session resumability and progress.** Implement session resumption, progress notifications for long-running tools, and cancellation. Measure reconnect behaviour from the harness. Output: ADR on state model; memo on Phase 2 tradeoffs.
- **Week 6 — OAuth 2.1 foundations.** Implement the server side of OAuth (discovery, token validation, scopes). Read the spec's authentication sections carefully; this is where most production servers cut corners they regret.
- **Week 7 — Harness as OAuth client.** Teach the harness to complete a real OAuth flow (PKCE, token refresh, rotation). Output: Phase 3 memo on identity choices; rerun evals under authenticated calls.
- **Week 8 — Deployment and SLOs.** Target either a container platform (Cloud Run, Fly.io, Railway) or a serverless platform. Set explicit SLOs (p95 latency, error budget, concurrency). Wire up health checks and graceful shutdown.
- **Week 9 — OpenTelemetry and tracing.** Replace the Week 2 `instrument()` wrapper with OTel spans that propagate across the harness → server → backend path. Output: the first real trace-driven debugging session; Phase 4 memo on observability.
- **Week 10 — Evals as CI; cost attribution.** Wire the Week 3 eval set into a scheduled run. Attribute cost per session, tool, and user. Output: a dashboard of pass rate + cost over time; ADR on attribution model.
- **Week 11 — Load testing and cost modelling at scale.** Concurrent harness mode. Model cost at 10× and 100× expected volume. Find the bottleneck (it is rarely the one you'd guess). Output: Phase 5 memo on operational economics.
- **Week 12 — Security, multi-tenancy, hostile inputs.** Threat model the full stack. Prompt-injection resistance, tenant isolation, handling adversarial tool outputs. Output: final runbook, a completed threat model, and a memo that closes the pathway.

After Week 12 you should have a deployed, authenticated, observable, multi-tenant MCP server with a real threat model, a load test, and an eval harness. Plus six memos and a decision log that could stand up to scrutiny in an exec review or technical interview.

## Before you start

`weeks/week-00-setup.md` is a 30-60 minute walkthrough covering:

- Node 20+, package manager, Claude Desktop install
- Anthropic API key with a spend cap set
- A Week 2 backend picked from a criteria-based menu (GitHub, Linear, Todoist, Trello, Notion, and others) with its credentials set up
- Workbook repo template-instantiation
- Smoke-test the scaffolds before Week 1

## Start here

1. Read `REPO-ARCHITECTURE.md` — the textbook/workbook split.
2. Read `PATHWAY.md` — one-page map of how the weeks compound. Worth 5 minutes before you commit to 12 weeks.
3. Work through `weeks/week-00-setup.md`.
4. Open `weeks/week-01.md`.

When you're drafting a memo, ADR, or iteration log and unsure of the shape, `templates/examples/` has worked examples for each artefact type.

## View as a local site

The repo includes an Astro Starlight site that presents the curriculum with a sidebar, dark mode, and local search (pagefind). Markdown in this repo stays authoritative — the site is a generated view over it.

```bash
cd docs-site
pnpm install      # or npm install
pnpm dev          # or npm run dev
```

Open <http://localhost:4321>. Build a static copy with `pnpm build` (output in `docs-site/dist/`). See `docs-site/README.md` for details.

### Publish on GitHub Pages

A workflow at `.github/workflows/pages.yml` builds and deploys the site on every push to `main`. One-time: in the repo's **Settings → Pages**, set **Source** to **"GitHub Actions"**. No config edits needed — the workflow injects site/base automatically for any fork.

## Licence

MIT. Fork, modify, teach from it. Attribution appreciated but not required.
