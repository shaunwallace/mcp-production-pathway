---
title: Executive Brief — MCP for CEOs, CFOs, and Sales Leaders
description: A non-technical 20-minute brief on what the Model Context Protocol is, why it matters commercially, and the questions to ask your engineering org.
---

# Executive Brief — MCP for CEOs, CFOs, and Sales Leaders

A 20-minute, non-technical companion to the Leader Fast Track. If the rest of the fast track is for the engineering leader who will *build* with MCP, this page is for the executives who need to **fund, govern, position, or sell around** AI work that uses it.

You will not be writing code. You will be making investment, risk, and go-to-market decisions, and you will be in rooms where engineers, vendors, and customers casually drop the term "MCP." This brief gives you enough to be a useful participant in those conversations without overclaiming.

## The one-paragraph version

The **Model Context Protocol** (MCP) is an open standard, [released by Anthropic in late 2024](https://www.anthropic.com/news/model-context-protocol), for how AI assistants connect to the systems where your business actually lives — your CRM, your data warehouse, your ticketing system, your internal documents. Before MCP, every AI feature had to be wired to every system by hand, by a different team, in a different way. After MCP, the wiring is standardised. The same AI assistant can plug into Salesforce, Snowflake, and your internal docs the same way a laptop plugs into any USB-C device. You still have to build and own the connectors, but you build each one *once* and every AI tool in the company can use it.

That is the entire idea. Everything below is implications.

## Three analogies, in increasing accuracy

Pick whichever lands for the audience you're talking to. The third is the most accurate; the first two are useful shorthand.

1. **Shipping containers.** Before standardised containers, every cargo type had bespoke loading, bespoke trucks, bespoke cranes. Containerisation didn't make the goods themselves better — it made *moving* them between systems trivial. MCP is the container standard for the connection between AI assistants and your business systems.

2. **Power sockets in a hotel.** Every appliance used to need a custom adapter for every wall. Once the socket is standard, the hotel doesn't care what you plug in, and the appliance doesn't care which hotel you're in. MCP standardises the socket between an AI tool and a data source.

3. **A common driver layer (the engineer's version).** MCP is to AI assistants what a printer driver standard is to operating systems. The OS doesn't need to know how each printer works; the driver does. New printers ship with drivers; the OS just talks to them. New AI tools and new data systems can interoperate because they speak the same protocol.

If a vendor tells you MCP is "USB for AI," they are slightly overselling — but only slightly. The instinct is right; the scope is narrower than USB.

## Why this matters commercially

Three commercial implications, all reasonably concrete.

### 1. AI features get cheaper to build, and the cost curve bends

Today, if your company has three AI features that all need Salesforce data, three different teams have probably written three different Salesforce integrations. Each one carries its own bugs, its own auth handling, its own on-call burden. The marginal cost of the *fourth* AI feature is roughly the same as the first.

After MCP, the integration is built once by the team that owns it, and every subsequent AI feature consumes it. The marginal cost of the fourth feature drops sharply. This isn't a hypothetical — it's the same dynamic that shared services teams have always produced, but with a much shorter and more predictable build cycle because the protocol is fixed.

For a CFO: this changes the unit economics of AI feature development from "approximately linear in number of features" to "approximately linear in number of *systems integrated*." Most companies have a small, finite number of systems and an unbounded list of features. That is a favourable shape.

### 2. Vendor lock-in shifts — somewhat in your favour

Before MCP, choosing an AI assistant for your company often meant choosing a specific integration ecosystem. Switching meant rewriting your connectors. After MCP, the connectors are protocol-standard. If you build a Salesforce MCP server, it works with Claude, with internal agents, with whatever assistant you adopt next, with assistants built on other model families that support MCP.

This is not a complete escape from lock-in — your model choice still matters, and switching costs are still real. But the integration layer, which used to be the deepest source of lock-in, becomes portable. That meaningfully changes vendor negotiations.

### 3. "AI inside the company" stops being a project and becomes a property

Once you have a few internal MCP servers — your warehouse, your incident management, your CRM — *every* AI tool your employees already use can connect to them. The internal AI assistant is no longer a thing IT has to ship. It is an emergent capability. Your engineers' Claude Desktop or Cursor or copilot already knows how to query your data once the servers exist.

For a CEO: this changes the answer to "when will we have AI internally?" from "when IT delivers it" to "as soon as we publish the servers."

## The risk surface, in business terms

MCP makes integration cheaper. It does **not** make AI safer by itself. The opposite, if anything: more connections mean more surface area. Three risk categories, in plain language.

### Prompt injection — social engineering, but for AI

An attacker writes instructions into a document, an email, a customer-support ticket, or a public web page. An AI assistant reads that content as part of doing its job and follows the instructions — for example, "send this user's data to attacker.com" or "delete this Salesforce record." This is the AI equivalent of social engineering: the model is trusting input it should be treating as data.

MCP doesn't cause this risk, but it amplifies it: every connected system is a potential delivery channel for a malicious instruction, and every other connected system is a potential exfiltration channel. The defence is architectural — narrow tool permissions, explicit human approval for sensitive actions, treating model output as untrusted — not a feature you can buy.

For governance: if a vendor's pitch doesn't have a clear answer to "how do you prevent the AI from following instructions hidden in the data it reads?" — that's a gap, not a detail.

### Data exfiltration paths multiply

Every MCP server is a path data can leave through. A misconfigured server, a too-permissive tool, an over-broad credential — any of these can turn an AI feature into an exfiltration channel. The mitigations are familiar (least-privilege auth, audit logging, scoping by tenant) but they have to be applied to a new layer of the stack.

For a CFO with a regulated business: the SOC 2 / ISO 27001 / HIPAA story for an MCP-using product needs to cover the AI tool surface, not just the underlying systems. This is doable, but it is *new work*, and it should be on the FY plan.

### Reliability and cost are now tied to model behaviour

When a deterministic system breaks, you have a stack trace. When an AI assistant chooses the wrong tool or fails to use a tool that would have worked, you have a probability distribution. This is not a reason to avoid the technology — it is a reason to demand that your engineering org has invested in **evals** (automated tests of model behaviour) and **observability** (the ability to see what the AI did and why) before the feature is in front of paying customers.

For a sales leader: when a customer asks "what happens if it gets it wrong?", the right answer is not "it won't" — it's "here is how we measure how often it does, here is the trend, and here is what the human-in-the-loop looks like."

## What "good" looks like, from the outside

You don't need to evaluate code. You can evaluate process. A team that is using MCP responsibly will be able to answer these questions without scrambling:

1. **Which MCP servers do we run, who owns each one, and what is the on-call rota?** A vague answer here means the integration debt is still distributed across feature teams, and you haven't yet captured the cost saving the protocol enables.

2. **What does our eval suite look like? How often does it run? What's the trend?** "We don't have one" or "we run it manually before releases" is a flag. The state of the art is automated, on every change, with the trend reported.

3. **How do we prevent prompt injection from causing a real-world action?** Look for: human-in-the-loop on sensitive operations, narrow tool scopes, separation between "tools that read" and "tools that write."

4. **What's our cost per AI interaction, and how is it trending?** AI features have variable cost in a way most software features don't. A team that can't answer this is one regression away from a budget incident.

5. **If the model vendor changes their pricing or deprecates a model tomorrow, what's our exposure?** MCP makes the integration layer portable, but the model choice is still a commitment. Having an answer here — even "we'd absorb a 30% price rise; beyond that we'd switch, here's the plan" — is the marker of an org that's thinking commercially about this.

If your engineering leadership can answer these crisply, you're in good shape. If they can't, the gap is likely in *operational maturity*, not in the technology choice.

## How to talk about this externally

For sales leaders: a few framings that hold up under technical scrutiny.

- **"We use MCP, the open standard for AI integration."** True, vendor-neutral, signals current. Doesn't overclaim.
- **"Our AI features connect to your existing systems through a standard protocol, so adding new ones doesn't require new integration work each time."** This is the customer-relevant version of the cost-curve point above.
- **"We've designed for the case where the AI gets it wrong"** — followed by your eval/human-in-the-loop story. Customers in regulated industries respond better to this than to confidence.

Things to avoid in a customer conversation:

- "MCP makes AI safe." It doesn't. It makes integration standard. Safety is your architecture.
- "MCP is USB for AI." It's a useful internal shorthand, but an informed customer will push on it. "It's the standard protocol for AI-to-system integration" travels better.
- Confident claims about future model behaviour. The honest version is "here's what we measure, here's the trend, here's the fallback when it's wrong."

## A worked example: Marlin

Throughout the rest of this fast track, the engineering chapters use a fictional company called **Marlin** — a mid-market RevOps SaaS, ~250 engineers, ~$80M ARR, integrates with Salesforce, HubSpot, Slack, Gong, and Snowflake. It's deliberately unglamorous.

In commercial terms, Marlin's situation before MCP:

- Three AI features in flight, each by a different team, each writing their own Salesforce client.
- Two of the three have inconsistent rate-limit handling and different audit-log shapes.
- Adding a fourth feature requires roughly the same integration spend as the first.
- Their security team can't easily answer "what data can each AI feature reach?" because the wiring is everywhere.

After MCP:

- One Salesforce MCP server, owned by the data platform team.
- The fourth, fifth, sixth AI feature each reuse it. Marginal cost of new features drops materially.
- The security team has *one* place to ask "what does this server expose, and to whom?"
- The vendor-negotiation story for their model provider improves: their integrations are now portable.

The technology-side of this story is the rest of the fast track. The commercial-side is what you've just read.

## Where to go next

You don't need the rest of the fast track to be useful in conversations. But three of its chapters have material that is worth a skim for an executive:

- **[Chapter 1 — What MCP is, and what it changes](01-why-mcp-exists.md)** — the same content, one level more technical, with engineer-targeted framing. Read if you want to be able to disagree productively with your engineering team.
- **[Chapter 4 — The risk surface](04-risk-surface.md)** — the threat model in more depth. Useful before any conversation with your CISO or auditors.
- **[Chapter 5 — Making it reliable](05-making-it-reliable.md)** — what production-grade looks like. Useful before any board conversation about AI feature reliability or cost.

## Resources for executives

A short, deliberately curated list. The full fast-track [resources page](resources.md) is broader; these are the items most useful for a CEO/CFO/sales lead specifically.

### To brief yourself further (non-technical)

- **[Introducing the Model Context Protocol](https://www.anthropic.com/news/model-context-protocol)** (Anthropic, November 2024) — the official launch post. ~10 minutes. The clearest non-technical framing of *the problem* MCP solves; suitable for forwarding to a peer.
- **[Building effective agents](https://www.anthropic.com/engineering/building-effective-agents)** (Anthropic engineering, December 2024) — distinguishes "workflows" from "agents" in a way that prevents the two most expensive architecture mistakes. Worth reading once even if you skim the code blocks. The vocabulary shows up in every serious AI design conversation.

### To understand the protocol exists and is real

- **[modelcontextprotocol.io](https://modelcontextprotocol.io)** — the official spec site. You don't need to read the spec; the *existence* of an open spec is the signal. If a vendor is vague about MCP, this is the source of truth they are hand-waving past.
- **[github.com/modelcontextprotocol](https://github.com/modelcontextprotocol)** — the open-source organisation. Useful evidence of breadth: official SDKs in TypeScript, Python, and several other languages, plus a reference server collection.

### For the board / leadership team conversation

- **[Anthropic's Responsible Scaling Policy](https://www.anthropic.com/responsible-scaling-policy)** — vendor-specific, but a model for how to think about graduated risk in AI deployment. Useful as a reference point when your team proposes their own AI risk framework.
- **[A2A (Agent-to-Agent)](https://github.com/google-a2a/A2A)** — Google's complementary protocol for agent-to-agent delegation. Worth knowing exists; the relationship to MCP is "different layer, not competing." If a vendor pitches A2A *vs* MCP as an either/or, they're confused or selling.

### For sales conversations

- **[modelcontextprotocol/servers](https://github.com/modelcontextprotocol/servers)** — the reference server collection. If a customer asks "who else uses this?" — this is the public, browseable answer. Worth a 10-minute skim so you recognise the names.

## A closing note

If you read this brief and feel slightly underwhelmed — that the technology is more boring than the marketing suggests — that's the correct reaction. MCP is plumbing. Plumbing matters enormously, but it doesn't sparkle. The companies that will get the most out of AI over the next two years are the ones that take the plumbing seriously *and* leave the sparkle to the application layer where it belongs.

If you want the full engineering picture, the [Leader Fast Track](README.md) is the next 5 hours. If you want to hand work to your team, the [12-week practitioner pathway](../README.md) is the next 12 weeks.
