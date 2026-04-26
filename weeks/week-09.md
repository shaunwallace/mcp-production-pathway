---
title: Week 9 — OpenTelemetry, traces, metrics (Phase 4, part 2)
status: outline
banner:
  content: |
    Outline only — full curriculum lands in a future release.
---

# Week 9 — OpenTelemetry, traces, metrics (Phase 4, part 2)

> **Outline — full week ships in a future release.** Structure below is stable.

**Time budget (planned):** 8 to 12 hours.

## Objectives

- Replace the Week 2 `instrument()` wrapper with OpenTelemetry spans.
- Add RED metrics (rate, errors, duration) via `prom-client`.
- Run a local observability stack in compose: Jaeger for traces, Prometheus for metrics.
- Use traces to conduct at least one real debugging session and document it.
- Append trace-debug recipes to `RUNBOOK.md`.

## Tooling additions

- **@opentelemetry/sdk-node** + **@opentelemetry/exporter-trace-otlp-http**
- **prom-client** for Prometheus-format metrics exposed at `/metrics`
- **Jaeger** and **Prometheus** in docker-compose
- Alternative flagged: OTel metrics instead of prom-client (unified exporters — tradeoff: metric tooling less mature than tracing tooling in OTel today)
- Optional cloud alt: Honeycomb, Datadog, Grafana Cloud — all consume OTLP so the code path is identical

## Reading list (planned)

- OpenTelemetry JavaScript docs (trace API, auto-instrumentation, manual spans)
- Distributed tracing fundamentals (Parent-based sampling, trace context propagation)
- Prometheus metric naming conventions
- One practitioner post on tracing-driven debugging

## Planned canonical code example

- `server/src/telemetry/tracing.ts` — OTel SDK bootstrap
- `server/src/telemetry/metrics.ts` — RED metrics: `mcp_tool_calls_total`, `mcp_tool_errors_total`, `mcp_tool_duration_seconds` histogram
- Rewritten `server/src/instrumentation.ts` — same interface, now emits OTel spans + metrics instead of pino logs (pino logs retained for structured log aggregation)
- `docker-compose.yml` gains `jaeger` and `prometheus` services
- `prometheus.yml` scrape config targeting the server

## Artefact evolution (planned gates)

### Evolution: server

- **Before (end of W8):** `instrument()` wraps handlers, emits one pino line per call.
- **Change:** `instrument()` now opens an OTel span, sets attributes (`mcp.tool.name`, `mcp.tenant`, `mcp.session.id`, `args_hash`, outcome), records duration as a histogram metric.
- **After:** every tool call produces a span visible in Jaeger and bumps Prometheus counters.
- **Verify:** issue a harness request; trace appears in Jaeger at `http://localhost:16686` within 5 seconds; `curl localhost:8080/metrics | grep mcp_tool_calls_total` shows the counter incremented.
- **Enables:** W10 cost attribution reads span attributes to group cost by tool/tenant; W11 load test asserts p95 from the histogram.

### Evolution: harness

- **Before:** prints a local trace with timings.
- **Change:** harness extracts the `traceparent` from the server's response (or from exported spans) and includes trace IDs in eval results.
- **After:** an eval failure links directly to a Jaeger trace URL.
- **Verify:** failing eval case prints a Jaeger link; clicking it shows the full server-side trace.

### Evolution: docker-compose

- **Before:** server, Postgres, issuer.
- **Change:** add `jaeger` (all-in-one) and `prometheus` with a scrape config.
- **After:** `docker compose up` brings up the full observability stack.
- **Verify:** Jaeger UI at 16686 and Prometheus UI at 9090 both show the server.

### Evolution: RUNBOOK.md

- **Change:** add trace-debug recipes — "when you see an error in alerts, follow this link, filter by trace attrs, identify the backend-side cause."

## Checkpoint (planned)

- [ ] All tool calls produce OTel spans with consistent attributes
- [ ] RED metrics exposed at `/metrics` and scraped by Prometheus
- [ ] Jaeger shows end-to-end traces from harness → server → backend
- [ ] At least one trace-driven debugging session documented in notes
- [ ] `git tag week-9-complete`
- [ ] `git tag phase-4-complete` after `make verify`

## ADR candidates

- Sampling strategy (always-on in dev, tail-based in prod)
- Span attribute naming conventions
- Metric cardinality budget (tenants as labels? tool names as labels?)
