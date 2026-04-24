---
title: Week 5 — Sessions, persistence, sampling, elicitation (Phase 2, part 2)
status: outline
---

# Week 5 — Sessions, persistence, sampling, elicitation (Phase 2, part 2)

> **Outline — full week ships in a future release.** Structure below is stable; prose and snippets will fill in.

**Time budget (planned):** 8 to 12 hours.

## Objectives

- Implement session resumption, progress notifications for long-running tools, and cancellation.
- Introduce a persistence layer for session state: better-sqlite3 for dev, Postgres via docker-compose for prod-shape.
- Implement **sampling** (server requests completions from the client's model) for at least one tool that benefits — a tool that needs LLM-shaped reasoning mid-call.
- Implement **elicitation** (asking the user for input mid-turn) for at least one tool with ambiguous required args.
- Introduce `docker-compose.yml` — the first version of the local production stack.

## Tooling additions

- **better-sqlite3** for dev persistence. Alternatives: [libsql](https://github.com/tursodatabase/libsql) (same API, remote-capable — tradeoff: extra surface), [node:sqlite](https://nodejs.org/api/sqlite.html) (built-in from Node 22 — tradeoff: newer, smaller API).
- **Postgres 16** via docker-compose for production-shape. Plain `pg` client; no ORM this week — SQL stays readable with 2-3 tables. Alternative: [Drizzle](https://orm.drizzle.team) or [Kysely](https://kysely.dev) if you want type-safe query building (tradeoff: more setup).

## Reading list (planned)

- MCP spec: sessions, resumability, progress, cancellation, sampling, elicitation
- PostgreSQL docs: connection pooling, migrations (or a simple `init.sql` this week)
- One practitioner post on idempotent session resumption

## Planned canonical code example

- `server/src/sessions/store.ts` — interface with two implementations (sqlite, postgres)
- `server/src/tools/long-running.ts` — a tool that emits progress notifications and supports cancellation
- `server/src/tools/sampling-example.ts` — a tool that issues a sampling request back to the client
- `server/src/tools/elicitation-example.ts` — a tool that pauses to ask for a missing arg
- `docker-compose.yml` — server + Postgres

## Artefact evolution (planned gates)

### Evolution: server

- **Before (end of W4):** HTTP + stdio, stateless beyond what the harness passes in.
- **Change:** add session store, progress notifications, cancellation, one sampling tool, one elicitation tool.
- **After:** long-running operations resumable across reconnects; at least one tool uses the client's model via sampling; at least one pauses for user input.
- **Verify:** harness kills connection mid-call and resumes; eval set includes resumption cases.
- **Enables:** W6-7 auth can attach a user identity to every session; W8 deploy replaces local sqlite with Cloud-Run-friendly Postgres without changing tool code.

### Evolution: harness

- **Before:** single-shot request/response.
- **Change:** handle progress notifications in the trace; implement a sampling responder (serves the model's sub-requests); implement elicitation responder (prompts the user or auto-answers from a fixture).
- **After:** harness fully exercises four new spec primitives.
- **Verify:** new eval cases with sampling/elicitation pass.

### Evolution: eval set

- **Before (end of W4):** tool-selection and transport cases.
- **Change:** add session-resumption cases and at least one each for sampling and elicitation.
- **After:** eval set covers all five MCP primitives (tools, resources, prompts left for a rabbit hole, sampling, elicitation).

### Evolution: docker-compose

- **Before:** does not exist.
- **Change:** create `docker-compose.yml` with `server` (running via `npm run dev`) + `postgres:16` with a healthcheck and a named volume.
- **After:** `docker compose up` brings up the local dev stack.
- **Verify:** `curl localhost:8080/health` returns 200; Postgres accepts connections from the server container.
- **Enables:** every subsequent week adds services to this file — local OAuth issuer (W6-7), containerised server (W8), Jaeger + Prometheus (W9), Grafana (W10), k6 (W11).

## Checkpoint (planned)

- [ ] Session state persisted across reconnects
- [ ] Progress notifications flowing from a long-running tool
- [ ] Cancellation honoured
- [ ] One sampling tool works end-to-end through the harness
- [ ] One elicitation tool works end-to-end
- [ ] `docker compose up` brings up server + Postgres; healthcheck passes
- [ ] `git tag week-5-complete`
- [ ] `git tag phase-2-complete` after `make verify`

## ADR candidates

- Session TTL and cleanup policy
- Sampling cost attribution (the client pays — but your server should log the intent)
- Schema migration strategy (plain SQL files vs. a migration tool)
