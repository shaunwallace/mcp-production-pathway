---
title: Leader Fast Track
description: A 5-chapter, ~5-hour distillation of the 12-week MCP pathway for senior engineering leaders.
---

# Leader Fast Track

A 5-chapter, ~5-hour distillation of the 12-week MCP pathway for senior engineering leaders — CTO, VP Eng, Head of, Director.

If you have engineers about to go through the full 12-week track and you want to brief yourself first, this is the right starting point. It's standalone: read only this and you'll have a working mental model of MCP, the risk surface, and what production-grade looks like.

Pure consumption. No exercises, no artefacts to produce.

## Chapters

1. [What MCP is, and what it changes](01-why-mcp-exists.md) — the honest version of the problem, what it opens up for your organisation, and how it relates to A2A and the alternatives
2. [The mental model](02-mental-model.md) — host, client, server, and why tool names are the API
3. [Architecture in depth](03-architecture-in-depth.md) — transports, topologies, and tool design
4. [The risk surface](04-risk-surface.md) — prompt injection, auth, exfiltration, STRIDE for MCP
5. [Making it reliable](05-making-it-reliable.md) — evals, observability, cost, versioning

## A recurring example

Every chapter grounds itself in **Marlin**, a fictional mid-market RevOps SaaS. Marlin sells pipeline analytics and forecast tooling to B2B sales orgs and integrates with Salesforce, HubSpot, Slack, Gong, and Snowflake. It's a useful teaching vehicle precisely because its problems — multi-system integration, multi-tenancy, materially-sensitive data — are unglamorously typical.

## Reading conventions

- Code snippets are marked **Optional — copy-paste to run**. You don't need to run them.
- Diagrams are inline Mermaid where structural. Each chapter also has 2–3 hero-illustration **prompts** in [`visual-prompts/`](visual-prompts/) — feed these to a high-fidelity image-generation model or hand them to a designer to produce polished SVGs. Generated outputs land in `assets/`.

## After this

If you want to go deeper or hand work to your team, the [12-week pathway](../README.md) is the practitioner-grade track that this distils.
