---
title: Week 10 — Caching, cost attribution, tool versioning, contract tests (Phase 5, part 1)
description: Two layers of caching, cost as a first-class metric tied to traces, an explicit tool-versioning policy, and contract tests that prove a deployed consumer still works after you change the schema.
---

# Week 10 — Caching, cost attribution, tool versioning, contract tests (Phase 5, part 1)

W9 made cost *measurable* by registering the histogram. W10 makes it *attributable* — per session, per tool, per tenant — and then makes it *smaller* via two complementary cache layers. The other half of the week is the part teams under-invest in: the explicit policy and tests that let you change a tool's shape without breaking the consumers calling it.

**Time budget:** 8 to 12 hours.

## Objectives

- Add **prompt caching** in the harness via Anthropic's `cache_control` — system prompt + tool definitions become a cache breakpoint, dropping per-call input cost by 80–90%.
- Add **tool-result caching** in the server for deterministic reads, keyed on `(tenant, tool, version, args_hash)` with per-tool TTLs.
- Attribute **cost per session, per tool, per tenant** by writing into the W9 `mcp_tool_cost_usd` histogram with a span event capturing the breakdown.
- Adopt an **explicit tool-versioning policy** — additive-only for `inputSchema`, new tool name for breaking changes — and exercise it via a worked rename.
- Stand up **contract tests** that pin tool schemas in golden files so a non-additive change is rejected at PR time.
- Extend the eval set with **cost and latency budgets**; CI fails on regression with a concrete diff.
- Append a **cost-anomaly playbook** to `RUNBOOK.md`.

## Why this week exists

Three things teams underestimate about MCP cost and contracts:

1. **Prompt caching is the largest single lever.** A tool definition list of 6 tools with descriptions is ~3k tokens. At 50 calls per session, uncached, that's 150k tokens of pure overhead. Anthropic prompt caching turns 150k into ~15k. Free 10× on input cost; the only thing standing in the way is one parameter on the API call.
2. **"Cost per request" is the wrong unit.** The bill is per *session* or per *tenant*; the traces are per *call*. Without an explicit aggregation that joins them, you'll spend a quarter being unable to answer "which tenant cost us the most last month?"
3. **Tool schemas drift silently.** A field marked optional in dev becomes required in prod; a consumer in another team's repo breaks; nobody notices for two weeks because the change passed every test in *your* repo. Golden contract tests are the cheap fix.

## Tooling additions

- **Anthropic prompt caching** via `cache_control` on the SDK's `messages.create`. Built into the SDK, no library required.
- **`lru-cache`** for in-process tool-result caching. Alternative: [`keyv`](https://github.com/jaredwray/keyv) (multiple backends, same API — tradeoff: thinner observability hooks).
- **Optional Redis** in compose for a shared cache when replicas > 1. Default stays in-process; the ADR records when to migrate.
- **`@hyperjump/json-schema`** for runtime schema validation in contract tests. Alternative: `ajv` (faster — tradeoff: less faithful to JSON Schema 2020-12).
- **`csv-stringify`** for the cost report artefact (PR comment renders it as a table).

## Reading list

- [Anthropic prompt caching docs](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching) — read the section on cache breakpoints carefully; their order matters.
- [Hamel Husain on LLM cost models](https://hamel.dev/blog/posts/evals/) — the practitioner reference for thinking about evals + cost together.
- [Stripe API versioning](https://stripe.com/blog/api-versioning) — canonical post on additive evolution; map it onto MCP tool schemas.
- [Pact contract testing](https://docs.pact.io/) — broader than what this week ships, but the *concept* of consumer-driven contracts is what we're approximating with golden files.
- [Eugene Yan on caching for LLM systems](https://eugeneyan.com/writing/llm-patterns/) — practical patterns; the section on "deterministic reads" frames the W10 cache layer.

## Canonical code

### Prompt caching in the harness

Anthropic prompt caching is opt-in per content block. The right shape:

```typescript
// harness/src/anthropic-call.ts
const response = await client.messages.create({
  model: "claude-sonnet-4-6",
  max_tokens: 4096,
  system: [
    {
      type: "text",
      text: SYSTEM_PROMPT,
      cache_control: { type: "ephemeral" }, // 5-minute cache TTL
    },
  ],
  tools: tools.map((t, i) => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema,
    // Cache the *last* tool block — caches everything before it as one breakpoint.
    ...(i === tools.length - 1 ? { cache_control: { type: "ephemeral" } } : {}),
  })),
  messages,
});

// usage now includes cache_creation_input_tokens and cache_read_input_tokens
// — both billed differently from regular input_tokens.
```

Two breakpoints: one before the system prompt block (cached separately so a tool-list edit doesn't bust the system cache), one after the tools (so the tool list is a cache hit on every subsequent call within 5 minutes). The harness logs cache-hit ratio per run.

The pricing math, written into `cost.ts`:

```typescript
// harness/src/cost.ts
const PRICING = {
  // Per million tokens. Sonnet 4.6 numbers as of 2026-04; check before relying.
  "claude-sonnet-4-6": {
    input:               3.00,
    output:             15.00,
    cache_creation:      3.75, // 1.25× input; written once per breakpoint.
    cache_read:          0.30, // 0.1× input; the actual savings.
  },
};

export function costUsd(usage: Anthropic.Usage, model: string): number {
  const p = PRICING[model] ?? PRICING["claude-sonnet-4-6"];
  return (
    (usage.input_tokens             * p.input          ) / 1_000_000 +
    (usage.output_tokens            * p.output         ) / 1_000_000 +
    (usage.cache_creation_input_tokens * p.cache_creation) / 1_000_000 +
    (usage.cache_read_input_tokens     * p.cache_read    ) / 1_000_000
  );
}
```

A printable cost report after each run:

```
EVAL    TOOL              TOKENS_IN  TOKENS_OUT  CACHE_HIT%  COST_USD  LATENCY_MS
search  search_issues       18,400        420       91%      0.0073        842
read    get_issue            6,100        180       89%      0.0021        315
...
TOTAL                      241k         9.8k       89%       0.094        — 
```

### Tool-result cache in the server

Deterministic reads (`get_*`, `list_*` with same args) are obvious cache candidates; mutations (`create_*`, `update_*`, `close_*`) are obviously not. The W2 tool annotations make this mechanical:

```typescript
// server/src/cache/tool-result.ts
import { LRUCache } from "lru-cache";

const cache = new LRUCache<string, CachedResult>({
  max: 10_000,
  ttl: 60_000, // default 60s; per-tool override below
});

// Per-tool TTLs declared next to the tool, not centrally.
// list_issues changes often; get_user changes rarely.
const TTL_OVERRIDES: Record<string, number> = {
  get_user:        15 * 60_000,
  list_repos:       2 * 60_000,
  search_issues:   30_000,
};

export function withResultCache(tool: ToolDef): ToolDef {
  // Only cache tools the W2 annotations declare safe.
  if (!tool.annotations?.readOnlyHint || !tool.annotations?.idempotentHint) {
    return tool;
  }
  const handler = tool.handler;
  return {
    ...tool,
    handler: instrument(tool.name, async (args) => {
      const tenant = currentTenant() ?? "anon";
      const key = `${tenant}:${tool.name}:${tool.version}:${sha256(JSON.stringify(args))}`;
      const hit = cache.get(key);
      if (hit) {
        trace.getActiveSpan()?.setAttribute("cache.hit", true);
        return hit.value;
      }
      const value = await handler(args);
      cache.set(key, { value }, { ttl: TTL_OVERRIDES[tool.name] });
      trace.getActiveSpan()?.setAttribute("cache.hit", false);
      return value;
    }),
  };
}
```

Three load-bearing details:

1. **Tenant in the key.** Forgetting this is the canonical multi-tenant cache bug — Tenant A's cached result returned to Tenant B. Cross-references W7 RLS: even if the cache leaked, RLS would catch the actual DB read; defence in depth.
2. **Tool version in the key.** When a tool's behaviour changes under the same name (rare, but happens for non-schema reasons — e.g. swapping the backend ranking), the version bump invalidates all cached results.
3. **Annotation-gated.** A new write tool added without `readOnlyHint: true` will not be cached. The default is safe; opting in is the deliberate act.

The cache-hit attribute on the span makes `histogram_quantile(0.95, sum by (le, cache_hit) (rate(mcp_tool_duration_seconds_bucket[5m])))` a one-line Grafana panel.

### Cost attribution per (tool, tenant, session)

W9 registered the histogram. W10 populates it:

```typescript
// server/src/cost-attribution.ts
import { metrics } from "./telemetry/metrics.js";

// Called from the harness side via a `tool-cost` span event the harness emits;
// the server reads its own usage too via a span event in the sampling tool (W11).
export function recordToolCost(
  tool: string,
  tenant: string,
  usd: number,
  breakdown: { input_tokens: number; output_tokens: number; cache_read: number },
) {
  metrics.toolCostUsd.observe({ tool, tenant }, usd);
  trace.getActiveSpan()?.addEvent("cost.attributed", {
    "cost.usd":            usd,
    "cost.input_tokens":   breakdown.input_tokens,
    "cost.output_tokens":  breakdown.output_tokens,
    "cost.cache_read":     breakdown.cache_read,
  });
}
```

The Grafana cost panel then has three queries:

```
# Cost rate per tool
sum by (tool) (rate(mcp_tool_cost_usd_sum[5m]))

# Cost rate per tenant
sum by (tenant) (rate(mcp_tool_cost_usd_sum[5m]))

# p95 cost per call (rare but useful for spotting expensive outliers)
histogram_quantile(0.95, sum by (le, tool) (rate(mcp_tool_cost_usd_bucket[5m])))
```

A learner who reaches W10 can answer, in 30 seconds, "which tenant consumed 60% of yesterday's API budget?" — that's the bar.

### Tool versioning policy

The policy is short and exercised, not aspirational:

> **Additive-only changes** — adding optional fields, adding enum values to a non-required field, relaxing a constraint — keep the same tool name and bump a `version` string in the tool definition. Caches use the version, evals don't care.
>
> **Breaking changes** — removing a field, making an optional field required, tightening a constraint, renaming, semantic changes that don't show in the schema — require a new tool name. The old tool stays registered for at least one release with `description` prefixed `[DEPRECATED — use <new>]`. The eval set migrates incrementally; both versions appear in production for the deprecation window.

Worked example committed to the workbook: `search_issues` is renamed to `search_issues_v2` because the response shape changed (added `repository` field; old consumers parsed by index). Both tools coexist; the eval set has cases for both; the W3 eval pass rate stays green throughout the migration.

### Contract tests with golden files

Pin every tool schema:

```typescript
// server/test/contract.test.ts
import { describe, it, expect } from "vitest";
import { tools } from "../src/tools/index.js";
import fs from "node:fs";

describe("tool contracts are stable", () => {
  for (const tool of tools) {
    it(`${tool.name}@${tool.version} matches golden`, () => {
      const goldenPath = `test/golden/tools/${tool.name}@${tool.version}.json`;
      const observed = JSON.stringify(
        { name: tool.name, description: tool.description, inputSchema: tool.inputSchema, annotations: tool.annotations },
        null, 2,
      );
      if (!fs.existsSync(goldenPath)) {
        // First-write convenience; CI fails because the file isn't tracked yet.
        fs.writeFileSync(goldenPath, observed);
      }
      const golden = fs.readFileSync(goldenPath, "utf8");
      expect(observed).toEqual(golden);
    });
  }
});
```

A change that would alter the schema produces a failing test. The fix is one of two PRs:

1. **Additive change** — bump the version: `search_issues@1` → `search_issues@2`, write a new golden file, leave the old one alone (eval cases at `@1` keep passing).
2. **Breaking change** — register a new tool: `search_issues_v2`, both goldens coexist, ADR records the deprecation date.

There is no third option. The test forces the conversation.

### Cost + latency budgets in evals

Eval cases gain optional budgets:

```jsonl
{"prompt": "find open auth bugs", "expected_tool": "search_issues", "max_cost_usd": 0.02, "max_latency_ms": 2000}
{"prompt": "summarise PR #492", "expected_tool": "summarise_thread", "max_cost_usd": 0.05, "max_latency_ms": 5000}
```

The eval runner fails the case if either budget is exceeded:

```
FAIL  search_issues       cost=$0.0312 (budget $0.02) — investigate cache miss
FAIL  summarise_thread    p95 latency 5800ms (budget 5000ms) — backend regression?
```

CI surfaces both as a comment on the PR with a diff against `main`'s last passing run.

## Artefact evolution

### Evolution: server

- **Before (end of W9):** observability spine in place; every tool emits spans + metrics; cost histogram registered but unpopulated.
- **Change:** tool-result cache wraps every annotation-gated `readOnlyHint + idempotentHint` tool; cache-hit set as a span attribute; tool definitions gain a `version` string; cost-attribution helper writes into the W9 histogram and adds a span event.
- **After:** repeated reads return cached results until TTL; cost panel in Grafana groups by tool and tenant with no extra plumbing.
- **Verify:**
  1. Call `search_issues` twice with identical args; second call's span has `cache.hit=true`.
  2. `curl localhost:8080/metrics | grep mcp_tool_cost_usd` shows samples.
  3. Tool-versioning rename drill: rename `search_issues` to `search_issues_v2`, both registered, contract test still passes for both.
- **Enables:** W11 cost-at-scale modelling reads `mcp_tool_cost_usd` directly; W11 sampling tool's cost shows up alongside regular tools without code changes.

### Evolution: harness

- **Before (end of W9):** structured logs with trace_id; honour `Retry-After`.
- **Change:** prompt caching enabled with two breakpoints (system + tools); cost-per-case computed from `usage`; cost report emitted as CSV artefact; cost delta vs baseline printed at end.
- **After:** harness shows cache-hit rate and per-case cost; second run with warm cache shows ~10× lower input cost.
- **Verify:** cold run + warm run within 5 minutes; warm run's `cache_read_input_tokens` is >80% of `input_tokens` on the third+ message.

### Evolution: eval set

- **Before (end of W9):** functional + transport + auth + tenancy + observability cases.
- **Change:** add `max_cost_usd` and `max_latency_ms` to the canonical 12-20 cases; CI fails the build if either budget is exceeded.
- **After:** eval reruns are also cost regressions; a tool that starts using sampling silently in W11 is caught by the cost budget, not by code review.

### Evolution: CI workflow

- **Before:** vitest + evals + image build + Trivy + log-schema check + Alertmanager rule check.
- **Change:** eval job emits `cost-report.csv` as an artefact; PR-comment action posts the cost diff vs. `main` baseline; contract-test job runs `tools/golden/*.json` comparison.
- **After:** every PR shows a cost delta and a contract-test status before merge.

### Evolution: docker-compose

- **Change:** add an optional `redis` service (commented-out by default) for the future shared-cache scenario; document the trade in the ADR rather than enabling it by default.

### Evolution: error taxonomy

- **Before (end of W9):** six codes; failure modes via `details.cause`.
- **Change:** unchanged. A cache backend failure folds into `backend_failure` with `details.cause: "cache_unavailable"`; the cache layer fails *open* (degrades to direct backend call) — recorded via a span event.
- **After:** still six codes.

### Evolution: RUNBOOK.md

- **Before (end of W9):** SLOs, breach playbook, rollback, secrets, first-30-minutes, trace-debug recipes.
- **Change:** add a **cost-anomaly playbook** — what to do when the cost panel shows a sudden 5× spike. Steps: identify the tenant via the `tenant` label, identify the tool via the `tool` label, jump to traces, look for cache-miss attribute, check whether a recent deploy bumped a tool version (busting the cache), check whether sampling-using tools (W11) are being hit unusually often.
- **After:** cost incidents have a documented response.

### Evolution: THREATS.md

- **Change:** add **cross-tenant cache leak** — a malformed cache key omitting tenant returns Tenant A data to Tenant B. Mitigated by tenant in the key + RLS as defence in depth + an eval case (`cache.no_cross_tenant`) that calls the same tool from two tenants and asserts the cached result is not shared.

## Common pitfalls

:::caution[Five ways this week goes sideways]
1. **Caching writes.** The cache wrapper without the annotation gate happily caches `create_issue` once. Subsequent calls return the first issue's ID for *every* request. Annotation-gating is non-negotiable.
2. **Forgetting tenant in the cache key.** Single most-common multi-tenant bug. Bake it into the key construction helper, and add a contract test that fails if the key construction can be called without a tenant.
3. **Cache-busting on every deploy.** A tool-result cache keyed on `tool.version`, where `tool.version` is `pkg.json` version, busts every cache on every deploy. Version the *tool*, not the package; bump the tool version only when behaviour changes.
4. **Unbounded LRU.** `LRUCache` without `max` is a memory leak with extra steps. Cap it; observe the `cache.size` gauge; alert when it stays at the cap (eviction pressure means the cap is too small).
5. **Over-aggressive prompt cache breakpoints.** Three breakpoints sounds better than two; it isn't. Each breakpoint costs cache-creation tokens. Two well-placed breakpoints (system, tools-end) are optimal for almost all MCP shapes.
:::

## Checkpoint

- [ ] Anthropic prompt caching active with two breakpoints; cache-hit rate >80% on warm runs
- [ ] Tool-result cache wraps every read tool; tenant + version in every key
- [ ] `cache.hit` span attribute populated on every cached call
- [ ] `mcp_tool_cost_usd` histogram populated; cost panels in Grafana group by tool and tenant
- [ ] Cost report artefact emitted by CI; PR comment shows delta vs baseline
- [ ] Tool-versioning policy documented in `server/src/tools/versioning.md`
- [ ] Worked rename committed: `search_issues@1` → `search_issues_v2`, both coexist
- [ ] Golden contract tests cover every tool; CI fails on schema drift
- [ ] Cost + latency budgets on at least 3 eval cases; CI fails on regression
- [ ] Cache fails open: a cache outage degrades to direct backend, not error
- [ ] `RUNBOOK.md` extended with cost-anomaly playbook
- [ ] `THREATS.md` extended with cross-tenant-cache-leak row
- [ ] `git tag week-10-complete`

## Leadership lens

- **Justifying the cache investment**: "Prompt caching alone is an 8–10× input-cost reduction with one parameter on the API call. Tool-result caching is another 30–50% reduction on read-heavy workloads. The combined effect on the W11 cost-at-scale model is order-of-magnitude. The work is two days; the savings compound over the lifetime of the service."
- **Defending the additive-only policy**: "A breaking schema change feels like the right answer; it costs us a quarter every time we ship one. Consumers in other teams pin to a release; their next sync breaks; we burn three engineer-weeks coordinating. The new-tool-name policy is mechanical: there's no judgement call, no Slack thread, no surprise."
- **Talking about cost as an SLO**: "We're adding cost to the SLO list. p95 cost-per-tool-call has a budget; a deploy that blows it gets reverted the same way a latency regression does. Cost is operationally visible now; it has to be operationally enforceable."

## ADR candidates

- **Cache scope** (per-tenant vs per-user vs global) — defaults per-tenant; a global cache for read-only public-data tools (e.g. `get_public_repo`) is a worthwhile carve-out, but record the per-tool decision.
- **Cache eviction** (LRU vs LFU vs TTL-only) — defaults LRU + TTL; record the conditions under which LFU pays off (heavy long-tail workloads).
- **Cache backend** (in-process vs Redis) — defaults in-process; the trigger for migrating to Redis is "we have replicas and they cache the same hot keys 5+ times" (measured, not assumed).
- **Tool-version deprecation cadence** — how long the old tool stays registered after the new one ships. Defaults to one full release cycle (typically 30 days); records exceptions.
- **Cost-budget enforcement** (warn vs block) — first three months: warn-only with PR comment; after that: block on regression. Records the rationale and the date the gate flips.
- **Prompt-cache breakpoint placement** — where the breakpoints go and why. Reviewable in this single ADR rather than scattered across files.
- **Pricing-table source of truth** — pricing constants live in `harness/src/pricing.ts` with a date stamp. Records the policy: pricing is reviewed quarterly and on any model rotation.
