---
title: 1 — What MCP is, and what it changes
description: An honest framing of the problem MCP solves, what it opens up for an engineering organisation, and how it relates to A2A and the alternatives.
---

# 1 — What MCP is, and what it changes

> An honest framing of the problem MCP solves, the capabilities it opens up for an engineering organisation, and how it sits next to the alternatives.
>
> ~50 min. By the end you should be able to explain to a peer — without overclaiming — what MCP is, what it isn't, why it matters specifically for agentic work over your own data, and how it relates to A2A, function calling, and bespoke integration.

## The honest version of the problem

Strip away the marketing. The gap MCP fills is narrower than "AI integration is hard."

The actual gap is this: every LLM-driven runtime — Claude Desktop, an internal agent loop, Cursor, a customer-support copilot — needs to **discover what tools and data are available, read their schemas, invoke them with appropriate arguments, and consume the results in a structured way the model can act on**. There was no standard for that. So every team built it again. Different discovery formats. Different invocation conventions. Different ways of expressing "this is a resource you can read" versus "this is a tool you can call" versus "this is a prompt template you can fill."

This is a small, well-scoped problem. The Model Context Protocol — released by Anthropic in late 2024, open-spec from day one — solves it. It does not solve API design, upstream auth, schema drift in your warehouse, or any of the other genuinely hard parts of integration. Those remain hard.

What MCP gives you is **one consistent shape for the LLM host ↔ capability boundary**, which is the boundary that previously had no shape at all.

If you understand MCP as "LSP, but for LLM hosts," you've got it. If you describe it as "USB for AI" — which you will see in vendor decks — you're overclaiming. USB defined power, signalling, and physical layer. MCP is a JSON-RPC protocol over stdio or HTTP for exchanging tools, resources, and prompts. The analogy with LSP is shape, not scope: a defined protocol that lets N hosts talk to M servers without N×M bespoke wiring.

That's the technical claim. The rest of this chapter is about what changes in your organisation when you take it seriously.

## Marlin: the org we'll keep coming back to

**Marlin** is a fictional mid-market RevOps SaaS. ~250 engineers, ~$80M ARR. They sell pipeline analytics and forecast tooling to B2B sales orgs. They integrate with Salesforce, HubSpot, Slack, Gong, and Snowflake. They have three AI features in flight — a deal summariser, a forecast Q&A bot, a pipeline-hygiene assistant — each currently being built by a different team, each writing its own Salesforce client, each handling auth and rate-limiting differently and with varying competence.

Marlin's situation is unglamorously typical. We'll use them across all five chapters as the unit of analysis.

## What MCP changes for your engineering organisation

Three things, all narrower and more practical than "platform transformation":

### 1. The ownership shape of integration work changes

Today, when Marlin's deal-summariser team needs Salesforce data, they write a Salesforce client inside the deal-summariser codebase. Marlin's forecast-bot team does the same, separately. The Salesforce integration is *bound to the agent that needed it*, owned by whichever feature team got there first, and re-implemented by every subsequent team that needs the same data.

After MCP, Marlin's data platform team can publish a Salesforce MCP server once. Every internal agent — current and future — consumes it. The integration becomes a **standalone capability** with its own owner, its own on-call, its own version lifecycle, its own SLOs.

```mermaid
flowchart LR
  subgraph "Today: agent-coupled integration"
    A1["Deal summariser team"] -.owns.-> SF1["SF client (theirs)"]
    A2["Forecast bot team"] -.owns.-> SF2["SF client (theirs)"]
    A3["Hygiene team"] -.owns.-> SF3["SF client (theirs)"]
  end
  subgraph "With MCP: capability-owned integration"
    DP["Data platform team"] -.owns.-> M["Salesforce MCP server"]
    B1["Deal summariser"] --> M
    B2["Forecast bot"] --> M
    B3["Hygiene assistant"] --> M
  end
```

This is mostly a re-org of who owns what. It is the right re-org, because integration logic ends up in the team that should have always owned it, with the disciplines (rate-limit handling, retry policy, audit logging, credential rotation) that integration teams are already good at and that feature teams systematically aren't.

### 2. The line between "internal platform" and "developer experience" softens

Once Marlin has an internal MCP server for the warehouse, the incident management system, the feature flag service — every engineer's local Claude Desktop and Cursor can connect to them. The "internal AI assistant" stops being a project. It becomes an emergent property of your servers existing and your engineers pointing their hosts at them.

The practical consequence: a capability you ship for internal agents is **automatically available to humans-with-agents**. The same Salesforce MCP server that powers the deal summariser also lets an account exec ask Claude Desktop "show me every deal that's slipped twice this quarter and the reps who own them." No new code. No new product. Same server.

This collapses the distinction between "tools we build for our agents" and "tools we build for our people." That distinction was always somewhat artificial; MCP makes the artificiality structural rather than philosophical.

### 3. Your customers can bring their own agents to your product

This is the most consequential change and the most uncomfortable to think about clearly.

If Marlin publishes MCP servers that customers can authenticate against, Marlin's product gains a new consumption mode: **customers' own agents calling Marlin's capabilities directly**, without Marlin building a chat UI for them. A customer's revenue-ops analyst, sitting in their own Claude Desktop or internal agent platform, can ask questions of Marlin's data and get structured answers back, with Marlin's permission model still enforcing what they can see.

This is the first material change in the SaaS consumption model since the API economy of the early 2010s. It deserves the seriousness that change implied, including the strategic discomfort: if your product becomes a tool that someone else's agent calls, the relationship with the end user is mediated by an agent you do not control. That is worth a real conversation with your product organisation. It is not something to celebrate uncritically, and it is not something to ignore.

## What this opens up: agentic work over your own data

If there is one near-term capability MCP unlocks that justifies the whole investment, it is **agentic data exploration** — the work analysts, operators, and engineers do when they're forming hypotheses, asking follow-up questions, joining disparate sources, and refining as they go.

The pre-MCP version of this work: an analyst writes SQL, exports CSVs, joins them in a notebook, asks the data team for a column they don't have, waits two days, repeats. Or they use a BI tool, which constrains them to its semantic model and assumes they already know the question.

The MCP-enabled version: the analyst asks an agent. The agent has MCP servers for the warehouse, the semantic layer, the ticketing system, the internal documentation, and the dashboarding tool. It can roam.

```mermaid
flowchart TB
  Q["Analyst: 'Why did EMEA bookings miss in Q3?'"]
  A["Agent loop"]
  W["Warehouse MCP server"]
  S["Semantic layer MCP server"]
  D["Internal docs MCP server"]
  T["Ticketing MCP server"]
  Q --> A
  A <--> W
  A <--> S
  A <--> D
  A <--> T
  A --> R["Synthesised answer + citations + filed ticket for missing dimension"]
```

In a single session that loop can:

- query the warehouse for the bookings shortfall,
- look up a metric definition in the semantic layer because it didn't recognise a column,
- read the ADR explaining why two tables look like duplicates but aren't,
- find the deal-review Slack channel where reps discussed the slipping deals,
- file a ticket for a missing pipeline-stage dimension when it hits a real data gap,
- and present the analyst with a synthesised answer they can verify.

That loop — query, refine, look up context, refine again — is what *exploration* actually is, and it is the part that BI tools structurally could not do because they assumed the question was already known. Agents with composable tool access can do it because the loop matches how an agent already works internally.

> **Hero illustration available.** A higher-fidelity rendering of this exploration loop — with numbered iteration markers, annotated steps across the four MCP servers, and the synthesised output including a filed ticket — can be produced from the prompt at [`visual-prompts/01-agentic-exploration-loop.md`](visual-prompts/01-agentic-exploration-loop.md). Two further chapter-1 prompts cover the integration-tax collapse ([`01-integration-tax-before-after.md`](visual-prompts/01-integration-tax-before-after.md)) and the customer-brings-own-agent network effect ([`01-protocol-network-effect.md`](visual-prompts/01-protocol-network-effect.md)).

This is not a thought experiment. It is the single highest-ROI use case most SaaS engineering organisations will see in the next twelve months, because the underlying capabilities (warehouse, semantic layer, docs, ticketing) already exist in most companies. Only the wiring is missing — and the wiring is what MCP standardises.

For Marlin specifically: their forecast-quality problem isn't that the forecast model is wrong. It is that pipeline data is messy in ways nobody has time to investigate end-to-end. An agent that can roam Salesforce, Gong call transcripts, deal-review Slack channels, and historical forecast accuracy metrics — refining its hypothesis as it goes — is the first credible answer to "why do our forecasts miss?" that doesn't require an analyst-week per investigation.

## A small concrete example, if you want one

You don't need to read this to follow the chapter. It's here so the shape of an MCP tool is concrete rather than abstract.

> **Optional — copy-paste to run.** What this proves: the unit of work in MCP is small. A tool is a name, a description, a schema, and a handler. The description is *not documentation* — it is read by the model when deciding whether to call the tool, which makes tool naming and tool descriptions a load-bearing part of the API. We come back to why in chapter 2.
>
> ```ts
> {
>   name: "search_deals",
>   description: "Use this when the user asks about deals, opportunities, or pipeline. Returns up to 25 matching Salesforce opportunities by name, account, or stage.",
>   inputSchema: {
>     type: "object",
>     properties: {
>       query: { type: "string" },
>       limit: { type: "number", default: 10 }
>     },
>     required: ["query"]
>   }
> }
> ```

## What MCP doesn't change

A short list, because honest framing requires it:

- **It does not make your APIs better.** A badly designed API wrapped in an MCP server is still a badly designed API. The model will struggle with it in much the same way humans do.
- **It does not solve auth.** You still need per-tenant credentials, token rotation, audit trails, scope enforcement. MCP gives you transport and discovery; you bring the security model. Chapter 4 is dedicated to this and is not optional.
- **It does not make agents reliable.** An MCP server with great tools, called by an agent with a poor system prompt and no evals, will still produce embarrassing outputs in front of customers. Chapter 5 covers what reliability work looks like.
- **It does not replace your data platform team.** It changes their *interface to the rest of the company*; it does not change their job.

## Alternatives, and how to think about them

MCP is not the only protocol in this space. Engineering leaders should be able to explain how it sits next to the others without falling into either "MCP wins" tribalism or "wait for a better one" paralysis.

**A2A (Agent-to-Agent), Google.**
A2A defines how *agents talk to other agents* — task delegation, capability advertisement, coordination across multi-agent systems. MCP defines how *one agent talks to tools and resources*. They sit at different layers and are **complementary, not competitive**. A realistic near-future architecture has agents using A2A to delegate work to specialised agents that themselves use MCP to call tools. If your organisation is choosing one to invest in this year, MCP is the right one — agent-to-tool integration is the bottleneck most organisations hit first; multi-agent coordination is the bottleneck they hit second, after the first is solved.

**OpenAI function calling, Anthropic tool use, and other per-vendor formats.**
These are schemas for describing tools to one model family. They work, and they continue to work. The cost is portability: a tool defined for one vendor's format is not consumable by another vendor's host without re-wrapping. MCP defines a host-neutral format — implement an MCP server once and it works across compliant hosts. The inverse requires N adapters per tool. If you have one model and one host, vendor-native formats are fine. If you might ever have two, MCP starts paying for itself quickly.

**LangChain tools and other in-framework abstractions.**
In-process, framework-coupled. Useful for prototyping; they don't survive the lifetime of a framework version and they don't cross process boundaries. If your tool is a function in your agent's codebase, it's a framework tool. If your tool is a server that any compliant host can connect to, it's an MCP tool. The latter is what platform-grade integration looks like; the former is what a proof-of-concept looks like.

**OpenAPI / REST APIs.**
The thing MCP servers usually wrap. OpenAPI describes APIs; MCP describes how an LLM host should consume them. Not in conflict — a common pattern is to generate an MCP server from an OpenAPI spec. The protocol layer is agent-aware in ways the API layer isn't, and shouldn't need to be.

**No protocol — bespoke integration per agent.**
Still defensible if you're integrating one agent with one upstream and you will never need a second of either. Most organisations don't get to stay in that posture for long, and the bespoke code you write today gets thrown away when the second agent arrives. With MCP, the *clients* may evolve while your *servers* persist.

## What to take from this chapter

The honest framing, in five lines:

- MCP is a narrow, well-scoped protocol that fills a real gap: the LLM host ↔ capability boundary.
- It changes the *ownership shape* of integration work inside your organisation, makes internal capabilities reusable across both human and agent consumers, and opens a new external consumption mode in which customers' own agents call your product directly.
- Its highest-leverage near-term use case is agentic work over your own data — exploration loops that BI tools structurally could not do.
- It is **complementary** to A2A, not a substitute. It supersedes per-vendor function-calling formats only if cross-host portability matters to you, which it usually does.
- It does not solve auth, API design, agent reliability, or any of the genuinely hard problems. Those problems are the rest of this track.

Chapter 2 takes the host/client/server model and gives it teeth — what each piece actually is, how a request flows end to end, and the single design decision (tool naming) that disproportionately determines whether your agents work in production.

---

→ Next: [The mental model](02-mental-model.md)
