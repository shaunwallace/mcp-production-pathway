---
title: Executive Brief — MCP for CEOs, CFOs, and Sales Leaders
description: A non-technical 20-minute brief on what the Model Context Protocol is, why it matters commercially, and the questions to ask your engineering org.
---

# Executive Brief — MCP for CEOs, CFOs, and Sales Leaders

A 20-minute, non-technical companion to the Leader Fast Track. If the rest of the fast track is for the engineering leader who will *build* with MCP, this page is for the executives who need to **fund, govern, position, or sell around** AI work that uses it.

You will not be writing code. You will be making investment, risk, and go-to-market decisions, and you will be in rooms where engineers, vendors, and customers casually drop the term "MCP." This brief gives you enough to be a useful participant in those conversations without overclaiming.

## The one-paragraph version

The **Model Context Protocol** (MCP) is an open standard, [released by Anthropic in late 2024](https://www.anthropic.com/news/model-context-protocol), for how AI assistants connect to the systems where your business actually runs — CRM, data warehouse, ticketing, internal documents. Before MCP, every connection was bespoke work, repeated by every team that needed it. After MCP, you build each one once and every MCP-capable tool in the company can use it. The protocol standardises how AI tools *connect* to systems — not model behaviour, not safety, not orchestration. Those remain the genuinely hard parts. Everything below is implications.

## Three analogies, in three different registers

Pick whichever lands for the audience you're talking to. They make the same point in three different domains so that at least one will stick.

![Three side-by-side panels (A, B, C). Each panel has a "before" on top, where many items connect via crisscrossing lines, and an "after" below, where the same items connect through one shared module. Panel A: cargo (sacks, barrels, crates) to transport (truck, train, ship), unified by an ISO container; caption "The cargo doesn't change. The interface does." Panel B: appliances (lamp, kettle, computer) to walls (US, EU, UK), unified by a standard plug; caption "The wall and the appliance stop caring about each other." Panel C: applications (App 1, 2, 3) to databases (DB-A, B, C), unified by an ODBC/JDBC layer.](assets/exec-01-three-analogies.svg)

*The same point made three ways. Replacing point-to-point connections with one shared interface collapses the number of integrations you have to build and maintain. MCP plays this role for AI assistants and your business systems — it changes how they connect, not what either side does.*

### 1. Shipping containers

Before standardised containers, every cargo type had its own loading methods, trucks, and cranes. Containerisation didn't change what was being shipped — it changed the cost and reliability of moving it. MCP plays the same role for AI integrations: the goods don't change, the interface between them does.

### 2. A power socket in a hotel

Every appliance used to need a custom adapter for every wall. Once the socket is standard, the hotel doesn't care what you plug in, and the appliance doesn't care which hotel you're in. MCP standardises the socket between AI tools and your business systems.

### 3. ODBC/JDBC for AI

The closest enterprise analogy. Before ODBC and JDBC, every application needed bespoke wiring to talk to every database. After, the same application could speak to dozens of backends through one interface. MCP serves the same role for AI: instead of every AI assistant needing custom logic for every tool or data source, MCP defines a common pattern for exposing tools and context to AI clients.

If a vendor tells you MCP is "USB-C for AI," that is acceptable shorthand — provided everyone in the room understands MCP standardises *how AI systems expose and consume tools and context*, not how intelligent behaviour itself works.

## Why this matters commercially

Three implications, all reasonably concrete.

### 1. AI features get cheaper to build, and the cost curve bends

![Two-line chart. X-axis: number of AI features shipped, 1 to 8. Y-axis: marginal cost to ship the next feature (illustrative, units omitted). The dashed black "Without MCP" line is roughly flat, drifting slightly upward across feature count. The solid red "With MCP" line starts higher than the dashed line at feature 1 (annotated: "Feature 1 with MCP costs more — server, auth, observability, governance. The bend earns it back."), crosses the dashed line at feature 3 (labelled "Breakeven"), drops sharply through features 4–6, and flattens near zero by feature 8. The vertical gap between the two lines around feature 6 is annotated: "This gap is the standardisation dividend. ≈5–10× cheaper by feature 6." A side panel titled "On a systems-integrated axis" shows two curves: cost without MCP scales as M × N (steep); with MCP scales as M + N (linear). A "What changes" box lists three points: integrations become reusable (one MCP server, many features); new systems are additive, not multiplicative; vendor switching cost falls as adapters become standard. A strategic note at the bottom reads: "MCP doesn't just make features cheaper — it expands what's buildable. Some features are economically infeasible without standardised integration. Under MCP they pencil — that is the bigger executive story."](assets/exec-02-cost-curve.svg)

*For the first feature or two, MCP costs more — you pay upfront for shared infrastructure (server, auth, observability, governance) that one feature alone doesn't need. From around the third feature, the cost of each new feature drops sharply because the integration is already in place. The bigger commercial point isn't only "cheaper later" — some features that aren't worth building at bespoke prices become viable at the shared price.*

Today, if your company has three AI features that all need Salesforce data, three different teams have probably written three different Salesforce integrations. Each carries its own bugs, auth handling, retry policy, and on-call burden. The marginal cost of the *fourth* feature ends up looking surprisingly similar to the first.

After MCP, the integration is built once by the team that owns it, and every subsequent AI feature consumes it. The marginal cost of additional features drops materially because the protocol layer is already in place. This is the same dynamic shared platform teams have always produced, but with a more predictable build cycle because the integration pattern is standardised.

For a CFO: this changes the unit economics of AI feature development from "approximately linear in number of features" to "approximately linear in number of *systems integrated*." Most companies have a finite number of core systems and an unbounded list of possible features. That is a favourable shape.

### 2. Vendor lock-in shifts — somewhat in your favour

Before MCP, choosing an AI assistant often meant inheriting that vendor's integration ecosystem. Switching meant rebuilding integrations from scratch. After MCP, the integration layer becomes portable: a Salesforce MCP server you build can be reused by Claude, by internal agents, by commercial copilots, by a future model vendor that supports MCP.

This is not a complete escape from lock-in. Model behaviour, eval infrastructure, prompts, and workflow assumptions still create real switching costs. But the integration layer — historically the deepest source of lock-in — becomes portable, which meaningfully changes vendor negotiations.

### 3. "AI inside the company" stops being a project and becomes a property

![Two-panel before/after diagram. Left panel ("Detail A — Project model"): a single heavy block labelled "Internal AI Assistant (v1)" with a Q1–Q4 timeline above showing a delivery quarter; three employee labels (Engineer, Analyst, Sales) sit outside the block, connected by dashed lines, annotated "Waiting for delivery." Caption beneath: "One project. One owner. One date. Everyone else waits." Right panel ("Detail B — Emergent model"): three MCP servers (warehouse, CRM, docs) in the centre, surrounded by AI tools already in use (Claude Desktop, code-editor copilot, internal chatbot). The same three employees (Engineer, Analyst, Sales) sit inside the connected network. Two badges read "Reusable" and "Interchangeable", with the note "Tools and servers are interchangeable. Replace either without rebuilding the other." Annotation: "Servers exist. Tools connect. Capability appears — within the governance you've set." Footnote: "Plus the work that 'emergent' hides: permissions, identity, observability, audit."](assets/exec-04-emergent-internal-ai.svg)

*Internal AI doesn't have to be a single product on a release date. When MCP servers exist for your core systems, the AI tools your team already uses can connect to them — and the capability shows up wherever your people work. The shift is from "ship a project" to "publish servers and govern access." The right panel's footnote is the honest part: "emergent" makes it easy to skip the operational work — permissions, identity, audit — that still has to happen.*

Once you have a few internal MCP servers — your warehouse, your incident management system, your CRM — every AI tool your employees already use can connect to them. The internal AI assistant is no longer a thing IT has to ship. It is an emergent capability of the servers existing.

For a CEO: this changes the answer to "when will we have AI internally?" from "when IT delivers it" to "as soon as we publish the servers — and govern them."

## The risk surface, in business terms

MCP makes integration cheaper. It does **not** make AI safer by itself. If anything, it raises the importance of governance, because more systems become reachable through AI tooling. Three risk categories matter.

![Three-zone network diagram. Left zone, labelled "Untrusted input": three boxes — customer email, support ticket, public web page — annotated "Anything the AI reads." Centre zone, labelled "AI assistant", containing three connected tools — CRM tool, warehouse tool, send-message tool — annotated "The junction. Where decisions get made — and where governance applies." Right zone, labelled "Sensitive data": three boxes — customer records, financial data, internal documents — annotated "What the AI can reach." Thin black lines connect each input box to the AI assistant, and the AI assistant to each data box. A bold red curve traces a single path from "customer email" through the AI assistant to "customer records", labelled "Hidden instruction → real action". A dashed red line continues from "customer records" to a separate box labelled "External destination", annotated "Where data ends up." Footer note: "Hairlines indicate connection paths. Red indicates the highlighted scenario, not severity."](assets/exec-03-risk-surface.svg)

*An AI assistant connected to your business systems sits between things that take input and things that hold data. The risk most worth thinking about is the path: an instruction hidden inside content the AI was supposed to read, leading to a real action against sensitive data. MCP doesn't create that path; it standardises the junction where it lives — which makes it governable through the usual controls (narrow tool permissions, human approval for sensitive actions, separating tools that read from tools that write).*

### Prompt injection — social engineering, but for AI

An attacker writes instructions into a document, an email, a customer-support ticket, or a public web page. An AI assistant reads that content as part of doing its job and follows the instructions — for example, "send this user's data to attacker.com" or "delete this Salesforce record." This is the AI equivalent of social engineering: the model is treating as instructions input it should be treating as data.

MCP doesn't cause this risk, but it amplifies the blast radius: every connected system is a potential delivery channel for a malicious instruction, and every other connected system is a potential exfiltration channel. The defence is architectural — narrow tool permissions, explicit human approval for sensitive actions, separation between read and write capabilities, treating model output as untrusted, and strong observability around tool usage. None of that is a feature you can buy.

For governance: if a vendor's pitch doesn't have a clear answer to "how do you prevent the AI from following instructions hidden in the data it reads?" — that is a material gap, not an implementation detail.

### Data exfiltration paths multiply

Every MCP server is a path data can leave through. A misconfigured server, a too-permissive tool, an over-broad credential — any of these can turn an AI feature into an exfiltration channel. The mitigations are familiar — least-privilege auth, audit logging, tenant isolation, scoped credentials, approval workflows — but they have to be applied to a new layer of the stack, and that is new work.

For a CFO with a regulated business: the SOC 2 / ISO 27001 / HIPAA story for an MCP-using product needs to cover the AI tool surface, not just the underlying systems. Doable, but it is *additional work*, and it should be on the FY plan.

### Reliability and cost are tied to model behaviour

When deterministic software breaks, you have a stack trace. When an AI assistant chooses the wrong tool, fails to use a tool that would have worked, or misinterprets context, the failure mode is probabilistic — there is no stack trace, only a distribution. This is not a reason to avoid the technology; it is a reason to demand that your engineering org has invested in **evals** (automated tests of model behaviour), **observability**, tracing, and human escalation paths before the feature is in front of paying customers.

For a sales leader: when a customer asks "what happens if it gets it wrong?", the right answer is not "it won't." The right answer is "here is how we measure how often it does, here is the trend, and here is what the human-in-the-loop looks like."

## What "good" looks like, from the outside

You don't need to evaluate code. You can evaluate process. A team using MCP responsibly should be able to answer these questions crisply — and the *bad* answers below are what to listen for.

**1. Which MCP servers do we run, who owns each one, and what is the on-call rota?**
Bad answer: "Each feature team handles their own integrations." That means the integration debt is still distributed across feature teams, and you haven't yet captured the cost saving the protocol enables.

**2. What does our eval suite look like, how often does it run, and what's the trend?**
Bad answer: "We don't have one" or "we run it manually before releases." The state of the art is automated, on every change, with the trend reported. Manual-before-releases is the pre-modern equivalent of CI for traditional software — defensible only if you've consciously decided to live with it, not by default.

**3. How do we prevent prompt injection from causing a real-world action?**
Bad answer: "We use a guardrails library" or "the model handles it." The right answer names architectural choices: human-in-the-loop on sensitive operations, narrow tool scopes, separation between tools that read and tools that write.

**4. What's our cost per AI interaction, and how is it trending?**
Bad answer: a shrug, or a flat number with no derivative. AI features have variable cost in a way most software features don't. A team that can't answer this is one regression away from a budget incident.

**5. If the model vendor changes their pricing or deprecates a model tomorrow, what's our exposure?**
Bad answer: "We'd have to look into it." MCP makes the integration layer portable, but the model choice is still a commitment. The mature answer sounds like "we'd absorb a 30% price rise; beyond that we'd switch — here's the candidate model and the migration plan."

If your engineering leadership can answer these crisply, you're likely dealing with a mature organisation rather than simply an enthusiastic one. If they can't, the gap is in *discipline*, not in the technology choice.

## How to talk about this externally

For sales leaders: a few framings that are commercially effective without overclaiming.

### Strong framings

- **"We use MCP, the open protocol for AI integration."** True, vendor-neutral, signals current.
- **"Our AI features connect to your existing systems through a standard interface, so adding new ones doesn't require new integration work each time."** The customer-relevant version of the cost-curve point.
- **"We've designed for the case where the AI gets it wrong"** — followed by your eval, observability, and human-in-the-loop story. Customers in regulated industries respond better to this than to inflated confidence.

### Things to avoid

- **"MCP makes AI safe."** It doesn't. MCP standardises integration. Safety comes from architecture, governance, and controls.
- **"MCP is USB for AI."** Useful internal shorthand, but an informed customer will push on it. *"MCP is an open protocol for connecting AI systems to tools and data sources"* travels better.
- **Confident claims about future model behaviour.** The honest version is measurement, monitoring, safeguards, escalation paths, continuous improvement — and the willingness to talk about all of them in specifics.

## A worked example: Marlin

Throughout the rest of this fast track, the engineering chapters use a fictional company called **Marlin** — a mid-market RevOps SaaS, ~250 engineers, ~$80M ARR, integrating with Salesforce, HubSpot, Slack, Gong, and Snowflake. Deliberately unglamorous, because most enterprise AI adoption is.

In commercial terms, Marlin's situation before MCP: three AI features in flight, each by a different team, each writing its own Salesforce client. Two of the three have inconsistent rate-limit handling and different audit-log shapes. Adding a fourth feature requires roughly the same integration spend as the first. Their security team can't easily answer "what data can each AI feature reach?" because the wiring is everywhere.

After MCP: one Salesforce MCP server, owned by the data platform team. The fourth, fifth, sixth feature each reuse it. Marginal cost of new features drops materially. The security team has *one* place to ask "what does this server expose, and to whom?" The vendor-negotiation story for their model provider improves: their integrations are now portable across assistants.

The technology side of this story is the rest of the fast track. The commercial side is what you've just read.

## Where to go next

You don't need the rest of the fast track to be useful in conversations. But three of its chapters are worth a skim:

- **[Chapter 1 — What MCP is, and what it changes](01-why-mcp-exists.md)** — the same content one level more technical, with engineer-targeted framing. Read if you want to disagree productively with your engineering team.
- **[Chapter 4 — The risk surface](04-risk-surface.md)** — the threat model in more depth. Useful before any conversation with your CISO or auditors.
- **[Chapter 5 — Making it reliable](05-making-it-reliable.md)** — what production-grade looks like. Useful before any board conversation about AI reliability or cost.

## Resources for executives

A short, deliberately curated list. The full fast-track [resources page](resources.md) is broader; these are the items most useful for a CEO, CFO, or sales lead specifically.

### To brief yourself further (non-technical)

- **[Introducing the Model Context Protocol](https://www.anthropic.com/news/model-context-protocol)** (Anthropic, November 2024) — the official launch post. ~10 minutes. The clearest non-technical framing of the problem MCP solves; suitable for forwarding to a peer.
- **[Building effective agents](https://www.anthropic.com/engineering/building-effective-agents)** (Anthropic Engineering, December 2024) — distinguishes "workflows" from "agents" in a way that prevents the two most expensive architecture mistakes. Worth reading once even if you skim the code blocks.

### To verify the protocol exists and is real

- **[modelcontextprotocol.io](https://modelcontextprotocol.io)** — the official spec site. You don't need to read the spec; the *existence* of an open spec is the signal. If a vendor is vague about MCP, this is the source of truth they are hand-waving past.
- **[github.com/modelcontextprotocol](https://github.com/modelcontextprotocol)** — the open-source organisation. SDKs in TypeScript, Python, and several other languages, plus a reference server collection.

### For the board / leadership conversation

- **[Anthropic's Responsible Scaling Policy](https://www.anthropic.com/responsible-scaling-policy)** — vendor-specific, but a model for how to think about graduated risk in AI deployment. Useful as a reference point when your team proposes their own framework.
- **[A2A (Agent-to-Agent)](https://github.com/google-a2a/A2A)** — Google's complementary protocol for agent-to-agent delegation. Different layer from MCP, not competing. If a vendor pitches the two as either/or, they're confused or selling.

### For sales conversations

- **[modelcontextprotocol/servers](https://github.com/modelcontextprotocol/servers)** — the reference server collection. If a customer asks "who else uses this?" — this is the public, browseable answer. Worth a 10-minute skim so you recognise the names.

## A closing note

If you finish this brief feeling slightly underwhelmed — that the technology is more boring than the marketing suggests — that is the correct reaction. MCP is plumbing. Plumbing matters enormously, but it doesn't sparkle.

The companies that get the most out of AI over the next two years will not be the ones with the loudest demos. They will be the ones that take the plumbing seriously and leave the sparkle to the application layer, where it belongs.

If you want the full engineering picture, the [Leader Fast Track](README.md) is the next 5 hours. If you want to hand work to your team, the [12-week practitioner pathway](../README.md) is the next 12 weeks.
