---
title: "Memo example B — Build, watch, or ignore?"
---

# MCP: build, watch, or ignore?

**Audience:** my CTO at [invented company — a mid-stage data platform]  
**Length target:** 1 page (~550 words)  
**Date:** 2026-05-12

This memo takes a different shape from `memo-example-a.md`: a decision-tree rather than prose. Same brief, different structure. Use the shape that serves your audience — a CTO who wants the answer in 90 seconds differs from an exec team that wants the reasoning.

---

## TL;DR

- **Decision:** build an MCP server this quarter. Defer the client role.
- **Cost:** ~1 senior eng for 6 weeks, plus on-call coverage thereafter.
- **Risk if we don't:** within 12 months, our customers will ask why they can't use our platform from inside Claude Desktop / Cursor / the next big host. We will be late to a cheap bet.

## Context

Our platform exposes ~40 REST endpoints. Our customers increasingly work inside AI coding assistants. The question is whether to publish an MCP server that exposes a curated subset of those endpoints to AI hosts.

## The decision tree

**Q1: Is MCP stable enough to build against?**
→ Yes. Spec has a versioning policy; TypeScript SDK is at v1.x with >200k weekly downloads; Anthropic, Block, Apollo, and others are publishing production servers.

**Q2: Do our customers want this?**
→ Signal-strength answer: inbound asks in Q1 2026 from three named customers. No hard demand yet, but a consistent leading indicator.

**Q3: Can we staff it without displacing the Q2 roadmap?**
→ Yes, if we scope the first server to 6-8 tools against the existing read API. Writes wait for a follow-up. One senior eng, 6 weeks.

**Q4: Is the downside bounded if MCP fades?**
→ Yes. The tool definitions are thin wrappers over existing endpoints. If MCP is replaced by something else in 24 months, we port the wrappers. Sunk cost ≈ 4 weeks of eng time.

**Q5: What about a client role — letting our platform use other MCP servers?**
→ Defer. Our platform is not an AI application host; the use case is thinner. Revisit when we ship our own AI features.

## What MCP is not (things we will get asked and need answers for)

1. **Not an agent framework.** MCP is the I/O format; the agent is still someone else's problem.
2. **Not a skills system.** Anthropic Skills and similar are application-layer; they may consume MCP underneath.
3. **Not a governance layer.** Data residency, rate limits, consent — those live in our host integration and our API gateway, not in MCP.

## What MCP is weak on

- **Discovery.** There's no registry. We'll need to publish setup instructions for each host client.
- **Long-running operations.** Progress notifications exist; durable state does not. Our longer-running tools will need server-side job tracking.
- **Versioning of tool contracts.** If we rename a tool, existing agent sessions break. We'll need a deprecation policy.

## What I'd say in a design review

The expensive mistake isn't building the server; it's waiting to see if MCP "wins." By the time that's decided, the customer expectation will already be set. Build the server, scope it tight, and treat it as a bet with known downside.

## What I changed my mind on

I entered this week expecting to recommend "watch." The MCP Inspector changed my mind: the time from spec-read to working tool was under two days. If the barrier to entry is that low, "watch" is just a way of being late.
