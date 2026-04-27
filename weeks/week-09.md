---
title: Week 9 — OpenTelemetry, traces, metrics, structured logs (Phase 4, part 2)
description: Replace the W2 instrument() wrapper with OpenTelemetry spans, expose RED metrics, commit a structured-log JSON Schema, ship Grafana dashboards as code, and wire SLO burn-rate alerts. The week the W8 SLOs become measurable.
---

# Week 9 — OpenTelemetry, traces, metrics, structured logs (Phase 4, part 2)

W8 made the server *survive*. W9 makes it *legible*. Every reliability primitive from W8 — deadlines, bulkheads, retries, truncation, idempotency — becomes a span attribute, a metric, or a log field this week. The W8 SLOs become measurements you can plot. The runbook gains links you can actually click during an incident.

**Time budget:** 8 to 12 hours.

## Objectives

- Replace the W2 `instrument()` wrapper with OpenTelemetry spans (preserving the same call sites — the upgrade should be mechanical).
- Expose RED metrics (rate, errors, duration) via `prom-client` at `/metrics`.
- Run a local observability stack in compose: Jaeger for traces, Prometheus for metrics, Grafana for dashboards, Alertmanager for alerts.
- Correlate **trace-ID into pino logs** via a single, audited field — every log line links to its trace.
- Commit a **JSON Schema for structured log lines**; CI validates a sample against it on every change.
- Ship **dashboards as code** (Grafana JSON committed to the repo, provisioned automatically).
- Wire **SLO burn-rate alerts** as Alertmanager rules — multi-window, multi-burn-rate per Google SRE workbook.
- Document the **PII-in-spans** failure mode and apply redaction at the span boundary.
- Emit **cost as a Prometheus histogram** so W10's attribution work has a measurement, not a derivation.
- Conduct at least one real trace-driven debugging session and append the recipe to `RUNBOOK.md`.

## Why this week exists

Two failure modes that this week prevents:

1. **Logs and traces disconnected.** A 3am page says "elevated p99." You open Jaeger, see slow spans, but the *log line* with the failing-tool input has no trace ID — so you can't connect the trace to the args that caused it. The fix is one field, audited, in every log line.
2. **Dashboards as folklore.** The team that knows the dashboard query language disappears; nobody else can answer "is this normal?" Dashboards-as-code make the queries reviewable, version-controlled, and reproducible. A new hire's first PR is "add a panel for X" — that's the bar.

A third, smaller one: PII leaks through span attributes more often than through logs, because logs have a redactor and spans usually don't. Catching this in W9, not W12, is cheaper.

## Tooling additions

- **`@opentelemetry/sdk-node`** + **`@opentelemetry/exporter-trace-otlp-http`** — canonical Node OTel.
- **`prom-client`** — Prometheus-format metrics exposed at `/metrics`. Alternative flagged: OTel metrics via OTLP (unified pipeline — tradeoff: metric tooling in OTel JS is less mature than tracing as of 2026).
- **Jaeger** (all-in-one image), **Prometheus**, **Grafana**, **Alertmanager** in `docker-compose.yml`.
- **`pino`** continues from W2; gains a `traceId` field via the OTel context.
- Optional cloud alt: Honeycomb, Datadog, Grafana Cloud — all consume OTLP, the code is identical, only the exporter endpoint changes.

## Reading list

- [OpenTelemetry JavaScript docs](https://opentelemetry.io/docs/languages/js/) — trace API, context propagation, manual spans.
- [OTel semantic conventions](https://opentelemetry.io/docs/specs/semconv/) — attribute naming. `mcp.*` is custom; `http.*`, `db.*`, `rpc.*` are not. Reuse where standardised.
- [Prometheus naming conventions](https://prometheus.io/docs/practices/naming/) — `_total` suffix on counters, `_seconds` on durations, base units only.
- [Google SRE workbook — alerting on SLOs](https://sre.google/workbook/alerting-on-slos/) — the multi-window multi-burn-rate pattern.
- [Charity Majors on observability vs monitoring](https://charity.wtf/2020/03/03/observability-a-3-year-retrospective/) — why high-cardinality matters and what it costs.
- [Cindy Sridharan, *Distributed Systems Observability*](https://www.oreilly.com/library/view/distributed-systems-observability/9781492033431/) — short book; chapter 4 on structured logging is the canonical reference.

## Canonical code

### OTel SDK bootstrap

```typescript
// server/src/telemetry/tracing.ts
import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { Resource } from "@opentelemetry/resources";
import { SemanticResourceAttributes as Sem } from "@opentelemetry/semantic-conventions";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";

export const sdk = new NodeSDK({
  resource: new Resource({
    [Sem.SERVICE_NAME]: "pathway-mcp",
    [Sem.SERVICE_VERSION]: process.env.GIT_SHA ?? "dev",
    [Sem.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV ?? "development",
  }),
  traceExporter: new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? "http://jaeger:4318/v1/traces",
  }),
  instrumentations: [
    getNodeAutoInstrumentations({
      // Disable fs auto-instrumentation — too noisy, no signal.
      "@opentelemetry/instrumentation-fs": { enabled: false },
    }),
  ],
});

// Must start *before* any other import that creates spans.
sdk.start();
```

Bootstrap order matters. The first line of `server/src/index.ts` is `import "./telemetry/tracing.js";` — before the MCP SDK, before hono, before anything that issues HTTP calls. Auto-instrumentation patches via the import hook; modules imported earlier escape it.

### Rewritten `instrument()`

The wrapper from W2 keeps the same signature; the body changes:

```typescript
// server/src/instrumentation.ts
import { trace, SpanStatusCode, context } from "@opentelemetry/api";
import { logger } from "./log.js";
import { metrics } from "./telemetry/metrics.js";
import { sha256 } from "./hash.js";

const tracer = trace.getTracer("pathway-mcp");

export function instrument<TArgs, TResult>(
  name: string,
  fn: (args: TArgs) => Promise<TResult>,
) {
  return async (args: TArgs): Promise<TResult> => {
    const argsHash = sha256(JSON.stringify(args ?? {})).slice(0, 16);
    return tracer.startActiveSpan(`tool.${name}`, async (span) => {
      const start = performance.now();
      span.setAttributes({
        "mcp.tool.name": name,
        "mcp.args_hash": argsHash,
        "mcp.tenant.id": currentTenant() ?? "unknown",
        "mcp.session.id": currentSessionId() ?? "unknown",
      });
      try {
        const result = await fn(args);
        const truncated = (result as any)?.structuredContent?.truncated;
        if (truncated) span.setAttribute("mcp.result.truncated", true);
        span.setStatus({ code: SpanStatusCode.OK });
        metrics.toolCalls.inc({ tool: name, outcome: "ok" });
        metrics.toolDuration.observe({ tool: name }, (performance.now() - start) / 1000);
        return result;
      } catch (err) {
        const code = (err as McpError).code ?? "internal_error";
        span.setAttribute("mcp.error.code", code);
        span.recordException(err as Error);
        span.setStatus({ code: SpanStatusCode.ERROR });
        metrics.toolCalls.inc({ tool: name, outcome: "error" });
        metrics.toolErrors.inc({ tool: name, code });
        throw err;
      } finally {
        span.end();
      }
    });
  };
}
```

Every call site from W2 still says `instrument("create_issue", async (args) => {...})`. The migration is mechanical — that's the payoff for keeping the wrapper tight in W2.

### RED metrics

```typescript
// server/src/telemetry/metrics.ts
import { Counter, Histogram, Registry } from "prom-client";

export const registry = new Registry();

export const metrics = {
  toolCalls: new Counter({
    name: "mcp_tool_calls_total",
    help: "Total tool calls by tool and outcome.",
    labelNames: ["tool", "outcome"],
    registers: [registry],
  }),
  toolErrors: new Counter({
    name: "mcp_tool_errors_total",
    help: "Tool errors by tool and code.",
    labelNames: ["tool", "code"],
    registers: [registry],
  }),
  toolDuration: new Histogram({
    name: "mcp_tool_duration_seconds",
    help: "Tool call duration in seconds.",
    labelNames: ["tool"],
    buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30],
    registers: [registry],
  }),
  // Cost is a histogram, not a counter — we want percentiles, not just totals.
  toolCostUsd: new Histogram({
    name: "mcp_tool_cost_usd",
    help: "Estimated USD cost per tool call (model + sampling + cached-token discount).",
    labelNames: ["tool", "tenant"],
    buckets: [0.0001, 0.001, 0.01, 0.05, 0.1, 0.5, 1, 5],
    registers: [registry],
  }),
};
```

The cost histogram is W9 work even though attribution is the W10 lesson. The W10 attribution code emits into this histogram; W11's load test reads it. Putting the *vehicle* in W9 means W10 isn't blocked by metrics plumbing.

A label-cardinality budget matters: `tool` is bounded (~10s), `tenant` is bounded (~hundreds). Never label by `user_id`, `request_id`, or `session_id` — those are *trace* attributes, not metric labels.

### Trace-ID in logs

```typescript
// server/src/log.ts
import pino from "pino";
import { trace, context } from "@opentelemetry/api";

export const logger = pino({
  // Mixin runs on every log call; cheap.
  mixin() {
    const span = trace.getActiveSpan();
    if (!span) return {};
    const ctx = span.spanContext();
    return { trace_id: ctx.traceId, span_id: ctx.spanId };
  },
  redact: {
    paths: ["*.email", "*.token", "*.password", "*.authorization", "args.body"],
    censor: "[REDACTED]",
  },
});
```

Single field, single name, audited via the JSON Schema below. Every log line emitted inside a span has `trace_id`; pasting it into Jaeger's search box jumps to the trace. The runbook says exactly that.

### Structured-log JSON Schema

Commit `server/src/log-schema.json`:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "PathwayMcpLogLine",
  "type": "object",
  "required": ["level", "time", "msg"],
  "properties": {
    "level":     { "type": "integer", "enum": [10, 20, 30, 40, 50, 60] },
    "time":      { "type": "integer" },
    "msg":       { "type": "string" },
    "trace_id":  { "type": "string", "pattern": "^[a-f0-9]{32}$" },
    "span_id":   { "type": "string", "pattern": "^[a-f0-9]{16}$" },
    "tool":      { "type": "string" },
    "tenant_id": { "type": "string" },
    "code":      { "type": "string", "enum": ["invalid_input", "not_found", "forbidden", "rate_limited", "backend_failure", "internal_error"] },
    "duration_ms": { "type": "number", "minimum": 0 }
  },
  "additionalProperties": true
}
```

CI runs:

```bash
node scripts/check-log-schema.mjs server/src/**/*.ts
```

The script greps for `logger.info(`/`logger.error(`, captures the structured object, validates it against the schema, fails the build on mismatch. Drift is the failure mode this prevents — a dev adds `userEmail` instead of redacting; the schema has no field with that shape, the lint catches it.

### Dashboards as code

```yaml
# docker-compose.yml (excerpt)
grafana:
  image: grafana/grafana:11.3.0
  ports: ["3000:3000"]
  environment:
    GF_AUTH_ANONYMOUS_ENABLED: "true"
    GF_AUTH_ANONYMOUS_ORG_ROLE: "Admin"
  volumes:
    - ./observability/grafana/provisioning:/etc/grafana/provisioning:ro
    - ./observability/grafana/dashboards:/var/lib/grafana/dashboards:ro
```

`observability/grafana/dashboards/mcp-overview.json` is committed to the repo and contains four panels:

1. **Tool call rate** by tool — `sum by (tool) (rate(mcp_tool_calls_total[5m]))`.
2. **Error rate** — `sum(rate(mcp_tool_errors_total[5m])) / sum(rate(mcp_tool_calls_total[5m]))`.
3. **Duration p95/p99** — `histogram_quantile(0.95, sum by (le, tool) (rate(mcp_tool_duration_seconds_bucket[5m])))`.
4. **SLO burn rate** — see below.

A learner's first PR after W9 ships should be "add a panel for X." If the dashboard JSON were Grafana-UI-only, that PR would be unreviewable.

### SLO burn-rate alerts

The W8 SLO ("99.5% availability over 28 days") becomes an alert via the multi-window pattern:

```yaml
# observability/alertmanager/rules.yml
groups:
- name: mcp-slo
  rules:
  - alert: McpAvailabilityBurnRateFast
    # 14.4× burn over 1h consumes 2% of the 28-day budget — page.
    expr: |
      (
        sum(rate(mcp_tool_errors_total[1h])) / sum(rate(mcp_tool_calls_total[1h]))
      ) > (14.4 * 0.005)
      AND
      (
        sum(rate(mcp_tool_errors_total[5m])) / sum(rate(mcp_tool_calls_total[5m]))
      ) > (14.4 * 0.005)
    for: 2m
    labels: { severity: page }
    annotations:
      summary: "MCP error budget burning fast (14.4× over 1h, sustained 5m)"
      runbook: "https://internal/runbook#availability-fast-burn"

  - alert: McpAvailabilityBurnRateSlow
    # 3× burn over 6h consumes 6% of the budget — ticket, don't page.
    expr: |
      (
        sum(rate(mcp_tool_errors_total[6h])) / sum(rate(mcp_tool_calls_total[6h]))
      ) > (3 * 0.005)
    for: 15m
    labels: { severity: ticket }
```

Two windows protect against both flapping (the short window must also breach) and slow burns (the long window catches gradual degradation a fast-only rule misses). The `runbook:` annotation is non-negotiable — every paging alert *must* link to a runbook section.

### Harness gains trace correlation

```typescript
// harness/src/trace.ts
export function recordEvalResult(result: EvalCaseResult, response: Response) {
  const traceparent = response.headers.get("traceparent");
  if (traceparent) {
    const traceId = traceparent.split("-")[1];
    result.traceUrl = `http://localhost:16686/trace/${traceId}`;
  }
  evalResults.push(result);
}
```

A failing eval prints `Jaeger: http://localhost:16686/trace/<id>`. Click; see the full server-side trace; debug. The W3 eval set was a regression *signal*; W9 makes each failure *actionable*.

### PII redaction at the span boundary

The most insidious leak: a tool that takes `email` as an argument, hashes it for the span attribute via `args_hash`, but logs the full args via pino in error paths.

```typescript
// server/src/telemetry/redact.ts
const PII_KEYS = ["email", "name", "phone", "address", "ssn", "token", "password"];

export function redactForSpan(obj: unknown): Record<string, unknown> {
  if (typeof obj !== "object" || obj === null) return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (PII_KEYS.some((p) => k.toLowerCase().includes(p))) {
      out[k] = "[REDACTED]";
    } else if (typeof v === "object") {
      out[k] = redactForSpan(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}
```

Three guarantees the W9 review enforces:

1. Span attributes are **either** opaque hashes (`args_hash`) **or** values that have passed `redactForSpan`.
2. The pino redactor is the *backstop*, not the only line of defence.
3. `THREATS.md` gains a row; a W12 audit re-checks this.

## Artefact evolution

### Evolution: server

- **Before (end of W8):** `instrument()` emits one pino log line per tool call; deadlines/retries/bulkheads in place but not externally visible.
- **Change:** `instrument()` now opens an OTel span and emits prom-client metrics; pino logs gain `trace_id`/`span_id` via mixin; PII redactor wraps every span attribute that comes from user input; cost histogram registered (populated by W10).
- **After:** every tool call produces a span visible in Jaeger, bumps Prometheus counters, lands in Grafana panels, and links from any log line via `trace_id`.
- **Verify:**
  1. Issue a harness request; trace appears in Jaeger at `http://localhost:16686` within 5 seconds.
  2. `curl localhost:8080/metrics | grep mcp_tool_calls_total` shows the counter incremented.
  3. `docker logs server | jq 'select(.trace_id != null)'` shows correlated log lines; pasting `trace_id` into Jaeger jumps to the same trace.
  4. `node scripts/check-log-schema.mjs` passes.
- **Enables:** W10 cost attribution writes to `mcp_tool_cost_usd`; W11 load test asserts p95 from `mcp_tool_duration_seconds_bucket`; W12 PII review reads the redactor list.

### Evolution: harness

- **Before (end of W8):** prints a local trace with timings; honours `Retry-After`.
- **Change:** harness extracts `traceparent` from response headers; eval failures print Jaeger URLs; harness's own work is wrapped in a client-side span so end-to-end traces span both processes.
- **After:** an eval failure links directly to a Jaeger trace URL; the trace shows the harness span as the parent of the server span.
- **Verify:** failing eval case prints a Jaeger link; clicking it shows the full trace with both client and server spans.

### Evolution: docker-compose

- **Before (end of W8):** server (built image) + Postgres + issuer.
- **Change:** add `jaeger`, `prometheus` (with scrape config), `grafana` (with provisioned dashboards), `alertmanager` (with rules).
- **After:** `docker compose up` brings up the full observability stack on a single laptop.
- **Verify:** Jaeger UI at `http://localhost:16686`, Prometheus at `:9090`, Grafana at `:3000`, Alertmanager at `:9093` — all show the server.

### Evolution: eval set

- **Before (end of W7):** functional + transport + auth + tenancy cases.
- **Change:** add a `tracing.span_attrs_present` case that asserts every tool span carries `mcp.tool.name`, `mcp.tenant.id`, `mcp.session.id`, and `args_hash`; add a `tracing.no_pii_in_attrs` case that calls a tool with `email` in args and asserts no span attribute contains the literal email.
- **After:** observability is regression-tested.

### Evolution: error taxonomy

- **Before (end of W8):** six codes; new failure modes via `details.cause`.
- **Change:** unchanged. Spans add `mcp.error.code` so the error-rate panel in Grafana groups by code.
- **After:** still six codes; observable from three angles (logs, traces, metrics) without changing the contract.

### Evolution: RUNBOOK.md

- **Before (end of W8):** SLOs, SLO-breach playbook, rollback, secret rotation, first-30-minutes checklist.
- **Change:** add **trace-debug recipes** — "alert fires → click runbook link → Grafana panel → click trace ID → Jaeger → narrow by `mcp.error.code`." Each recipe is a numbered list with the exact queries; copy-paste-able at 3am.
- **After:** the runbook is operationally useful, not aspirational.

### Evolution: THREATS.md

- **Change:** add **PII via span attributes** — span exporters often have looser auth than log aggregators; an attacker with read access to the trace store could exfiltrate user emails the logger redacts. Mitigated by `redactForSpan` and the eval case that asserts it. Cross-references W12.

## Common pitfalls

:::caution[Five ways this week goes sideways]
1. **Bootstrapping OTel after `import` of instrumented modules.** Auto-instrumentation patches via `require`/`import` hooks. If `tracing.ts` isn't the *first* import, half your modules are uninstrumented and you'll waste an evening wondering why the database spans don't appear.
2. **Labelling metrics by request ID or session ID.** Cardinality explosion. Prometheus stores one time series per label combination; one new label value per request kills the database. Use traces for high-cardinality, metrics for low-cardinality. The line is firm.
3. **Logging at `info` inside the hot path.** A log line is ~5KB per call; at 100 RPS that's 500KB/s, 1.3GB/hour. Sampling and log-level discipline are part of the W9 work, not a "later optimisation."
4. **Treating Grafana UI changes as the source of truth.** A dashboard edited only in the UI gets lost when Grafana restarts and re-provisions from JSON, or when a colleague exports the JSON and overwrites yours. Edit-then-export-then-PR is the only workflow.
5. **Single-window error-rate alerts.** A 5-minute alert on `errors > 1%` flaps endlessly during normal load variance. Multi-window multi-burn-rate alerts are the SRE-workbook standard for a reason — copy the pattern, don't reinvent.
:::

## Checkpoint

- [ ] OTel SDK bootstrapped before any other instrumented import
- [ ] All tool calls produce spans with `mcp.tool.name`, `mcp.tenant.id`, `mcp.session.id`, `args_hash` attributes
- [ ] RED metrics exposed at `/metrics`; histograms have explicit, documented buckets
- [ ] `mcp_tool_cost_usd` histogram registered (populated by W10)
- [ ] Pino mixin adds `trace_id`/`span_id` to every log line inside a span
- [ ] `redactForSpan` applied to every user-input span attribute
- [ ] Log JSON Schema committed; `scripts/check-log-schema.mjs` passes in CI
- [ ] Grafana dashboard JSON committed; provisioning brings it up automatically
- [ ] At least four panels: rate, error rate, duration p95/p99, burn rate
- [ ] Multi-window multi-burn-rate alert rules committed; `amtool check-config` passes
- [ ] Jaeger shows end-to-end traces from harness → server → backend
- [ ] At least one trace-driven debugging session documented in `RUNBOOK.md`
- [ ] Eval set extended with `tracing.span_attrs_present` and `tracing.no_pii_in_attrs`
- [ ] `THREATS.md` extended with PII-via-span-attributes row
- [ ] `git tag week-9-complete`
- [ ] `git tag phase-4-complete` after `make verify`

## Leadership lens

- **Selling observability investment**: "We don't need 'more dashboards.' We need every alert to link to a runbook section, every runbook section to link to a Grafana panel, every panel to link to a trace, every trace to a redacted-args hash, and every error log to a `trace_id`. That's one chain. We're closing the gaps in it."
- **Defending the cardinality budget**: "If we label by `user_id`, our Prometheus host needs 30× the memory in two months. The alternative — querying traces by user — is *better* anyway, because traces support arbitrary cardinality natively. Use the right tool for each axis."
- **Justifying the JSON Schema for logs**: "The schema isn't bureaucracy. It's the contract that lets us redact PII automatically, that lets the SIEM parse logs without per-service rules, and that catches drift in CI. One file, one PR's effort to add."

## ADR candidates

- **Sampling strategy** — always-on in dev (so traces are reliable for debugging), tail-based in prod via the OTel collector (so cost stays sane). Record the threshold and the mechanism.
- **Span attribute naming** — `mcp.*` for protocol concepts; reuse `http.*`, `db.*`, `rpc.*` from semantic conventions. Worth recording the prefix policy so a new dependency doesn't introduce drift.
- **Metric cardinality budget** — what may be a label vs. what stays a span attribute. Defaults: `tool`, `tenant`, `code`, `outcome` are labels; everything else is a span attribute.
- **Log redaction list** — which key names trigger redaction; how to add a new one (PR + test); the failure mode if a developer adds a new PII-bearing key without updating the list.
- **Dashboards-as-code workflow** — UI-edit then export then PR vs. JSON-edit-only. UI-edit is the ergonomic default; the ADR records the discipline.
- **Alert ownership** — who gets paged for which severity; how a new alert acquires an owner. The technical mechanism is `team:` labels routed by Alertmanager; the policy is what the ADR records.
