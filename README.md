---
title: MCP Production Pathway
description: A 12-week learning pathway for building a production-grade Model Context Protocol server.
---

# MCP Production Pathway

A 12-week learning pathway for building a production-grade Model Context Protocol server — protocol internals, local-first dev, containerised deployment, authentication, multi-tenancy, observability, evals, cost, security. Written for senior engineers and engineering leaders who want practitioner-level fluency with the production MCP stack.

## Release status

**Weeks 1-3 are live. Weeks 4-12 ship as outlines now and will be written out iteratively.** Each outline commits to the structure — objectives, canonical code example, checkpoint, artefact evolution — so the shape is stable even where the prose isn't yet. Subscribe to releases on the repo to get notified as each week lands in full.

The pathway is released incrementally on purpose. Three weeks of real depth beats twelve weeks of thin coverage, and the release cadence keeps pace with learners who are actually doing the work.

## What you'll build

A local-first, container-packaged, OAuth-protected, multi-tenant MCP server with tracing, metrics, evals in CI, a load test, a threat model, and a runbook. Every week can be completed end-to-end on your laptop. Cloud deployment is an optional extension, not a gate.

The reference implementation is TypeScript end to end, using the official MCP SDK, Anthropic SDK, and OpenTelemetry.

## Who this is for

Engineers with production experience who are new to MCP specifically. The pathway assumes comfort with TypeScript, HTTP, JSON-RPC concepts, OAuth at a basic level, containers, and some form of deployment. It does not assume any prior MCP work.

## Who this is not for

Not a quickstart. Not a "build an AI agent in 10 lines" tutorial. The work is deliberate, the timelines are weeks not hours, and the point is depth.

## How to use this repo

This is a template repository. It contains four kinds of content:

- **Curriculum** (the textbook): `weeks/`, this README. Read-only reference material.
- **Templates and worked examples** (calibration): `templates/` (blank scaffolds for ADRs, memos, progress entries) and `templates/examples/` (worked examples, for when you're stuck or want to check the shape of your own work).
- **Scaffolds** (the workbook starter): `server/`, `harness/`. Empty code with TODOs that you fill in.
- **Supporting material**: `PATHWAY.md` (artefact-dependency map and evolution table), `docs/` (pinned Claude model IDs), `scripts/` (helpers like the 300-line harness check), `.env.example` (placeholder env vars).

The right way to use it is to create your own private workbook from this template (GitHub → "Use this template" → "Create a new repository") and do your work there. See `REPO-ARCHITECTURE.md` for the full pattern.

## The 12-week arc

| Phase | Weeks | Focus | Status |
|-------|-------|-------|--------|
| 0 | 1 | Mental model: what MCP is, what it isn't | **Live** |
| 1 | 2-3 | First server, tool design, evals, CI | **Live** |
| 2 | 4-5 | HTTP transport + hardening, sessions, persistence, prompts, roots | Outline |
| 3 | 6-7 | OAuth 2.1 (RFCs 9728/8707/7591), DCR, multi-tenancy, tamper-evident audit, quotas | Outline |
| 4 | 8-9 | Containerised deploy, SLOs, secrets, OpenTelemetry, metrics | Outline |
| 5 | 10-11 | Caching, cost attribution, load testing | Outline |
| 6 | 12 | Security, threat model, PII, hostile inputs, close-out | Outline |

### What each week covers

<!-- card-grid -->
- **Week 1 — Mental model.** Spec, JSON-RPC 2.0, MCP's honest limits. Output: a "why MCP" memo and an ADR pinning SDK and backend choice. This is the only Phase 0 memo; two more land at Phase 3 and Phase 6.
- **Week 2 — First server.** Design 4-6 tools and one resource against a real backend. Fill in the server scaffold with zod validation, a `pino` logger, and an `instrument()` wrapper. Write unit tests (vitest) and contract tests (MSW) against recorded fixtures. Build a ~40-line agent harness over stdio. Output: a working end-to-end MCP server exercised in Claude Desktop and the Inspector, with a test suite and a canonical error taxonomy.
- **Week 3 — Iterate, measure, CI.** Write an eval dataset. Extend the harness to run it. Use pass rate to drive rename/redesign iterations. Wire evals and vitest into GitHub Actions. Add empty-success detection. Output: a regression guard on CI that reruns every subsequent phase.
- **Week 4 — Streamable HTTP transport.** Port from stdio to HTTP using `hono`. Test client portability against Inspector, Claude Desktop, Cursor. Add transport-boundary validation, idempotency keys, timeouts. Rerun the Week 3 evals under HTTP.
- **Week 5 — Sessions, persistence, prompts, roots.** Promote the W4 in-memory session and event stores to Postgres via docker-compose with versioned migrations. Wire progress notifications and cancellation on a long-running tool. Implement two prompts (one with arguments + completion) and roots so the server respects what the client is willing to expose. Output: the compose file that grows into your local production stack.
- **Week 6 — OAuth 2.1 done correctly for MCP.** Authorization Server / Resource Server separation per the 2025 MCP spec. Protected Resource Metadata (RFC 9728), Resource Indicators (RFC 8707) for token-audience binding, PKCE, refresh-token rotation with reuse detection, revocation (RFC 7009), introspection (RFC 7662), API-key fallback. ~100-line local issuer (`jose`-based) means the whole flow runs offline. Audit log introduced (plain JSONL — tamper-evident in W7).
- **Week 7 — DCR, multi-tenancy, tamper-evident audit, quotas.** Real OAuth client in the harness with PKCE + Dynamic Client Registration (RFC 7591). Tenant scoping at two layers (app-layer query builder + Postgres RLS) for defence-in-depth. Per-tenant token-bucket quotas. Hash-chained audit log with a daily verification job. Phase 3 memo — identity and tenancy tradeoffs.
- **Week 8 — Docker, deployment, SLOs, secrets.** Multi-stage Dockerfile, health probes, graceful shutdown, rollback drill. SLOs (p95, error budget, concurrency). Secrets via file-mount locally and Secret Manager in cloud. Local-only track is a full checkpoint; Cloud Run push is an optional extension. `RUNBOOK.md` created.
- **Week 9 — OpenTelemetry, traces, metrics.** Replace the Week 2 `instrument()` wrapper with OTel spans. Add RED metrics (`prom-client`). Scrape locally with Prometheus; Jaeger for traces — both in compose.
- **Week 10 — Caching, cost attribution, tool versioning, contract tests.** Two cache layers: Anthropic prompt caching in the harness (8–10× input-cost drop) and annotation-gated tool-result caching in the server with tenant + version in every key. Cost as a first-class metric — per session, per tool, per tenant — populating the W9 histogram. Explicit additive-only versioning policy exercised via a worked rename. Golden contract tests pin every tool schema; CI fails on drift. Cost + latency budgets enforced on eval cases.
- **Week 11 — Load testing, cost at scale, sampling and elicitation under load.** k6 in compose. Concurrent-session load. Implement sampling (server-initiated completions through the client's model) and elicitation (mid-tool user prompts) — both introduced here so their cost-and-latency story is visible under contention, not theoretical. Model cost at 10× and 100× expected volume with the sampling multiplier broken out. Find the bottleneck (it is rarely the one you'd guess).
- **Week 12 — Security, threat model, PII, close-out.** Threat model the full stack. Prompt-injection resistance. Tenant isolation scrutiny. Data retention and PII policy. Dependency security scan. Phase 6 memo; short closing callout on adjacent topics (agent frameworks, memory, A2A) deliberately out of scope for this pathway.

## Tooling choices

This pathway is opinionated about tools. Snippets stay consistent across weeks so you don't have to translate between examples. You are not locked in — every tool is introduced with a one-line tradeoff and alternatives for you to swap if you prefer.

| Concern | Canonical choice | Alternatives flagged |
|---|---|---|
| Input validation | zod | valibot, ajv |
| Logging | pino | winston, roarr |
| Testing | vitest | `node:test`, jest |
| HTTP mocking | MSW | nock |
| HTTP server (W4+) | hono | express, fastify |
| Persistence (W5+) | better-sqlite3 (dev), Postgres (prod-shape) | libsql, Drizzle on any SQL |
| OAuth/JWT (W6) | jose + MCP SDK built-ins | node-jose, panva/openid-client |
| Container (W8) | Docker multi-stage | Podman, Buildah |
| Deploy (W8) | Cloud Run | Fly.io, Railway, Lambda container |
| Secrets (W8) | GCP Secret Manager | AWS SSM, HashiCorp Vault |
| Tracing (W9) | @opentelemetry/sdk-node | — (OTel is the standard) |
| Metrics (W9) | prom-client + Prometheus | OTel metrics, Datadog |
| Load (W11) | k6 | artillery, autocannon |

## Local-first principle

Every week completes on your laptop. Weeks that introduce cloud-shaped concerns (deployment, secrets, hosted auth) ship with a local equivalent that exercises the same patterns:

- **Local OAuth issuer** (W6) — 60-line in-process JWT issuer; same validation path a real IdP would use.
- **Local secrets** (W8) — docker secrets / file-mount pattern; same abstraction Secret Manager fills in cloud.
- **Local deploy** (W8) — `docker run` with probes, graceful shutdown, rollback drill — full W8 checkpoint without a cloud account.
- **Local observability** (W9) — Jaeger + Prometheus in compose.
- **Local load** (W11) — k6 as a one-shot compose service.

By the end of Week 12, `docker compose up` brings up your entire production-shaped stack locally: server, Postgres, issuer, Jaeger, Prometheus, optional Grafana. Deploying to a real cloud is an optional W8 extension, never a gate to progressing.

## Artefact evolution and quality gates

Five artefacts grow deliberately across the pathway: the server, the harness, the eval set, the compose file, and the CI workflow. (Plus a consumer README and a runbook that start later.) Each change uses the same five-part block so you can see what moved, verify it worked, and connect it to what it enables later:

```
Before: <artefact state at end of previous week>
Change: <specific edit, with file paths>
After:  <new state>
Verify: <exact command + expected output>
Enables: <one sentence forward-reference>
```

Phase boundaries have a single `make verify` acceptance gate — full test suite, full eval suite, health check against the local compose stack. Tagging `phase-N-complete` requires verify to pass. It makes the checkpoint falsifiable.

See `PATHWAY.md` for the full artefact evolution table.

## Before you start

`weeks/week-00-setup.md` is a 30-60 minute walkthrough covering Node 22, Claude Desktop, Anthropic API key with spend cap, backend choice, workbook instantiation, and a scaffold smoke test.

## Start here

1. Read `REPO-ARCHITECTURE.md` — the textbook/workbook split.
2. Read `PATHWAY.md` — artefact-dependency map and evolution table. Worth 5 minutes before you commit to 12 weeks.
3. Work through `weeks/week-00-setup.md`.
4. Open `weeks/week-01.md`.

When you're drafting a memo or ADR and unsure of the shape, `templates/examples/` has worked examples.

## Cost expectation

Over the full 12 weeks, budget **$20-50** in Anthropic API spend on Sonnet-tier, dominated by eval reruns in Weeks 3, 9, and 11. Set a monthly cap on your API key now.

Cloud deployment in W8 is optional. Cloud Run has a generous free tier; running the full 12-week cloud track on your own account is typically under $5. You can complete every week with zero cloud spend by staying on the local track.

## View as a local site

The repo includes an Astro Starlight site that presents the curriculum with a sidebar, dark mode, and local search (pagefind). Markdown in this repo stays authoritative — the site is a generated view over it.

```bash
cd docs-site
pnpm install      # or npm install
pnpm dev          # or npm run dev
```

Open <http://localhost:4321>. Build a static copy with `pnpm build` (output in `docs-site/dist/`). See `docs-site/README.md` for details.

### Publish on GitHub Pages

A workflow at `.github/workflows/pages.yml` builds and deploys on every push to `main`. One-time: in **Settings → Pages**, set **Source** to **"GitHub Actions"**. No config edits needed.

## Licence

MIT. Fork, modify, teach from it. Attribution appreciated but not required.
