---
title: Week 1 — Mental model (Phase 0)
---

# Week 1 — Mental model (Phase 0)

**Time budget:** 4 to 6 hours across two sittings.

## What you'll have by the end of the week

- A clear, unhyped mental model of what MCP is and what it isn't
- One memo in your workbook (`memos/00-why-mcp.md`) that you'd be willing to share with an exec team
- One ADR committed (`decisions/0001-sdk-and-backend-choice.md`) covering your choice of SDK and backend
- A `week-1-complete` git tag in your workbook

## Why this week exists

You will be tempted to skip the mental-model work and go straight to building. Don't. The M×N integration framing, the primitives (tools, resources, prompts, sampling, elicitation), and the honest view of what MCP is weak at are the reference frame you'll use to judge architectural decisions for the next eleven weeks. An hour reading the spec will save ten hours arguing about the wrong things.

## Reading list

Do these in order. Time estimates are honest; reduce them and you'll skim.

1. **The MCP specification, top to bottom.** (~2h) Not a blog post about the spec, the spec itself. Pay attention to lifecycle, capability negotiation, the message envelope, and the distinction between tools, resources, prompts, sampling, and elicitation.
   → <https://modelcontextprotocol.io/specification>
2. **The JSON-RPC 2.0 specification.** (~30min) Short. The whole protocol sits on this.
   → <https://www.jsonrpc.org/specification>
3. **Anthropic's original MCP announcement** (Nov 2024). (~15min) For stated motivation and intent.
   → <https://www.anthropic.com/news/model-context-protocol>
4. **One critical piece on MCP's limits.** (~30min) Simon Willison's `model-context-protocol` tag tracks the honest view as the protocol evolves. Pick one recent post that challenges a claim made in the spec or the announcement.
   → <https://simonwillison.net/tags/model-context-protocol/>
5. **Anthropic's "Building effective agents"** (Dec 2024). (~30min) Less about MCP specifically, more about the shape of tool-using systems. The tool-design sections become relevant in Week 2.
   → <https://www.anthropic.com/research/building-effective-agents>

Open a note at `notes/week-01.md` in your workbook as you read. Capture quotes, questions, and anything that surprised you.

## Grounding: the smallest possible MCP server

Before you write the memo, look at a minimum viable MCP server end-to-end. Not to implement — to give the abstractions from the spec a concrete shape. This is roughly what Week 2 starts from, stripped to the bone:

```ts
// server.ts — ~15 lines, for orientation only
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

const server = new Server({ name: "hello", version: "0.0.1" }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [{ name: "ping", description: "Returns pong. Use to check the server is alive.", inputSchema: { type: "object", properties: {} } }]
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => ({
  content: [{ type: "text", text: req.params.name === "ping" ? "pong" : "unknown tool" }]
}));

await server.connect(new StdioServerTransport());
```

Things to notice, which map back to the spec:

- **Transport** is pluggable (`StdioServerTransport`). You'll swap it for HTTP in Week 4 without touching the handlers.
- **Capabilities** (`{ tools: {} }`) are declared up front. The client decides what to use based on what you advertise. Resources, prompts, sampling, elicitation are declared the same way.
- **Handlers are request/response.** No framework magic. This is JSON-RPC underneath.
- **The tool description is a prompt for the model.** "Use to check the server is alive" is written for Claude to read, not a human. Week 2 spends a lot of time on this.

This sample isn't something you run today — it lives in the Week 2 scaffold. The point is you've now seen the shape the spec describes and can read the rest of the reading list with that concrete frame in mind.

## Build output: the memo

Use the template at `templates/memo.md`. Commit to your workbook as `memos/00-why-mcp.md`. One page, 600-800 words — the ceiling in `templates/memo.md`. See `templates/examples/memo-example-a.md` and `memo-example-b.md` for two different defensible shapes at this length. Audience is your exec team or a board member.

The memo should answer:

- What MCP is, in one paragraph a non-technical executive can follow
- What MCP is not, explicitly naming three adjacent things it gets confused with (agent frameworks, skills systems, governance layers — pick three)
- What MCP is weak at, honestly (discovery, versioning, long-running tasks — pick the ones that matter for your context)
- Your recommendation, grounded in your context: invest as a server publisher, invest as a client consumer, watch, or ignore. Be specific about why. A developer-tools company's answer differs from a data platform's or a B2B SaaS's; name the specifics.

Write the first draft, sleep on it once, edit, ship.

This is the Phase 0 memo — one of only three memos in the pathway (the others land at Phase 3 and Phase 6). Keep it sharp.

## ADR for this week

Write one lightweight ADR at `decisions/0001-sdk-and-backend-choice.md`. Covers:

- Which MCP SDK (TypeScript, assumed)
- Which backend you'll build tools against in Week 2 (see the menu in `weeks/week-00-setup.md` — if you have no strong preference, GitHub is a reasonable default)
- Which LLM provider for the harness (Anthropic recommended)
- Why each, and what would change your mind

Use `templates/adr.md`. Keep it under 500 words. See `templates/examples/adr-example.md` for the shape.

## Cost expectation for the whole pathway

The harness hits the Anthropic API. Over the full 12 weeks, budget **roughly $20-50 in API spend** on Claude Sonnet-tier, dominated by eval reruns in Weeks 3, 9, and 11.

Set a monthly spend cap on your Anthropic key now — the console has one. It's the cheapest insurance against a runaway loop in your harness code. If you're using Opus, triple the estimate; if you're using Haiku, halve it.

Cloud deployment in Week 8 is an optional extension. Running Cloud Run's free tier for the whole pathway is typically under $5; you can also complete every week with zero cloud spend by staying on the local Docker track.

## What goes in your workbook this week

| Path | What |
|------|------|
| `notes/week-01.md` | Raw notes from reading |
| `progress.md` | One entry per session, using the template |
| `memos/00-why-mcp.md` | Your Phase 0 memo |
| `decisions/0001-sdk-and-backend-choice.md` | Your ADR |

## Worked examples — when you feel stuck

If you've drafted your memo or ADR and are unsure whether it's the right shape, look at `templates/examples/`:

- `memo-example-a.md` — a canonical "why MCP" memo in one defensible shape
- `memo-example-b.md` — a different defensible shape for the same brief (prose-first vs decision-tree)
- `adr-example.md` — a filled ADR matching Week 1's SDK/backend decision

These are reference artefacts, not answer keys. Two memo examples is intentional — develop your own shape.

## Checkpoint — you've completed Week 1 when

- [ ] You can describe the five MCP primitives and when to use each, without referring to notes
- [ ] You can explain the difference between MCP and OpenAPI in one sentence
- [ ] `memos/00-why-mcp.md` is committed with all sections filled
- [ ] `decisions/0001-sdk-and-backend-choice.md` is committed
- [ ] `progress.md` has at least two entries
- [ ] You've tagged the commit: `git tag week-1-complete`

If any of these aren't done, don't start Week 2. The mental-model work compounds; the code-building work stalls without it.

## Leadership lens

A VP or CPTO who conflates MCP with agent frameworks or skills systems will make expensive decisions. The memo is the artefact that proves you didn't — MCP is plumbing, not a product. Teams that treat it that way will compound; teams that market it as AI magic will discover it's less than they sold.

## Optional rabbit holes

- Read the JSON-RPC 1.0 spec and compare with 2.0. Instructive on what "small but opinionated" looks like.
- Look at an existing production MCP server (`@modelcontextprotocol/servers`). Don't copy, just observe naming conventions.
- Skim the OpenAI Agents SDK or LangGraph docs for contrast. MCP is not the only way to think about this problem.
