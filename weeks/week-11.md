---
title: Week 11 — Load testing, cost at scale (Phase 5, part 2)
status: outline
---

# Week 11 — Load testing, cost at scale (Phase 5, part 2)

> **Outline — full week ships in a future release.** Structure below is stable.

**Time budget (planned):** 8 to 12 hours.

## Objectives

- Add a concurrent mode to the harness; drive the server at realistic load.
- Run load tests with **k6** as a one-shot service in docker-compose.
- Identify the bottleneck — it is rarely the one you'd guess.
- Model cost at 10× and 100× expected volume. Update SLOs based on what you measure.
- Append load-incident recipes to `RUNBOOK.md`.

## Tooling additions

- **k6** (load test runner, JavaScript-based test definitions). Alternatives: [artillery](https://www.artillery.io) (Node-native — tradeoff: less mature reporting), [autocannon](https://github.com/mcollina/autocannon) (HTTP-only — tradeoff: doesn't speak MCP).
- k6's Prometheus remote-write output to feed results into the same Grafana dashboard from Week 10.

## Reading list (planned)

- k6 docs (scenarios, thresholds, executors)
- Google SRE book, chapter on load shedding
- One practitioner post on cost modelling for LLM-driven systems

## Planned canonical code example

- `harness/src/concurrent.ts` — drives N harness instances in parallel, each running a subset of the eval set
- `loadtests/phase-5.js` — k6 scenario: ramp to 50 concurrent sessions, hold for 5 minutes, measure p95 and error rate
- `cost-model.md` — worksheet computing cost at 1×, 10×, 100× with assumptions written down

## Artefact evolution (planned gates)

### Evolution: harness

- **Before (end of W10):** sequential eval runs.
- **Change:** `--concurrent N` flag; orchestrates N parallel sessions against the same server.
- **After:** harness produces contention-realistic traffic.
- **Verify:** `harness --concurrent 20 --eval …` completes; traces in Jaeger show genuine parallelism.

### Evolution: docker-compose

- **Change:** add `k6` as a one-shot service that reads `loadtests/phase-5.js` and writes results into Prometheus.
- **After:** `docker compose run k6` produces a load-test run with results visible in Grafana.

### Evolution: eval set

- **Change:** add latency budgets that only make sense under load (p95 < 500ms under 50 concurrent sessions).

### Evolution: SLOs

- **Before (end of W8):** SLOs set on assumptions.
- **Change:** update based on measured performance; document which SLOs had to move and why.

### Evolution: RUNBOOK.md

- **Change:** add load-incident playbook — what to do when p95 spikes, how to shed load cleanly, which backend calls to short-circuit first.

## Checkpoint (planned)

- [ ] Harness runs in concurrent mode; >10 parallel sessions work
- [ ] k6 scenario committed and runnable via compose
- [ ] Bottleneck identified and documented
- [ ] Cost modelled at 10× and 100×
- [ ] SLOs updated with measured numbers
- [ ] Load-incident playbook in RUNBOOK.md
- [ ] `git tag week-11-complete`
- [ ] `git tag phase-5-complete` after `make verify`

## ADR candidates

- Load-shedding strategy (reject at the edge vs. queue)
- Connection pool sizes (backend HTTP, Postgres, Redis)
- Circuit-breaker thresholds (set from measured baselines, not guessed)
