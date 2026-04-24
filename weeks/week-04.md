---
title: Week 4 — Streamable HTTP transport (Phase 2, part 1)
status: outline
---

# Week 4 — Streamable HTTP transport (Phase 2, part 1)

> **Outline — full week ships in a future release.** Structure below is stable; prose and snippets will fill in. Subscribe to releases to get notified when this week lands in full.

**Time budget (planned):** 6 to 10 hours.

## Objectives

- Port the server from stdio to Streamable HTTP using `hono`.
- Test client portability across MCP Inspector, Claude Desktop (if applicable), Cursor, and the harness.
- Introduce transport-boundary validation separate from tool-boundary validation.
- Add idempotency keys for write tools now that network retries are real.
- Set sensible default timeouts and surface transport errors through the Week 2 error taxonomy.
- Rerun the Week 3 eval set under HTTP and confirm no regression.

## Tooling additions

- **hono** as the HTTP server framework. Alternatives: [express](https://expressjs.com) (ubiquitous — tradeoff: older patterns, heavier middleware), [fastify](https://fastify.dev) (performance-focused — tradeoff: richer plugin system than this pathway needs).
- Canonical choice runs the same server binary on Node today and on Cloud Run / Cloudflare Workers later without a rewrite.

## Reading list (planned)

- MCP spec Streamable HTTP section
- hono docs (routing, middleware, streaming)
- Practitioner post on idempotency keys in HTTP APIs (Stripe's engineering blog is canonical)

## Planned canonical code example

- `server/src/transport/http.ts` — hono app wrapping the same MCP `Server` instance, with request-body validation, an idempotency-key middleware, and a timeout wrapper.
- Harness `--transport http|stdio` flag.
- MCP Inspector config pointing at `http://localhost:8080`.

## Artefact evolution (planned gates)

### Evolution: server

- **Before:** stdio only.
- **Change:** add `hono` HTTP transport; keep stdio path for local iteration; introduce request-boundary validation (body size, Content-Type, Origin) distinct from tool-boundary validation.
- **After:** single binary serves both transports; selected by env or CLI flag.
- **Verify:** curl against `/mcp` returns capabilities; Inspector connects over HTTP; Week 3 evals rerun under HTTP match local pass rate within 1 case.
- **Enables:** W5 sessions and resumability, W6-7 OAuth at the HTTP boundary, W8 deployment.

### Evolution: harness

- **Before:** stdio client only.
- **Change:** add `HttpClientTransport`; CLI flag `--transport http|stdio`.
- **After:** same eval set runnable over either transport; latency delta visible in trace.
- **Verify:** `harness --transport http http://localhost:8080 --eval …` passes within 1 case of stdio baseline.
- **Enables:** W11 load testing only works against the HTTP transport.

### Evolution: eval set

- **Before:** 12-20 cases, stdio.
- **Change:** add a small set of transport-edge cases (large payloads, slow backends, client disconnects mid-response).
- **After:** set runs under both transports; regression on either fails CI.

### Evolution: error taxonomy

- **Before:** 6 codes (`invalid_args`, `not_found`, `backend_failure`, `rate_limited`, `forbidden`, `internal`).
- **Change:** add transport-layer errors (`transport_timeout`, `transport_aborted`) — or explicitly decide they fold into `backend_failure` with `details.cause: "transport"`. Document the decision in an ADR.
- **After:** either 6 or 8 codes, consistently applied.

## Client portability matrix (planned)

Test the HTTP server against at least three clients. Document in `server/README.md`:

| Client | Config snippet | Known quirks |
|---|---|---|
| MCP Inspector | `--url http://localhost:8080/mcp` | — |
| Claude Desktop | (HTTP support evolving — link to current docs) | — |
| Cursor | (config location + snippet) | — |
| Harness | `--transport http` | — |

## Checkpoint (planned)

- [ ] Server serves MCP over HTTP and stdio
- [ ] At least 3 clients tested; quirks documented
- [ ] Idempotency keys implemented on write tools with a contract test
- [ ] Transport-boundary validation section in `server/README.md`
- [ ] Week 3 eval set passes over HTTP
- [ ] `git tag week-4-complete`

## ADR candidates

- Transport error shape (fold into existing codes or add two new ones)
- Timeout policy (single global, per-tool, or derived from tool metadata)
- Idempotency key scope (per-tool, per-tenant, per-session)
