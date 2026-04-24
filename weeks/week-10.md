---
title: Week 10 — Caching, cost attribution, tool versioning (Phase 5, part 1)
status: outline
---

# Week 10 — Caching, cost attribution, tool versioning (Phase 5, part 1)

> **Outline — full week ships in a future release.** Structure below is stable.

**Time budget (planned):** 8 to 12 hours.

## Objectives

- Add two layers of caching: Anthropic **prompt caching** in the harness, and **tool-result caching** in the server for deterministic reads.
- Attribute cost per session, per tool, per tenant using the trace attributes from Week 9.
- Handle **tool schema versioning** — change a tool's shape without breaking deployed consumers.
- Extend the eval set with cost and latency budgets; CI fails if a change blows a budget.

## Tooling additions

- Anthropic prompt caching via the SDK's `cache_control` parameter
- `lru-cache` or `keyv` for in-process tool-result caching (for deterministic reads)
- Optional: Redis in compose for a production-shape cache. Canonical choice is in-process unless tenancy forces a shared cache.

## Reading list (planned)

- Anthropic prompt caching docs
- Practitioner post on cache keys with tenant scoping (hint: tenant ID is part of every cache key)
- One post on semver-for-APIs vs. non-breaking evolution strategies

## Planned canonical code example

- `harness/src/cost.ts` — capture input/output tokens per message, compute USD per case, group by tool/tenant
- `server/src/cache/tool-result.ts` — keyed by `(tenant, tool_name, tool_version, args_hash)`, TTL-per-tool
- `evals/phase-5-budgets.jsonl` — new eval cases with `max_cost_usd` and `max_latency_ms` fields
- `server/src/tools/versioning.md` — notes on the versioning policy (additive-only for fields, new tool name for breaking changes)

## Artefact evolution (planned gates)

### Evolution: harness

- **Before (end of W9):** runs evals, prints pass/fail and latency.
- **Change:** add cost capture from response.usage; apply Anthropic prompt caching on system prompts and tool definitions; print cost per case and totals.
- **After:** eval report includes cost column; cache-hit rate visible.
- **Verify:** rerun evals; second run shows >50% cache hit on the model side; cost per case drops measurably.
- **Enables:** W11 cost-at-scale modelling multiplies these per-call costs.

### Evolution: server

- **Before (end of W9):** every tool call hits the backend.
- **Change:** tool-result cache for deterministic reads (search, list, read); cache key includes tenant and a tool-version string.
- **After:** repeated calls with identical args return cached results until TTL; cache bypassed for writes; cache-hit metric exposed.
- **Verify:** call `search_issues` twice with identical args; second call's duration span shows `cache.hit=true` attribute.

### Evolution: eval set

- **Before:** tool-selection + transport + auth cases.
- **Change:** add budgets — `max_cost_usd` and `max_latency_ms` on a subset of cases.
- **After:** eval runner enforces budgets; regression fails CI.

### Evolution: CI workflow

- **Change:** eval job writes a cost report artefact; PR comment shows cost delta vs. baseline.

### Evolution: tool versioning (new discipline)

- **Convention adopted this week:** tool inputSchema changes follow additive-only rules. Breaking changes require a new tool name (`search_issues_v2`) with deprecation noted in the description. Both versions coexist until the eval set migrates off the old one.

## Checkpoint (planned)

- [ ] Prompt caching active on harness; hit rate visible
- [ ] Tool-result cache active for deterministic reads with tenant-scoped keys
- [ ] Cost per session / tool / tenant attributable from traces
- [ ] Cost + latency budgets enforced in at least 3 eval cases
- [ ] One worked example of a tool schema change under the versioning policy
- [ ] `git tag week-10-complete`

## ADR candidates

- Tool-result cache scope (per tenant, per user, global)
- Cache eviction policy
- Tool-version deprecation cadence
