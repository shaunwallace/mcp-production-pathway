---
title: "ADR example — SDK, backend, and LLM provider"
---

# ADR 0001: SDK, backend, and LLM provider for the pathway

**Status:** accepted  
**Date:** 2026-05-05  
**Phase:** 0

> **Note for readers of the worked example:** this ADR picks GitHub as the backend. A different learner could legitimately pick Linear, Notion, Todoist, or anything else on the Week 0 menu. The value of this example is the *shape* of the reasoning — stating criteria, considering options, naming what would change your mind — not the specific choice.

## Context

Starting the MCP Production Pathway. I need to pin three choices before Week 2: which MCP SDK, which backend to build tools against, and which LLM provider the harness targets. These choices compound — changing any of them mid-pathway costs 1-2 days.

## Options considered  
<br>

**MCP SDK**

1. **TypeScript SDK (`@modelcontextprotocol/sdk`)** — first-party, most mature, largest ecosystem. Strong match for my existing Node background.
2. **Python SDK** — first-party, broadly equivalent feature parity. Would mean context-switching my workbook from TS to Python; no clear upside.
3. **Rust / Go community SDKs** — interesting but less mature; not a fit for a learning pathway where I want the SDK to be boring.

**Backend**

1. **GitHub** — universal account ownership, stable well-documented API, real rate limits (5000 req/h for authenticated calls), and a primitive set (issues, comments, PRs, repos) that maps cleanly to 4-6 tools.
2. **Linear** — clean small API. Rejected because my workspace is shared with teammates and test pollution would be awkward.
3. **Notion** — good option but the internal-integration + share-page setup is an extra gotcha I don't need to take on for a first pass. Might revisit in a future pathway iteration.
4. **Todoist** — appealing because I use it daily, which means tool design pressure would be real. Rejected because the API surface is narrower than I'd like for exercising the "4-6 tools" constraint.
5. **My own Postgres** — maximum control, zero external dependency, but the lack of realistic API-shape friction (rate limits, pagination, partial failures) would make Week 2 less representative of production work.

**LLM provider for the harness**

1. **Anthropic (Claude)** — first-party for MCP; most up-to-date tool-use behaviour; well-documented SDK.
2. **OpenAI** — supports function calling, would require adapter code, doesn't change the pathway's lessons but adds friction.
3. **Local model via Ollama** — appealing on cost, but tool-use quality in smaller open models is not yet where production-representative evals need it to be.

## Decision

TypeScript SDK, GitHub backend, Anthropic as the LLM provider for the harness.

## Rationale
<br>

**SDK:** TypeScript is the path of least resistance. I'm fluent in it, the SDK is first-party with the widest example coverage, and the weeks ahead (OAuth, OTel, load test) will all have documented TypeScript patterns. The learning focus is the protocol and tool design, not the SDK; picking anything else would displace learning budget onto the wrong thing.

**Backend:** GitHub wins for a learning pathway. I already have an account; token setup is two minutes; the API has the right shape of friction (real rate limits I'll hit during Week 3 evals, pagination that forces me to think about tool response shape, actual 4xx error classes I haven't invented). The known risk: a reference GitHub MCP server already exists in `@modelcontextprotocol/servers`. I'm imposing a rule on myself not to open it until after Week 3 is tagged complete; the learning is in the design process, not the end artefact. If that discipline fails, I'll know because my tool names will read like someone else's.

**LLM provider:** Anthropic is first-party for MCP. The pathway is about production-representative work, and Claude currently has the best-documented tool-use behaviour among frontier models. If Anthropic's relative quality changes mid-pathway, the harness is small enough to port in an afternoon.

What would change my mind:

- If my GitHub test repo's API calls start rate-limiting in Week 3 evals in ways that force me to game the eval schedule, switch to a personal fine-grained token with higher headroom, or move to Linear.
- If Anthropic rotates the default model in a way that breaks tool-selection behaviour, pin the previous model ID rather than redesign tools.
- If a Python ecosystem becomes clearly superior for OTel (Week 9), consider a polyglot setup rather than switching everything.

## Consequences

- Week 2 work against GitHub means creating a personal access token with `repo` and `issues` scopes (not a classic token — fine-grained, scoped to one test repo). Token committed to `.env` only.
- I'll seed a personal test repo with 10-15 issues spanning bug/feature/question labels plus a few PRs and comments. Realistic enough to exercise tools, disposable enough that test pollution doesn't matter.
- The harness will hard-code `ANTHROPIC_API_KEY`; I'm fine with that through Phase 5. Phase 6 (multi-tenancy) may require rethinking if I add non-Anthropic targets.
- If I later want to publish the workbook, the GitHub repo can stay — it's already public-shaped. No sanitisation pass required.
