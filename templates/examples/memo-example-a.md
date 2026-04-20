# Why MCP is plumbing, not product

**Audience:** my exec team at [invented company — a B2B developer tooling startup]
**Length target:** 1 page (~650 words)
**Date:** 2026-05-12

## TL;DR

- MCP is a small, honest protocol that replaces the N×M integration mess between AI applications and the tools they use. It is plumbing.
- The industry is conflating MCP with three adjacent things — agent frameworks, skills systems, and governance layers — and will spend 2026 relearning the distinction.
- We should invest as a server publisher (our developer audience wants to connect our product to Claude, Cursor, and whatever comes next), and invest cautiously as a client. Both start within one quarter; the client bet waits until our API coverage is wider.

## Context

You've been asked more than once whether we should "support MCP." I spent two weeks with the spec and a working server to answer that properly. This memo is the version I'd say in a board meeting.

## Argument

The integration problem MCP addresses is real and quite old. Every new AI application has faced a choice between writing a bespoke integration to every backend (expensive) or shipping without one (useless). MCP's insight is narrow: standardise the wire format between AI applications and backend tools, and let the application and the backend each implement one end. An AI IDE speaks MCP to a GitHub server, a Notion server, our server. An AI analytics product reuses the same GitHub server. The N×M cost becomes N+M. This is not AI magic; it is the same refactoring that gave us JDBC, ODBC, and LSP.

The thing MCP is not, which is where I see the most confusion, is an agent framework. MCP defines message shapes for tool invocation, resource fetching, prompt templating, and a few utility flows. It does not define how the agent plans, how it selects tools, how it recovers from errors, how it talks to a user, or how it composes multi-step work. That is the application's problem. Teams that buy MCP expecting an agent framework will be disappointed; teams that treat it as the I/O layer of their agent framework will be productive.

The second confusion is with "skills" systems — the Anthropic and OpenAI efforts to package agent capabilities. Skills are application-layer abstractions that may use MCP underneath; MCP is not itself a skills system. The third is with governance and policy layers: MCP does not enforce data residency, rate limits, or consent; the host application does. These are load-bearing features of any production deployment, which MCP delegates.

MCP is weak today on three fronts: discovery (there is no registry, so clients rely on configuration), versioning (the spec is moving quickly and backward compatibility is not yet a priority), and long-running operations (the protocol handles streaming progress but does not define retry, idempotency, or durable state — each server reinvents these). These are solvable and are being worked on; a team betting heavily on MCP today should track them.

For us specifically: we ship developer tooling. Our customers increasingly run our product inside Claude Desktop and Cursor. They want to query us from inside those tools, not bounce to our dashboard. A server is the right first bet. A client — letting *our* product use other MCP servers — is a harder call. Our API surface is small; customers don't yet expect us to integrate to their whole tool estate. I'd revisit in Q3.

## What I'd say in a design review

MCP is to AI applications what LSP was to IDEs: an unglamorous standard that quietly eats the integration problem. Build the server now. The cost of being wrong is small; the cost of being late is structural.

## What I changed my mind on

Coming into this I assumed MCP was over-hyped and would lose relevance within two years as frontier-model providers built richer native tool-use. I now think that's wrong — not because the hype is right, but because the problem MCP solves sits beneath the models, not alongside them. Richer tool-use in Claude or GPT doesn't eliminate the need for a shared format between applications and backends. It increases it.
