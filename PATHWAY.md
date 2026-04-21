---
title: Pathway map
description: One-page overview of how the 12-week pathway fits together.
---

# Pathway map

One-page overview of how the 12-week pathway fits together: what each week produces, and which artefacts feed which later weeks. If you're tempted to skip a week, read this first — most weeks have downstream dependencies, and the gaps show up as stalls two or three phases later.

## Release cadence

The pathway is released iteratively as modules, not all up-front. Weeks 1-3 (Phase 0-1) are live now. Weeks 4-12 are outlined in `README.md` and will be published as they're written. The structure is stable — what ships is the depth inside each week.

## The spine

```
  PHASE 0        PHASE 1              PHASE 2         PHASE 3        PHASE 4         PHASE 5              PHASE 6
  Mental model   Build + measure      Protocol        Identity       Deploy          Observability        Security
  Wk 1           Wk 2-3               Wk 4-5          Wk 6-7         Wk 8-9          Wk 10-11             Wk 12
```

Each phase closes with a memo in `memos/` (01-tool-design, 02-transports, …). Each architectural decision gets an ADR in `decisions/`. The progress log in `progress.md` is append-only across all weeks.

## Artefact dependency chain

This is where skipping hurts. Each arrow is a dependency: the right-hand artefact cannot exist without the left-hand one.

```
Week 1 memo (00-why-mcp)
  ├─ revisited and annotated in Week 6 (after you've built OAuth and see
  │  which of your Week-1 claims held up)
  └─ revisited again in Week 12 (security lens on the original recommendation)

Week 2 tool definitions
  ├─ subjected to eval in Week 3 (pass/fail drives iteration)
  └─ ported to HTTP transport in Week 4 (same tools, new plumbing)

Week 2 instrument() wrapper
  └─ replaced by OpenTelemetry spans in Week 9 (same shape, new backend)

Week 2 harness
  ├─ eval mode added in Week 3
  ├─ HTTP transport added in Week 4
  ├─ reconnect behaviour instrumented in Week 5
  ├─ OAuth client added in Week 7
  ├─ concurrency and load in Week 11
  └─ adversarial prompts in Week 12

Week 3 eval dataset (phase-1-tool-selection.jsonl)
  ├─ rerun as regression guard in Week 5 (did HTTP break selection?)
  ├─ rerun under load in Week 9 (do spans show the same pass rate?)
  ├─ extended with latency assertions in Week 10
  └─ extended with adversarial prompts in Week 12

Week 4-5 HTTP transport + session layer
  ├─ the deployment target in Week 8 (stdio doesn't deploy)
  ├─ OAuth flows run over it in Week 6-7
  ├─ span boundaries for Week 9's tracing
  ├─ concurrent-session load tests in Week 11
  └─ session hijack and replay in the Week 12 threat model

Week 6-7 OAuth integration
  ├─ deployed behind auth in Week 8
  ├─ authenticated calls traced in Week 9
  ├─ per-tenant cost attribution in Week 10
  └─ tenant isolation scrutinised in Week 12

Week 8 SLOs
  ├─ Week 9's tracing measures adherence to them
  └─ the numbers Week 11's load test has to defend

Week 9 OTel spans
  ├─ cost attribution reads them in Week 10
  └─ bottleneck evidence for Week 11's load tests
```

## What compounds

Four artefacts carry the most weight across the whole pathway. If you treat anything as load-bearing, treat these:

1. **The eval dataset** (built Week 3, extended every subsequent phase). This is the regression guard for everything. A team that ships MCP without this will find their reliability problem in production; a team that has this can change transports, migrate clouds, or rotate models and catch regressions in minutes.

2. **The memos** (one per phase, six total). Individually they're one-page opinions. Collectively they're a progression record — a reader can see how your thinking changed as you encountered real constraints. This is the artefact that has interview and exec-review value.

3. **The ADRs** (one per architectural choice). The log becomes a defensible record of decision-making. The habit is more valuable than any individual ADR.

4. **The harness** (built Week 2, extended every week). It's the single piece of infrastructure that tells you what actually happens when a real LLM uses your server. Keep it under 300 lines forever; if it starts to feel like an agent framework, cut.

## If you're short on time

You can get real value from a partial pathway, but not from any partial pathway. Priority order for a time-constrained learner:

1. **Weeks 1-3** (mental model, first server, evals). Even alone, this is more than most production MCP teams have done. Tag `phase-1-complete` and stop here if you need to; the rest is still reachable later.
2. **Weeks 6-7** (OAuth) and **Weeks 8-9** (deploy + OTel). The production readiness spine. Skipping either leaves you with a toy.
3. **Week 12** (security). Even a 2-hour threat-model pass is worth far more than zero.
4. **Weeks 4-5** (protocol internals) and **Weeks 10-11** (cost + load). Important, but recoverable later if you know the Phase-1 and Phase-3/4 material cold.

## When the pathway fails you

It will. You'll hit a backend edge case, a model rotation, a library version change, or a concept that doesn't click. Three places to go:

- **The spec** is always the authority: <https://modelcontextprotocol.io/specification>
- **MCP GitHub Discussions** for protocol-level questions: <https://github.com/orgs/modelcontextprotocol/discussions>
- **Your own memos and ADRs** — re-read them; often the blocker is a constraint you articulated two phases ago and then forgot.

If the pathway itself is wrong, open an issue against the public repo. It's a living document.
