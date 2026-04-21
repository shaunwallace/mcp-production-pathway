---
title: Week 1 — Mental model (Phase 0)
---

# Week 1 — Mental model (Phase 0)

**Time budget:** 5 to 8 hours across two or three sittings.

## What you'll have by the end of the week

- A clear, unhyped mental model of what MCP is and what it isn't
- One memo in your workbook (`memos/00-why-mcp.md`) that you'd be willing to share with an exec team
- One ADR committed (`decisions/0001-sdk-and-backend-choice.md`) covering your choice of SDK and backend
- A `week-1-complete` git tag in your workbook

## Why this week exists

You will be tempted to skip the mental-model work and go straight to building. Don't. The M×N integration framing, the primitives (tools, resources, prompts, sampling, elicitation), and the honest view of what MCP is weak at are the reference frame you'll use to judge architectural decisions for the next eleven weeks. An hour reading the spec will save ten hours arguing about the wrong things.

## Reading list

Do these in order. Time estimates are honest; reduce them and you'll skim. Links verified against the canonical source at time of writing — if anything 404s, search for the title; these authors tend to keep stable URLs.

1. **The MCP specification, top to bottom.** (~2h) Not a blog post about the spec, the spec itself. Pay attention to lifecycle, capability negotiation, the message envelope, and the distinction between tools, resources, and prompts.
   → <https://modelcontextprotocol.io/specification>
2. **The JSON-RPC 2.0 specification.** (~30min) Short. The whole protocol sits on this.
   → <https://www.jsonrpc.org/specification>
3. **Anthropic's original MCP announcement** (Nov 2024). (~15min) For stated motivation and intent.
   → <https://www.anthropic.com/news/model-context-protocol>
4. **One critical piece on MCP's limits.** (~30min) Start with Simon Willison's `model-context-protocol` tag — he tracks the honest view of the protocol as it evolves. Pick one recent post that challenges a claim made in the spec or the announcement.
   → <https://simonwillison.net/tags/model-context-protocol/>
5. **Anthropic's "Building effective agents"** (Dec 2024). (~30min) Less about MCP specifically, more about the shape of tool-using systems. The tool-design sections become relevant in Week 2.
   → <https://www.anthropic.com/research/building-effective-agents>

Open a note in your workbook at `notes/week-01.md` as you read. Capture quotes, questions, and anything that surprised you. (See `REPO-ARCHITECTURE.md` — `weeks/` stays as read-only curriculum in your workbook; your working notes live in `notes/`.)

## Reflection questions (answer in your workbook)

Work through these in your notes. They're the input to the memo.

1. In one paragraph, what problem does MCP solve that function calling alone doesn't? Where is this claim weakest?
2. What are the five protocol primitives, and for each, what's the right use case?
3. What is the host-client-server split, and why does it matter that MCP clients are 1:1 with servers rather than shared?
4. Where does session state live? What happens when it's lost?
5. What are three things MCP is not? (Agent framework, skills system, and what else?)
6. What is the spec weakest on today? Discovery, versioning, long-running tasks, something else? What would you change?
7. For your context (your org, your product area, your role), what's the honest case for investing in MCP as a client, a server publisher, both, or neither? Be specific: if you work on a developer tool, your answer differs from a data platform or a B2B SaaS; name the specifics.

## Build output: the memo

Use the template at `templates/memo.md`. Commit to your workbook as `memos/00-why-mcp.md`. One page, 600-800 words — the ceiling in `templates/memo.md`. See `templates/examples/memo-example-a.md` and `memo-example-b.md` for two different defensible shapes at this length. Audience is your exec team or a board member.

The memo should answer:

- What MCP is, in one paragraph a non-technical executive can follow
- What MCP is not, explicitly naming three adjacent things it gets confused with
- What MCP is weak at, honestly
- Your recommendation: invest, watch, or ignore

Write the first draft on Friday or Saturday. Let it sit overnight. Edit once on Sunday. Ship it.

## ADR for this week

Write one lightweight ADR at `decisions/0001-sdk-and-backend-choice.md`. Covers:

- Which MCP SDK (TypeScript, assumed)
- Which backend you'll build tools against in Week 2 (see the menu in `weeks/week-00-setup.md` — if you have no strong preference, GitHub is a reasonable default)
- Which LLM provider for the harness (Anthropic recommended)
- Why each, and what would change your mind

Use `templates/adr.md`. Keep it under 500 words — enough to state each option considered, your decision, and what would change your mind. See `templates/examples/adr-example.md` for the shape.

## Cost expectation for the whole pathway

The harness hits the Anthropic API. Over the full 12 weeks, budget **roughly $20-50 in API spend** on the default Claude Sonnet-tier model, dominated by the eval runs in Weeks 3, 5, 9, and 11 (the regression suite grows and gets rerun each phase).

Set a monthly spend cap on your Anthropic key now — the console has one. It's the cheapest insurance against a runaway loop in your harness code. If you're using Opus, triple the estimate; if you're using Haiku, halve it.

If you'd prefer a harder cap: run eval weeks only once per phase rather than per iteration, and rely on the MCP Inspector for per-change smoke tests.

## What goes in your workbook this week

| Path | What |
|------|------|
| `notes/week-01.md` | Raw notes from reading |
| `progress.md` | One entry per session, using the template |
| `memos/00-why-mcp.md` | Your Phase 0 memo |
| `decisions/0001-sdk-and-backend-choice.md` | Your ADR |

## Worked examples — when you feel stuck

If you've drafted your memo or ADR and you're unsure whether it's the right shape, look at `templates/examples/`:

- `memo-example-a.md` — a canonical "why MCP" memo in one defensible shape
- `memo-example-b.md` — a different defensible shape for the same brief (prose-first vs decision-tree)
- `adr-example.md` — a filled ADR matching Week 1's SDK/backend decision

These are reference artefacts, not answer keys. The fact that there are two memo examples is intentional — you should develop your own shape that fits the audience you have in mind.

## Checkpoint — you've completed Week 1 when

- [ ] You can describe the five MCP primitives and when to use each, without referring to notes
- [ ] You can explain the difference between MCP and OpenAPI in one sentence
- [ ] `memos/00-why-mcp.md` is committed with all sections filled
- [ ] `decisions/0001-sdk-and-backend-choice.md` is committed
- [ ] `progress.md` has at least two entries
- [ ] You've tagged the commit: `git tag week-1-complete`

If any of these aren't done, don't start Week 2. The mental-model work compounds; the code-building work stalls without it.

## Leadership lens (for the memo's closing)

A VP or CPTO who conflates MCP with agent frameworks, skills systems, or governance layers will make expensive decisions. The memo is the artefact that proves you didn't. The harder skill it demonstrates is separating substrate from application: MCP is plumbing, not a product. The teams that treat it that way will compound; the teams that market it as AI magic will discover it's less than they sold.

## Optional rabbit holes (only if you have time)

- Read the JSON-RPC 1.0 spec and compare with 2.0. Instructive on what "small but opinionated" looks like.
- Look at an existing production MCP server (the `@modelcontextprotocol` servers GitHub org has examples). Don't copy, just observe naming conventions.
- Skim the OpenAI Agents SDK docs or LangGraph docs for the contrast. MCP is not the only way to think about this problem.
