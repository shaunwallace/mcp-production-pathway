---
title: Week 12 — Security, threat model, PII, close-out (Phase 6)
status: outline
---

# Week 12 — Security, threat model, PII, close-out (Phase 6)

> **Outline — full week ships in a future release.** Structure below is stable.

**Time budget (planned):** 10 to 14 hours.

## Objectives

- Threat-model the full stack end to end using a structured framework (STRIDE or similar).
- Harden against prompt injection via tool outputs (the model reads them — hostile content can steer it).
- Scrutinise tenant isolation against an adversarial harness.
- Define and implement a **PII / data retention** policy: what you log, for how long, how it's redacted.
- Add a dependency / supply-chain security scan to CI.
- Close the pathway with the **third and final memo** — security posture + what you'd change if you started again.
- Short closing callout on adjacent topics deliberately out of scope (agent frameworks, memory, A2A).

## Tooling additions

- Threat-modelling template (STRIDE table in `decisions/threat-model.md`)
- `osv-scanner` or `trivy fs` for dependency/image scanning in CI
- Redaction helpers (regex-based for known PII shapes; structured field stripping at the logger)

## Reading list (planned)

- Simon Willison on prompt injection via tool outputs
- OWASP top 10 for LLM applications
- MCP spec security considerations section
- One practitioner post on data retention for AI-adjacent systems (Anthropic's own policy is a reasonable reference)

## Planned canonical code example

- `decisions/threat-model.md` — STRIDE table covering transport, auth, tenancy, tool outputs, logs, secrets
- `server/src/redaction.ts` — redaction applied to log lines and audit entries
- `evals/phase-6-injection.jsonl` — adversarial prompts that try to:
  - extract system context
  - impersonate a different tenant
  - trick a tool into writing to another tenant's data
  - hide a prompt inside a backend response (second-order injection)
- `.github/workflows/security.yml` — scheduled osv-scanner run + SBOM generation

## Artefact evolution (planned gates)

### Evolution: server

- **Before (end of W11):** functional, observable, load-tested.
- **Change:** PII redaction at log boundary; tool-output sanitisation flagging suspicious control characters / instruction-like patterns; tightened tenancy assertions.
- **After:** redaction applied consistently; hostile outputs flagged in audit log.
- **Verify:** adversarial eval set runs; every injection case either refused correctly or flagged in audit.

### Evolution: harness

- **Change:** adversarial eval mode (`--eval phase-6-injection.jsonl`) with scoring criteria for "resisted" vs "succumbed."

### Evolution: CI workflow

- **Change:** security workflow runs on schedule (weekly) and on dependency updates; scans fail the build on high-severity.

### Evolution: RUNBOOK.md

- **Change:** add security-incident playbook (suspected tenancy breach, leaked credential, active injection campaign).

### Evolution: consumer README

- **Change:** add SLA language (uptime, support expectations, how to report security issues).

### Evolution: error taxonomy

- **Change:** add `injection_detected` flag in audit entries (not a user-visible error — internal signal for security monitoring).

## Final memo (`memos/03-security-posture.md`)

**The third and final memo.** ~800 words. Most honest thing you'll write in the pathway.

Required sections:

- **TL;DR** (3 bullets)
- **What I got right** — 2 things
- **What I got wrong** — 2 things. Be specific. Reference ADRs that didn't age well.
- **The posture today** — where the biggest risks live, what mitigations are in place, what isn't
- **What I'd do differently starting again** — the thing most worth sharing

## Adjacent-ecosystem close-out (explicitly not covered)

One short section in the memo or `notes/adjacent.md` pointing at things this pathway deliberately did not cover:

- **Agent frameworks** (LangGraph, OpenAI Agents SDK, Claude Agent SDK) — orchestration layer above MCP
- **Agent memory** (Mem0, Letta, etc.) — client-side concern
- **Agent-to-agent protocols** (A2A) — different problem; MCP is model-to-tools
- **RAG patterns** — implicitly exercised if you chose a vector-DB backend, but not a pathway focus

Noting these keeps the pathway's scope defensible: MCP production server. Anything further is somebody else's curriculum.

## Checkpoint (planned)

- [ ] Threat model committed with a STRIDE table covering all named components
- [ ] PII redaction applied at log and audit boundaries with tests
- [ ] Adversarial eval set runs; injection resistance scored
- [ ] Tenant isolation verified under hostile-tenant conditions
- [ ] Security workflow in CI
- [ ] `RUNBOOK.md` security-incident playbook committed
- [ ] `memos/03-security-posture.md` committed
- [ ] `git tag week-12-complete`
- [ ] `git tag phase-6-complete` after `make verify`
- [ ] `git tag pathway-complete` — this is the one that matters

## What you have now

A local-first, container-packaged, OAuth-protected, multi-tenant MCP server with tracing, metrics, evals in CI, a load test, a threat model, a runbook, and three memos. Spin the whole thing up with `docker compose up`. Point it at any backend. Deploy with a single script. Explain any design decision by pointing at an ADR and a commit.

That's the pathway. The rest is reps.

## If you want to go further

- Contribute an MCP server to the community (`@modelcontextprotocol/servers`).
- Write about one thing you learned. The memo format is ready; the world needs more of this.
- Mentor someone through the pathway. Teaching surfaces the gaps in your own understanding.
