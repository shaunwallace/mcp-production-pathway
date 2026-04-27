---
title: Pathway map
description: How the 12-week pathway fits together — dependencies, artefact evolution, and quality gates.
---

# Pathway map

One-page overview of how the 12-week pathway fits together: what each week produces, which artefacts feed which later weeks, and the quality gates that make each evolution visible. If you're tempted to skip a week, read this first — most weeks have downstream dependencies, and the gaps show up as stalls two or three phases later.

## Release cadence

The pathway is released iteratively. **Weeks 1-3 are live.** Weeks 4-12 ship as outlines today (stable structure, terse prose) and fill out over time. The shape is load-bearing and won't change; the depth inside each week is what grows.

## The spine

```
  PHASE 0        PHASE 1              PHASE 2         PHASE 3        PHASE 4         PHASE 5              PHASE 6
  Mental model   Build + measure      Protocol        Identity       Deploy          Scale                Security
  Wk 1           Wk 2-3               Wk 4-5          Wk 6-7         Wk 8-9          Wk 10-11             Wk 12
```

Three memos across the pathway: **Phase 0** (why MCP, Week 1), **Phase 3** (identity + tenancy, Week 7), **Phase 6** (security + close-out, Week 12). ADRs accrete at every architectural decision. The progress log in `progress.md` is append-only across all weeks.

## Artefact evolution

Five artefacts grow deliberately across the pathway, plus a consumer README and a runbook that start mid-pathway. The per-phase tables below are the single place to see how your workbook accumulates capability. Empty cells (—) mean the artefact doesn't change that week.

### Phase 1 — Build and measure (W2-3)

| Artefact | W2 | W3 |
|---|---|---|
| **Server** | stdio, 4-6 tools + 1 resource | — |
| **Harness** | tool-use loop, ~40 lines | +eval mode |
| **Eval set** | — | 12-20 cases |
| **CI workflow** | — | vitest + evals + dependabot |
| **Error taxonomy** | canonical shape | — |
| **Consumer README** | stub: tools list | — |

### Phase 2 — Protocol (W4-5)

| Artefact | W4 | W5 |
|---|---|---|
| **Server** | HTTP + hardening (Origin/Host, body limits, timeouts, idempotency keys) | +Postgres-backed sessions, +event log persistence, +progress/cancellation, +prompts, +roots |
| **Harness** | +HTTP client, +`Idempotency-Key` per write | +resume from Postgres, +prompts/list+get, +roots advertise, +cancel-on-Ctrl-C |
| **Eval set** | +HTTP regression, +transport-edge cases | +session resumption, +prompts, +completion, +roots, +cancellation |
| **docker-compose** | — | server + Postgres + migrate one-shot |
| **Error taxonomy** | unchanged (6 codes; transport folds into `backend_failure` with `details.cause`) | unchanged (roots → `forbidden`, cancel → `backend_failure`, both via `details.cause`) |
| **Consumer README** | +HTTP endpoint, +session lifecycle | +prompts, +roots |
| **THREATS.md** | new: Origin/Host, body-size, idempotency | +path traversal (roots), +session fixation |

### Phase 3 — Identity (W6-7)

| Artefact | W6 | W7 |
|---|---|---|
| **Server** | +RS role: PRM (RFC 9728), JWT validation w/ `aud` (RFC 8707), `WWW-Authenticate` discovery, scope enforcement, API-key fallback, audit log (plain JSONL) | +tenant resolution from JWT, +app-layer + RLS scoping, +per-tenant quota (token bucket), +hash-chained audit log |
| **Harness** | static token from `MCP_TOKEN` (server validation is the W6 focus) | +DCR (RFC 7591), +full PKCE flow, +`resource=` on authorize/token/refresh, +401-driven re-auth |
| **Local issuer** | new: discovery (RFC 8414), authorize w/ PKCE, token w/ `aud`, refresh-rotation w/ reuse detection (revokes family), revoke (RFC 7009), introspect (RFC 7662) | +`/register` (RFC 7591), tenant claim in issued tokens |
| **Eval set** | rerun phase-1 under auth, +missing-token, +expired, +wrong-audience, +insufficient-scope | +three-tenant duplicated phase-1 (isolation), +`tenancy.cross_tenant_leak`, +`quota.exceeded.gracefully`, +`dcr.first_connect` |
| **docker-compose** | +local-issuer service | +`audit-verify` cron service |
| **Error taxonomy** | unchanged (6 codes; auth folds into existing codes via `details.cause`) | unchanged (`rate_limited` carries `details.retry_after_ms`) |
| **Consumer README** | +Authentication section (PRM URL, scopes, API-key issuance) | +DCR subsection, +`Retry-After` semantics |
| **THREATS.md** | +token replay across servers, +JWT alg confusion, +stolen refresh token, +API-key leakage | +cross-tenant leak, +tenant impersonation, +quota bypass burst, +audit mutation (w/ tamper-evident-vs-tamper-proof gap), +rogue DCR |
| **Memos** | — | `02-identity-and-tenancy.md` (~800 words) |

### Phase 4 — Deploy (W8-9)

| Artefact | W8 | W9 |
|---|---|---|
| **Server** | +multi-stage container (digest-pinned, non-root), +`/health` + `/ready`, +SIGTERM drain, +deadline propagation (AsyncLocalStorage + AbortController), +retry budget w/ jittered backoff, +circuit breakers, +per-backend bulkheads, +unified idempotency store (transport + write tools), +response-size truncation, +pagination contract on `list_*` | +OTel SDK bootstrap, +`instrument()` rewritten to spans+metrics, +`prom-client` `/metrics`, +`mcp_tool_cost_usd` histogram (vehicle for W10), +pino `trace_id`/`span_id` mixin, +`redactForSpan` PII guard |
| **Harness** | +`X-Request-Deadline-Ms`, +honour `Retry-After` from `rate_limited`, +cursor-paginated `list_*` calls | +`traceparent` extraction, +Jaeger URL on eval failures, +client-side parent span |
| **Eval set** | unchanged | +`tracing.span_attrs_present`, +`tracing.no_pii_in_attrs` |
| **docker-compose** | +built image (pinned Postgres major), +file-mount secrets | +Jaeger, +Prometheus, +Grafana (provisioned dashboards), +Alertmanager (rule files) |
| **CI workflow** | +image build, +`npm audit` (moderate), +Trivy scan (HIGH/CRITICAL gate), +GHCR push w/ SHA + date tags | +`scripts/check-log-schema.mjs`, +`amtool check-config` |
| **Error taxonomy** | unchanged (6 codes; deadline → `backend_failure` w/ `details.cause: "deadline_exceeded"`, circuit-open → `backend_failure`, retry-budget → `rate_limited`, truncation → `structuredContent.truncated`) | unchanged (`mcp.error.code` added as span attribute) |
| **Observability artefacts** | — | new: `server/src/log-schema.json`, `observability/grafana/dashboards/mcp-overview.json`, `observability/alertmanager/rules.yml` |
| **RUNBOOK.md** | created: SLOs (with explicit numbers), SLO-breach playbook, rollback, secret-rotation, first-30-minutes checklist | +trace-debug recipes (alert → runbook → Grafana → Jaeger chain) |
| **Consumer README** | +`docker run` one-liner / deployed URL, +pagination contract, +truncation signal | — |
| **THREATS.md** | +resource exhaustion (slow-loris via long deadlines), +retry amplification | +PII via span attributes (looser auth than logs) |

### Phase 5 — Scale (W10-11)

| Artefact | W10 | W11 |
|---|---|---|
| **Server** | +tool-result cache (annotation-gated, tenant + version in key, fail-open), +`tool.version` strings, +cost-attribution helper writing `mcp_tool_cost_usd` + span event, +worked `search_issues` → `search_issues_v2` rename | — |
| **Harness** | +Anthropic prompt caching (2 breakpoints: system, tools-end), +per-case cost from `usage`, +CSV cost report artefact, +cost delta vs baseline | +concurrent mode, +sampling responder, +elicitation responder |
| **Eval set** | +`max_cost_usd` + `max_latency_ms` budgets on canonical cases, +`cache.no_cross_tenant` case | +sampling/elicitation cases under load, +latency budgets at p95 under 50 concurrent |
| **Contract tests** | new: golden files at `test/golden/tools/<name>@<version>.json`; CI fails on schema drift | unchanged |
| **docker-compose** | +optional Redis (commented; ADR-gated) | +k6 one-shot, +k6 Prometheus remote-write |
| **CI workflow** | +cost report artefact, +PR-comment cost diff, +contract-test job | +scheduled nightly load test |
| **Error taxonomy** | unchanged (6 codes; cache outage → `backend_failure` w/ `details.cause: "cache_unavailable"`, fail-open is the default path) | unchanged |
| **RUNBOOK.md** | +cost-anomaly playbook (cost spike → tenant → tool → cache-miss check → version-bump check) | +load-incident playbook, +sampling-cost-incident playbook |
| **THREATS.md** | +cross-tenant cache leak (mitigated by tenant in key + RLS defence in depth) | +sampling abuse (confused-deputy variant) |
| **Tool-versioning policy** | new: additive-only same name + version bump; breaking → new tool name; deprecation window | unchanged |

### Phase 6 — Security (W12)

| Artefact | W12 |
|---|---|
| **Server** | +input hardening, +PII policy |
| **Harness** | +injection eval |
| **Eval set** | +injection cases |
| **CI workflow** | +security scan |
| **Error taxonomy** | +injection-attempt flags |
| **RUNBOOK.md** | +security incident |
| **Consumer README** | +SLA language |

By W12, `docker compose up` brings up your full production-shaped stack locally. That's not a bonus — it's the W12 checkpoint.

## Quality gate pattern

Every tracked-artefact change uses the same five-part block inside the week that introduces it:

```
Before: <artefact state at end of previous week>
Change: <specific edit, with file paths>
After:  <new state>
Verify: <exact command + expected output>
Enables: <one sentence forward-reference>
```

Phase boundaries have a single `make verify` acceptance gate — full test suite, full eval suite, health check against the local compose stack. Tagging `phase-N-complete` requires verify to pass. This makes the checkpoint falsifiable, not just ceremonial.

## Artefact dependency chain

Each arrow is a dependency: the right-hand artefact cannot exist without the left-hand one.

```
Week 1 memo (00-why-mcp)
  └─ revisited in Week 12 (security lens on the original recommendation)

Week 2 tool definitions + resource
  ├─ subjected to evals in Week 3 (pass/fail drives iteration)
  ├─ ported to HTTP in Week 4 (same tools, new transport)
  └─ versioned carefully in Week 10 (schema changes without breaking consumers)

Week 2 instrument() wrapper
  └─ replaced by OpenTelemetry spans in Week 9 (same shape, new backend)

Week 2 harness
  ├─ eval mode added in Week 3
  ├─ HTTP transport + idempotency keys added in Week 4
  ├─ reconnect + prompts + roots + cancellation in Week 5
  ├─ OAuth (PKCE) client added in Week 7
  ├─ cost capture in Week 10
  ├─ concurrency, sampling responder, elicitation responder in Week 11
  └─ adversarial prompts in Week 12

Week 2 test suite (vitest + MSW)
  ├─ wired into CI in Week 3
  └─ extended with contract tests after every backend change

Week 3 eval dataset
  ├─ rerun as regression guard in Week 4 (did HTTP break selection?)
  ├─ rerun under auth in Week 7
  ├─ rerun under tracing in Week 9 (do spans show the same pass rate?)
  ├─ extended with cost and latency budgets in Week 10-11
  └─ extended with adversarial prompts in Week 12

Week 3 CI workflow
  ├─ image build and npm audit in Week 8
  ├─ cost report in Week 10
  ├─ scheduled load test in Week 11
  └─ security scan in Week 12

Week 5 persistence layer + compose file
  ├─ tenant data model in Week 6-7
  ├─ session store behind auth in Week 8
  ├─ traced DB calls in Week 9
  ├─ cost data store in Week 10
  └─ load-test target in Week 11

Week 6-7 OAuth + tenancy + audit
  ├─ deployed behind auth in Week 8
  ├─ authenticated calls traced in Week 9
  ├─ per-tenant cost attribution in Week 10
  └─ tenant isolation scrutinised in Week 12

Week 8 container + SLOs + runbook
  ├─ Week 9's tracing and metrics measure adherence
  ├─ Week 10's caching changes what the SLOs allow
  └─ Week 11's load test defends them

Week 9 OTel spans + metrics
  ├─ cost attribution reads them in Week 10
  └─ bottleneck evidence for Week 11's load tests
```

## What compounds

Four artefacts carry the most weight across the whole pathway:

1. **The eval dataset** (built Week 3, extended every subsequent phase). The regression guard for everything. A team that ships MCP without this will find their reliability problem in production; a team that has this can change transports, migrate clouds, or rotate models and catch regressions in minutes.

2. **The harness** (built Week 2, extended every week). The single piece of infrastructure that tells you what actually happens when a real LLM uses your server. Keep it under 300 lines forever; if it starts to feel like an agent framework, cut.

3. **The docker-compose file** (introduced Week 5, grown every phase). Your local production stack. By Week 12, it's the difference between "I read about MCP in production" and "I can bring up an MCP production stack on my laptop in 30 seconds."

4. **The ADRs** (one per architectural choice). The log becomes a defensible record of decision-making. The habit is more valuable than any individual ADR.

## If you're short on time

Priority order for a time-constrained learner:

1. **Weeks 1-3** (mental model, first server, evals, CI). Even alone, this is more than most production MCP teams have done. Tag `phase-1-complete` and stop here if you need to; the rest is still reachable later.
2. **Weeks 6-7** (OAuth + tenancy) and **Weeks 8-9** (containerised deploy + OTel). The production readiness spine. Skipping either leaves you with a toy.
3. **Week 12** (security). Even a 2-hour threat-model pass is worth far more than zero.
4. **Weeks 4-5** (protocol internals) and **Weeks 10-11** (cost + load). Important, but recoverable later if you know the Phase 1 and Phase 3-4 material cold.

## When the pathway fails you

It will. You'll hit a backend edge case, a model rotation, a library version change, or a concept that doesn't click. Three places to go:

- **The spec** is always the authority: <https://modelcontextprotocol.io/specification>
- **MCP GitHub Discussions** for protocol-level questions: <https://github.com/orgs/modelcontextprotocol/discussions>
- **Your own memos and ADRs** — re-read them; often the blocker is a constraint you articulated two phases ago and then forgot.

If the pathway itself is wrong, open an issue against the public repo. It's a living document.
