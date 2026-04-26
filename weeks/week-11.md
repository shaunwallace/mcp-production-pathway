---
title: Week 11 — Load testing, cost at scale, sampling and elicitation under load (Phase 5, part 2)
status: outline
banner:
  content: |
    Outline only — full curriculum lands in a future release.
---

# Week 11 — Load testing, cost at scale, sampling and elicitation under load (Phase 5, part 2)

> **Outline — full week ships in a future release.** Structure below is stable.

**Time budget (planned):** 8 to 12 hours.

:::note[Scope change from earlier drafts]
Sampling and elicitation were originally introduced in Week 5. They've been moved here because the *interesting* properties of both — sampling's cost multiplier, elicitation's latency tail — only show up under realistic load. Introducing them in this week, then immediately running them under k6, makes the lesson stick. Both primitives are independently useful; the load-test framing is what separates "it compiled" from "I understand what I just shipped."
:::

## Objectives

- Add a concurrent mode to the harness; drive the server at realistic load.
- Run load tests with **k6** as a one-shot service in docker-compose.
- Identify the bottleneck — it is rarely the one you'd guess.
- Implement **sampling** (server requests completions from the client's model) for at least one tool that benefits, and measure its cost contribution under load.
- Implement **elicitation** (server pauses to ask the user for a missing argument) for at least one tool, and measure its effect on session-duration distributions.
- Model cost at 10× and 100× expected volume — including the sampling multiplier. Update SLOs based on what you measure.
- Append load-incident recipes to `RUNBOOK.md`.

## Why this week exists

Every prior week measured single-shot performance: one harness, one tool call, one trace. That's necessary but misleading. Three things only become visible under contention:

1. **Sampling cost.** A tool that issues a sampling request invokes the *client's* model — not yours, but the user's wallet still pays. Under 50 concurrent sessions, a single sampling-using tool can multiply LLM spend 5-10×. The model-cost line item moves from "noise" to "the dominant cost." If you don't see this in week 5, you'll see it in production.
2. **Elicitation latency.** Pausing a tool call to ask the user for input adds *human-scale* latency (seconds to minutes) to a session that otherwise runs in hundreds of milliseconds. Under load this turns into queue depth, idle connection pools, and stuck idempotency entries.
3. **The actual bottleneck.** Almost every team guesses "the LLM" or "the database." It is almost always neither — it's connection-pool sizing, a single un-cached prompt template, or a tool that holds a Postgres lock during a slow backend call.

This week makes those visible. The k6 scenario reproduces the contention; the cost model attributes spend; the runbook records what you do when the dashboard goes red.

## Tooling additions

- **k6** (load test runner, JavaScript-based test definitions). Alternatives: [artillery](https://www.artillery.io) (Node-native — tradeoff: less mature reporting), [autocannon](https://github.com/mcollina/autocannon) (HTTP-only — tradeoff: doesn't speak MCP).
- k6's Prometheus remote-write output, feeding the same Grafana dashboard from W10.
- No new server deps. Sampling and elicitation are SDK primitives.

## Reading list (planned)

- MCP spec — sampling and elicitation sections (full read; both are short).
- k6 docs — scenarios, thresholds, executors.
- Google SRE book — chapter on load shedding.
- One practitioner post on cost modelling for LLM-driven systems (Eugene Yan or Hamel Husain are the canonical references).
- Anthropic's docs on `messages.create` from a server context — relevant because under sampling, the *client's* `messages.create` is what runs, but your server is the requester and your trace needs to reflect that.

## Planned canonical code examples

- `harness/src/concurrent.ts` — drives N harness instances in parallel, each running a subset of the eval set.
- `loadtests/phase-5.js` — k6 scenario: ramp to 50 concurrent sessions, hold for 5 minutes, measure p95 and error rate. Two profiles: with-sampling and without-sampling, run separately so the cost delta is visible.
- `server/src/tools/sampling-example.ts` — a tool that issues a `sampling/createMessage` request mid-handler. Worked example: a `summarise_thread` tool that asks the client's model to summarise a long issue thread rather than returning the raw text.
- `server/src/tools/elicitation-example.ts` — a tool that issues an `elicitation/create` request when a required argument is ambiguous. Worked example: a `close_issue` tool that elicits a confirmation reason when the issue has > N comments (heuristic for "this is contentious").
- `cost-model.md` — worksheet computing cost at 1×, 10×, 100×, with a separate column for the sampling multiplier. Assumptions written down, not implied.

## Sampling and elicitation: design notes

A few things that catch teams out and that this week should make explicit before turning on the load test:

- **Sampling shifts cost to the client.** Your spend doesn't go up; the user's does. From a server author's perspective this looks free. It isn't — the user notices, especially in multi-tenant SaaS where the *operator* pays via a wrapped client. Document the intent in your audit log: every sampling request gets a log line with the requested model, system prompt (hashed), and approximate token count.
- **The client can refuse.** A `sampling/createMessage` request can be denied by the client (consent UX, policy, or just "the user clicked no"). Your tool must handle the refusal — return a structured error using the W2 taxonomy, don't fall back to "as if the user said something neutral." Refusal is a real path.
- **System prompts for sampling sub-calls live with the tool.** Treat them as part of the tool's source. Version them with the tool, hash them in logs, snapshot them in golden-trace tests (W10). A drifting sampling system prompt is the most insidious source of eval drift in this whole pathway.
- **Elicitation has a hard latency floor.** Round-trip to a human is seconds at best. Your tool's timeout (W4) has to extend during an outstanding elicitation request — or you'll cancel your own pending question. Two clocks: the *backend* timeout and the *user-input* timeout. Get the distinction into your code before the load test.
- **Elicitation cannot be safely retried.** If a tool call retries (W4 idempotency, W8 retry policy) after a user has already answered an elicitation, you'll either ask twice or skip the question. Idempotency keys must scope across the elicitation cycle. Worth an ADR.

## Artefact evolution (planned gates)

### Evolution: server

- **Before (end of W10):** stable surface; tools, resources, prompts, roots; observability and CI in place.
- **Change:** add one sampling tool and one elicitation tool. Wire sampling-intent and elicitation-intent log lines through `instrument()` so cost and latency attribution are queryable.
- **After:** five MCP primitives covered by at least one server-side feature (tools, resources, prompts, sampling, elicitation; roots came in W5).
- **Verify:** sampling tool returns a structured result whose content was generated by the client's model; elicitation tool prompts the harness and respects the answer; both have a refusal path with a structured error.

### Evolution: harness

- **Before (end of W10):** sequential eval runs; supports prompts and roots from W5.
- **Change:** `--concurrent N` flag orchestrates N parallel sessions; implement a sampling responder (issues `messages.create` against Anthropic when the server requests it); implement an elicitation responder (auto-answers from a fixture map keyed on the elicitation question).
- **After:** harness produces contention-realistic traffic; harness fully exercises all spec primitives.
- **Verify:** `harness --concurrent 20 --eval …` completes; traces in Jaeger show genuine parallelism; new sampling and elicitation eval cases pass deterministically (the responder fixtures make them deterministic — that's the point).

### Evolution: docker-compose

- **Change:** add `k6` as a one-shot service that reads `loadtests/phase-5.js` and writes results to Prometheus via remote-write.
- **After:** `docker compose run k6` produces a load-test run with results visible in Grafana.

### Evolution: eval set

- **Before:** tool-selection + transport + W5 primitives.
- **Change:** add a `sampling.refusal` case (verifies the structured-error path) and a `sampling.cost-budget` case (asserts the trace records the right token counts). Add an `elicitation.timeout` case (verifies the user-input timeout fires independently of the backend timeout). Add latency budgets that only make sense under load (p95 < 500ms under 50 concurrent sessions).
- **After:** eval set runs in two shapes — single-shot and concurrent — with the load shape gating CI on a separate workflow that runs nightly, not per-PR.

### Evolution: SLOs

- **Before (end of W8):** SLOs set on assumptions.
- **Change:** update based on measured performance; document which SLOs had to move and why; add a sampling-cost SLO ("dollars per 1k sessions") to the dashboard.
- **After:** at least one SLO has been moved on evidence — and the runbook records it.

### Evolution: RUNBOOK.md

- **Change:** add a load-incident playbook — what to do when p95 spikes, how to shed load cleanly, which backend calls to short-circuit first. Add a sampling-cost incident playbook — what to do when the cost-per-session metric exceeds budget (kill switch, sampling disable flag, tenant-scoped throttle).

### Evolution: THREATS.md

- **Change:** add **sampling abuse** — a malicious server prompt that uses the client's model to do unrelated work (a confused-deputy variant). Tied off properly in W12.

## Checkpoint (planned)

- [ ] Harness runs in concurrent mode; >10 parallel sessions work
- [ ] k6 scenario committed and runnable via compose; results visible in Grafana
- [ ] Sampling tool implemented with refusal handling and a hashed-system-prompt log line
- [ ] Elicitation tool implemented with a separate user-input timeout
- [ ] Idempotency-key scope decision made and documented (ADR) so retries don't double-prompt
- [ ] Bottleneck identified and documented (it won't be what you guessed)
- [ ] Cost modelled at 10× and 100×, with the sampling multiplier broken out
- [ ] SLOs updated with measured numbers; at least one moved on evidence
- [ ] Load-incident and sampling-cost-incident playbooks in `RUNBOOK.md`
- [ ] `THREATS.md` extended with sampling-abuse section
- [ ] `git tag week-11-complete`
- [ ] `git tag phase-5-complete` after `make verify`

## ADR candidates

- Load-shedding strategy (reject at the edge vs. queue).
- Connection pool sizes (backend HTTP, Postgres, Redis) — set from measured baselines, not guessed.
- Circuit-breaker thresholds (set from measured baselines, not guessed).
- Sampling-cost kill switch (per-tenant throttle vs. global disable vs. degrade-to-text).
- Idempotency-key scope across elicitation cycles (do retries skip the question, ask again, or fail?).
- Sampling system-prompt versioning (inline string vs. dedicated file vs. registry).
