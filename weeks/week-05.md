---
title: Week 5 — Sessions, persistence, prompts, roots (Phase 2, part 2)
status: outline
banner:
  content: |
    Outline only — full curriculum lands in a future release.
---

# Week 5 — Sessions, persistence, prompts, roots (Phase 2, part 2)

> **Outline — full week ships in a future release.** Structure below is stable; prose and snippets will fill in.

**Time budget (planned):** 8 to 12 hours.

:::note[Scope change from earlier drafts]
Earlier drafts of this week bundled sampling and elicitation alongside sessions and persistence — six topics in one week, which the curriculum review flagged as too much for the depth required. Sampling and elicitation now live in **Week 11** (where their cost-and-latency-under-load story is the headline). This week focuses on the four topics that belong together: **session lifecycle, durable state, prompts as a primitive, and roots**.
:::

## Objectives

- Promote the W4 in-memory session/event store to a durable Postgres-backed store via docker-compose.
- Wire **progress notifications** on at least one long-running tool, with **cancellation** honoured end-to-end.
- Implement **prompts** as a first-class primitive — at least two, one parameterless and one with arguments + completion. Prompts are not optional in this pathway.
- Implement **roots** so the server knows what the client is allowed to access. Even backend-API servers benefit; learners building local-tool servers must.
- Introduce `docker-compose.yml` — the first version of the local production stack.

## Why this week exists

By the end of W4 the server has an HTTP edge but no memory: sessions live in a `Map`, the event log is bounded at 1000 entries, idempotency is in SQLite, and there's no concept of "this is the same user across two sessions." That's fine for a single-process dev box. The minute you add a second instance — a Postgres replica, a Cloud Run revision, even a `docker compose up` after a restart — every session evaporates.

This week introduces the persistence layer that everything from W6 onward depends on. **Auth (W6-7)** stores tokens against sessions; **deployment (W8)** assumes a shared store across instances; **observability (W9)** queries by session. Get the abstraction right here and those weeks become mechanical.

The four topics share one property: they all turn an *implicit* server contract into an *explicit, persisted* one. Sessions: which conversation are we in? Persistence: how do we remember? Prompts: what canned starts can the user invoke? Roots: what is the client willing to let us see?

## Tooling additions

- **Postgres 16** via docker-compose. Plain `pg` client; no ORM this week — SQL stays readable with 2-3 tables. Alternatives: [Drizzle](https://orm.drizzle.team) or [Kysely](https://kysely.dev) for type-safe query building (tradeoff: more setup before the first row).
- **node-pg-migrate** for schema migrations. Plain `init.sql` is tempting and wrong — by W8 you'll need versioned migrations. Start the discipline here. Alternative: [graphile-migrate](https://github.com/graphile/migrate) (more featureful, steeper curve).
- **better-sqlite3** stays for the local-only path (idempotency-key store from W4 doesn't need to move yet).

## Reading list (planned)

- MCP spec — sessions, resumability, progress, cancellation, **prompts**, **completion**, **roots**. Read all six sections.
- PostgreSQL docs — connection pooling, JSONB, `LISTEN`/`NOTIFY` (the latter is optional reading; useful in W9).
- One practitioner post on idempotent session resumption (Stripe's "Designing webhooks" is adjacent and worth the 15 minutes).
- The roots section of the MCP spec is short but load-bearing — read it twice.

## Planned canonical code examples

- `server/src/sessions/store.ts` — interface with two implementations (sqlite for local dev, Postgres for compose). Same call sites; one implementation is selected by env.
- `server/src/sessions/migrations/` — initial schema for `sessions`, `session_events` (replaces the in-memory event log from W4), and `prompt_invocations` (audit trail).
- `server/src/tools/long-running.ts` — a tool that emits progress notifications and respects cancellation tokens.
- `server/src/prompts/` — one folder, one file per prompt. Two prompts:
  - `summarise-issue` — parameterless; takes the current session's last-read issue and produces a digest.
  - `triage-pr` — has arguments (`severity`, `area`); demonstrates `completion/complete` so the client can offer dropdown values.
- `server/src/roots.ts` — root advertisement and validation. Every tool that takes a path/URI argument checks it against the client's declared roots.
- `docker-compose.yml` — server + Postgres with healthcheck, named volume, and a `psql` one-shot service for migrations.

## Artefact evolution (planned gates)

### Evolution: server

- **Before (end of W4):** HTTP + stdio with in-memory session map and bounded event log; no prompts; no roots.
- **Change:** swap session store and event log to Postgres-backed implementations behind the same interface; add 2 prompts (one with completion); add roots advertisement and validation in any path-taking tool.
- **After:** sessions survive a server restart; long-running tools emit progress and respect cancellation; clients can list and invoke prompts; tools refuse paths outside the client's declared roots.
- **Verify:** kill server mid-session, restart, harness reconnects with `Last-Event-ID` and replays from Postgres; Inspector shows the two prompts; a path argument outside roots returns `ToolErrorCode.Forbidden`.
- **Enables:** W6-7 attaches a user identity to every session (the `sessions` table grows a `subject` column); W8 deployment runs N instances against the same Postgres; W9 traces query by session.

### Evolution: harness

- **Before:** stateless calls; no prompt support; sends path arguments without root awareness.
- **Change:** handle `notifications/progress` in the trace; support `prompts/list` + `prompts/get`; advertise roots on connect; emit `notifications/cancelled` on Ctrl-C and verify the server honours it.
- **After:** harness exercises every primitive a real client would.
- **Verify:** new eval cases — `prompts.invoke.summarise-issue`, `prompts.complete.triage-pr.severity`, `roots.reject.outside-path`, `cancellation.during-long-tool` — all pass.

### Evolution: eval set

- **Before:** tool-selection + transport cases.
- **Change:** add 6-8 cases covering session resumption, prompt listing, prompt invocation, prompt-argument completion, roots rejection, progress, and cancellation.
- **After:** eval set covers four MCP primitives (tools, resources from W2, prompts, roots) with at least one case each. Sampling and elicitation arrive in W11.

### Evolution: error taxonomy

- **Before:** 6 codes from W2-4.
- **Change:** no new codes. Roots violations use `Forbidden` with `details.cause: "outside_roots"`; cancelled tools return `BackendFailure` with `details.cause: "cancelled"`. Document in an ADR.
- **After:** still 6 codes. The narrow vocabulary is holding.

### Evolution: docker-compose

- **Before:** does not exist.
- **Change:** create `docker-compose.yml` with `server` (running via `npm run dev`), `postgres:16` with a healthcheck and a named volume, and a `migrate` one-shot service that runs pending migrations on `up`.
- **After:** `docker compose up` brings the local dev stack to a known-good state.
- **Verify:** `curl localhost:8080/health` returns 200; `psql -h localhost -U mcp` succeeds; `docker compose down && docker compose up` preserves data via the named volume.
- **Enables:** every subsequent week adds services to this file — local OAuth issuer (W6-7), containerised server (W8), Jaeger + Prometheus (W9), Grafana (W10), k6 (W11).

### Evolution: consumer README

- **Before:** stdio + HTTP connect blocks.
- **Change:** add a "Prompts" section listing the available prompts and arguments; add a "Roots" section noting what the server expects clients to advertise.
- **After:** README documents four primitives.

### Evolution: THREATS.md

- **Change:** add **path-traversal via tool arguments** (defended by roots), and **session-fixation** (defended by server-issued session IDs from W4 + a `subject` binding starting in W6). Two new sections, ~50 words each.

## Checkpoint (planned)

- [ ] Postgres-backed session store; sessions survive `docker compose restart`
- [ ] Event log migrated from in-memory to Postgres; `Last-Event-ID` resumption works after a restart
- [ ] At least one long-running tool emits progress notifications
- [ ] Cancellation works end-to-end: harness Ctrl-C terminates the in-flight tool within 1s
- [ ] Two prompts shipped — one parameterless, one with arguments + `completion/complete`
- [ ] Roots advertised by the harness; the server's path-taking tools reject out-of-root paths with `Forbidden`
- [ ] Eval set extended with the six new cases listed above; all pass
- [ ] `docker compose up` brings the stack up cleanly; healthchecks pass
- [ ] Migrations are version-controlled; rolling back the latest migration succeeds
- [ ] `THREATS.md` extended with two new sections
- [ ] `git tag week-5-complete`
- [ ] `git tag phase-2-complete` after `make verify`

## Common pitfalls (preview)

- **Treating prompts as templated strings.** They're a server primitive with their own list/get/argument-completion lifecycle. The model never sees them; the *user* picks them through the client UI.
- **Assuming roots are advisory.** They aren't. A path-taking tool that doesn't validate against roots is a confused-deputy bug waiting to happen — covered properly in W6 and W12.
- **Skipping migrations.** "Just one `init.sql`" is the seed of a Phase 4 disaster. Versioned migrations cost 30 minutes this week and save days later.
- **Cancelling lazily.** A tool that checks for cancellation only at the start of a loop iteration is fine for fast loops and useless for slow ones. Cancellation has to thread into the longest-blocking call (the backend HTTP request).

## ADR candidates

- Session TTL and eviction policy (idle timeout vs. absolute timeout vs. both).
- Prompt versioning (rename vs. version field vs. additive-only).
- Roots enforcement boundary (every tool, vs. a wrapper, vs. a per-tool annotation that says "this tool respects roots").
- Schema-migration tool choice (`node-pg-migrate` vs. `graphile-migrate` vs. plain SQL with a hand-rolled `applied_migrations` table).
