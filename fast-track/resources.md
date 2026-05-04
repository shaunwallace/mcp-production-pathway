---
title: Resources and further reading
description: A curated, opinionated list of canonical references for leaders who want to go deeper than the fast track without disappearing into the weeds.
---

# Resources and further reading

A short, opinionated list. Every item here is something a senior engineering leader could send to a peer without caveat. The annotations explain *why* each one is worth your time, so you can pick rather than read everything.

This list is deliberately small. The MCP ecosystem moves quickly and produces a lot of forgettable content; the items below are the ones that have held up.

## The protocol itself

- **[modelcontextprotocol.io](https://modelcontextprotocol.io)** — the official spec and documentation site. The single source of truth for what MCP actually is. If something on the internet contradicts this site, trust this site. Skim the "Concepts" section; come back to "Specification" only when a design conversation hits something concrete.
- **[github.com/modelcontextprotocol](https://github.com/modelcontextprotocol)** — the GitHub organisation. SDKs (TypeScript, Python, others), the spec repo, the inspector tool. The SDK READMEs are surprisingly readable and orient an engineer faster than the spec does.
- **[modelcontextprotocol/servers](https://github.com/modelcontextprotocol/servers)** — the reference server collection. Worth a 20-minute browse: reading three or four of these (filesystem, GitHub, Slack) gives you a calibrated sense of what "well-designed tool surface" actually looks like, in code, before your team puts a design in front of you.

## Anthropic foundational reading

- **[Introducing the Model Context Protocol](https://www.anthropic.com/news/model-context-protocol)** (Anthropic, November 2024) — the launch announcement. The framing of *the problem* MCP solves is tighter here than in most secondary writing. Useful as a 10-minute brief for an exec who will not read this fast track.
- **[Building effective agents](https://www.anthropic.com/engineering/building-effective-agents)** (Anthropic engineering, December 2024) — not MCP-specific, but the most-cited piece on what agents actually are and how to build them well. Distinguishes "workflows" from "agents" in a way that prevents the two most common architecture mistakes. The vocabulary in this post (augmented LLM, orchestrator-workers, evaluator-optimiser) shows up in MCP design conversations constantly. Read once, refer back.
- **[Anthropic engineering blog](https://www.anthropic.com/engineering)** — the running source for new patterns and post-mortems from the team that ships the protocol. Not all posts are MCP-relevant; skim titles.

## Adjacent and complementary protocols

- **[A2A (Agent-to-Agent)](https://github.com/google-a2a/A2A)** — Google's protocol for agent-to-agent task delegation. Chapter 1 frames this as complementary to MCP, not competitive; the README on this repo is the easiest way to confirm that for yourself in 15 minutes.
- **OpenAI's Responses API and tool-use docs** — vendor-specific function-calling shapes. Worth reading once for vocabulary parity if your organisation runs multi-vendor; the comparison sharpens what MCP's host-neutrality actually buys you.

## Talks and video

- **[Anthropic on YouTube](https://www.youtube.com/@anthropic-ai)** — the official channel. MCP-specific talks and walk-throughs land here. Search "MCP" within the channel; the launch demo and the deep-dives from late 2024 / early 2025 are the high-signal ones.
- **AI Engineer conference talks** — many of the practitioner-grade MCP talks live on the AI Engineer YouTube presence. Search by speaker rather than topic; the quality variance is high but the ceiling is high too.

## Community and ongoing

- **The MCP spec repo's discussions and issues** — where protocol-level debates actually happen. Most leaders don't need to follow this in real time; useful when a specific question comes up ("is there a standard pattern for X?") because someone has usually already asked.
- **Simon Willison's blog** — runs an unusually clear, ongoing commentary on agent and protocol developments. Not MCP-exclusive, but consistently among the first places a new pattern gets written up honestly. Worth a feed subscription if you read in this space at all.

## What's deliberately not on this list

- Vendor blog posts that mostly restate the announcement.
- "10 MCP servers you should try" listicles. The reference servers above will teach you more.
- Twitter/X threads. Useful for awareness, not for grounding architecture decisions.
- Anything older than the November 2024 launch — pre-protocol prior art exists and is interesting, but it is not what your engineers will be working with.

## How to use this list as a leader

If you have **30 minutes**, read the launch announcement and skim modelcontextprotocol.io's Concepts page.

If you have **2 hours**, add "Building effective agents" and a 20-minute browse of three reference servers from the `modelcontextprotocol/servers` repo.

If you have **a Saturday morning**, add the A2A README and one practitioner talk from the Anthropic YouTube channel.

After that, the marginal return on more reading drops sharply. The next investment that actually moves your understanding is watching your own team build something — which is what the [12-week pathway](../README.md) is for.
