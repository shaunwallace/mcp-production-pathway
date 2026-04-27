---
title: Week 8 — Docker, deployment, SLOs, reliability (Phase 4, part 1)
description: Containerise the server, define SLOs, and add the reliability primitives — deadlines, bulkheads, retries, pagination, truncation — that separate "it works on my laptop under one user" from "it survives a real workload."
---

# Week 8 — Docker, deployment, SLOs, reliability (Phase 4, part 1)

This is the week that makes the "production-grade" claim real. Up to now you've shipped a correct, authenticated, multi-tenant server. This week makes it *survive* — under SIGTERM, under a slow backend, under a stuck client, under a single tool that wants to return 80MB. The shape of the work: a multi-stage container, explicit SLOs, a runbook, and six reliability primitives wired through `instrument()` so they're observable in W9 without re-plumbing.

**Time budget:** 10 to 14 hours. Longer than most weeks deliberately. The reliability primitives are the half of the week that most "ship MCP to production" guides skip; they're the half that decides whether your pager rings at 3am.

## Objectives (local track — required, full checkpoint)

- Multi-stage `Dockerfile` with a small final image, non-root user, pinned base by digest.
- `docker run` locally with health + readiness probes and a graceful-shutdown drill (SIGTERM, in-flight drain).
- Explicit SLOs (p95 latency, error budget, concurrency ceiling) committed to `RUNBOOK.md`.
- File-mount secrets pattern (docker secrets / bind-mount) — same abstraction Secret Manager fills in cloud.
- **Deadline propagation** model→tool→backend with one `AbortSignal` per request.
- **Retry budgets** with jittered backoff and a circuit breaker; `429` surfaced as `rate_limited` with `retry_after_ms`.
- **Bulkheads** — per-backend connection pools so one slow dependency cannot starve the others.
- **Idempotency store** unified with W4's transport-layer store so write tools are safe under client retry.
- **Response-size truncation policy** — every tool has a documented ceiling and a structured "truncated" signal.
- **Pagination contract** for every `list_*` tool: opaque cursor, bounded page size, total-count optionality.
- `RUNBOOK.md` created with SLO-breach, rollback, and secret-rotation procedures.
- Image hygiene: `npm audit` in CI, base image pinned by SHA, Trivy scan on every build.

## Objectives (cloud track — optional extension)

- Push image to GHCR (or Artifact Registry / ECR).
- Deploy to Cloud Run (canonical) with IAM-gated access.
- Real Secret Manager integration.
- Public URL exercised by the harness; full eval set runs against the deployed target.

**The local track alone is the full W8 checkpoint.** Cloud is an optional extension for learners who want to exercise real deploy mechanics. A learner who completes the local track has a server that would survive Cloud Run unchanged — the cloud step is mechanical, not conceptual.

## Why this week exists

Three observations from production MCP postmortems:

1. **The model has no concept of deadline.** It will happily wait 90 seconds for a tool that should have timed out at 5. If you don't propagate a deadline from the request boundary all the way down to your HTTP client, your tail latency is set by your slowest backend on its worst day, not by your SLO.
2. **One bad backend kills the whole server.** A single Postgres slow query, with default connection-pool sizing, will hold every connection while a hundred other tools that don't even touch Postgres queue behind them. Bulkheads are not optional.
3. **Tools that return "everything" don't survive contact with real data.** A `list_issues` tool tested against a fresh repo with 12 issues looks fine; pointed at a 40k-issue monorepo it returns 80MB and the model fails to parse it. The fix is not "tell the model to ask for fewer" — it's a contract baked into the tool.

This week installs the primitives that prevent each of those. They're cheap to add now, expensive to retrofit later, and they all become observable for free once W9 wires up tracing.

## Tooling additions

- **Docker** multi-stage. Alternatives: [Podman](https://podman.io) (daemonless — tradeoff: less ubiquitous CI support), [Buildah](https://buildah.io) (build-only — tradeoff: specialised).
- **Cloud Run** canonical for the cloud track. Alternatives: [Fly.io](https://fly.io) (simpler DX, edge locations — tradeoff: different networking model), [Railway](https://railway.app) (easier onboarding — tradeoff: less control), [AWS Lambda container image](https://docs.aws.amazon.com/lambda/latest/dg/images-create.html) (tradeoff: cold starts, harder for stateful flows).
- **GCP Secret Manager** for cloud secrets. Alternatives: [AWS SSM Parameter Store](https://docs.aws.amazon.com/systems-manager/latest/userguide/systems-manager-parameter-store.html), [HashiCorp Vault](https://www.vaultproject.io).
- **opossum** for circuit breakers. Alternative: hand-rolled (tradeoff: fewer free metrics, but ~50 lines if you want zero deps).
- **`AbortController`** (built in) for deadline propagation. No library needed.
- **Trivy** for image scanning in CI. Alternative: Snyk, Grype.

## Reading list

- [Docker best practices](https://docs.docker.com/develop/develop-images/dockerfile_best-practices/) — multi-stage, non-root, distroless bases.
- [Cloud Run container contract](https://cloud.google.com/run/docs/container-contract) — port binding, signal handling, statelessness.
- [Google SRE book — chapters 4 (SLOs) and 5 (Eliminating Toil)](https://sre.google/sre-book/service-level-objectives/).
- ["Tail at Scale" — Dean & Barroso](https://research.google/pubs/the-tail-at-scale/). Single best paper on why deadlines, bulkheads, and hedged requests exist.
- [Marc Brooker on retry storms](https://brooker.co.za/blog/2022/02/28/retries.html) — why naive retry without budget makes outages worse.
- One practitioner post on graceful shutdown in Node (Andrey Pechkurov's [terminus](https://github.com/godaddy/terminus) README is the canonical reference).

## Canonical code

### Multi-stage Dockerfile

```dockerfile
# syntax=docker/dockerfile:1.7
ARG NODE_VERSION=22.11.0
# Pin the base image by digest, not just tag — tag mutability is a real supply-chain risk.
FROM node:${NODE_VERSION}-alpine@sha256:<paste-current-sha> AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --include=dev
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:${NODE_VERSION}-alpine@sha256:<paste-current-sha> AS runtime
WORKDIR /app
RUN addgroup -S app && adduser -S app -G app
COPY --from=builder --chown=app:app /app/node_modules ./node_modules
COPY --from=builder --chown=app:app /app/dist ./dist
COPY --from=builder --chown=app:app /app/package.json ./
USER app
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/health || exit 1
# Tini is built into Alpine's node image as PID 1; this avoids zombie subprocesses
# and makes SIGTERM handling work the way the kernel intends.
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/index.js"]
```

Pin by digest, not just version tag. Get the digest with `docker pull node:22.11.0-alpine && docker inspect node:22.11.0-alpine --format='{{index .RepoDigests 0}}'`. Bumping the digest is a deliberate act recorded in git, the way it should be.

### Health and readiness

```typescript
// server/src/health.ts
import type { Hono } from "hono";
import { db } from "./db.js";

export function registerHealth(app: Hono) {
  // Liveness — am I the process? Should never depend on external state.
  app.get("/health", (c) => c.json({ status: "ok" }));

  // Readiness — am I willing to take traffic right now?
  app.get("/ready", async (c) => {
    try {
      await db.query("SELECT 1");
      if (shuttingDown) return c.json({ status: "draining" }, 503);
      return c.json({ status: "ready" });
    } catch (err) {
      return c.json({ status: "not_ready", reason: "db_unreachable" }, 503);
    }
  });
}
```

The split matters: liveness failing means "kill and restart me," readiness failing means "stop sending me traffic but don't restart me." Conflating them is the most common cause of crash loops during routine deploys.

### Graceful shutdown

```typescript
// server/src/shutdown.ts
import { server, db } from "./bootstrap.js";

export let shuttingDown = false;
const inflight = new Set<Promise<unknown>>();

export function track<T>(p: Promise<T>): Promise<T> {
  inflight.add(p);
  p.finally(() => inflight.delete(p));
  return p;
}

async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  log.info({ signal }, "shutdown_initiated");

  // 1. Stop accepting new connections; existing keep-alives stay.
  server.close();

  // 2. Drain in-flight tool calls with a hard cap.
  const drainDeadline = Date.now() + 25_000; // Cloud Run gives 30s after SIGTERM
  while (inflight.size > 0 && Date.now() < drainDeadline) {
    await Promise.race([
      Promise.allSettled([...inflight]),
      new Promise((r) => setTimeout(r, 1000)),
    ]);
  }

  if (inflight.size > 0) {
    log.warn({ leaked: inflight.size }, "shutdown_drain_timeout");
  }

  await db.end();
  log.info("shutdown_complete");
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
```

Wrap every tool handler's promise with `track(...)` at the transport boundary. The drill (in the checkpoint) is to send SIGTERM mid-call and watch the call complete cleanly — not be forcibly terminated.

### Deadline propagation

This is the load-bearing reliability primitive. The deadline is set once, at the request boundary, and threaded through every layer to the lowest backend call.

```typescript
// server/src/deadline.ts
import { AsyncLocalStorage } from "node:async_hooks";

interface RequestCtx {
  signal: AbortSignal;
  deadlineMs: number;
}

const ctx = new AsyncLocalStorage<RequestCtx>();

export function withDeadline<T>(
  budgetMs: number,
  fn: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DeadlineExceeded()), budgetMs);
  return ctx.run(
    { signal: controller.signal, deadlineMs: Date.now() + budgetMs },
    () => fn(controller.signal).finally(() => clearTimeout(timer)),
  );
}

export function currentDeadline(): RequestCtx | undefined {
  return ctx.getStore();
}

export function remainingMs(): number {
  const c = currentDeadline();
  if (!c) return Infinity;
  return Math.max(0, c.deadlineMs - Date.now());
}

export class DeadlineExceeded extends Error {
  constructor() { super("deadline_exceeded"); }
}
```

In every backend client:

```typescript
// server/src/backend/github.ts
import { currentDeadline, remainingMs } from "../deadline.js";

export async function getIssue(owner: string, repo: string, n: number) {
  const ctx = currentDeadline();
  // Backend timeout is the smaller of (remaining request budget, per-call ceiling).
  const callTimeoutMs = Math.min(remainingMs(), 5_000);
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/issues/${n}`,
    { signal: ctx?.signal ?? AbortSignal.timeout(callTimeoutMs) },
  );
  if (!res.ok) throw await mapError(res);
  return res.json();
}
```

The transport layer (W4) wraps every `tools/call` in `withDeadline(30_000, ...)`. That budget shrinks as backends consume it. The third backend call in a chain that's already used 28 seconds gets 2 seconds, not its default ceiling.

### Retry budget with jittered backoff

```typescript
// server/src/backend/retry.ts
import CircuitBreaker from "opossum";

interface RetryPolicy {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  retryBudgetPctPerMin: number; // cap retries at N% of total calls per minute
}

export async function withRetry<T>(
  name: string,
  fn: (signal: AbortSignal) => Promise<T>,
  policy: RetryPolicy = defaultPolicy,
): Promise<T> {
  if (!retryBudget.canSpend(name)) {
    // Budget exhausted — fail fast rather than amplify the storm.
    return fn(currentDeadline()?.signal ?? AbortSignal.timeout(5_000));
  }
  let lastErr: unknown;
  for (let attempt = 0; attempt < policy.maxAttempts; attempt++) {
    try {
      return await fn(currentDeadline()?.signal ?? AbortSignal.timeout(5_000));
    } catch (err) {
      lastErr = err;
      if (!isRetryable(err) || remainingMs() < 100) throw err;
      retryBudget.spend(name);
      const delay = jitter(
        Math.min(policy.maxDelayMs, policy.baseDelayMs * 2 ** attempt),
      );
      await sleep(delay);
    }
  }
  throw lastErr;
}

function jitter(ms: number) {
  // Decorrelated jitter — see Marc Brooker. Uniform(0, ms) is the cheap version.
  return Math.random() * ms;
}
```

The retry **budget** is the part most teams omit. Without it, a downstream brownout turns into a retry storm that prevents the dependency from ever recovering. Cap retries at ~10% of normal call volume per minute and fail fast when exceeded.

When the backend returns 429, surface it directly:

```typescript
if (res.status === 429) {
  const retryAfterMs = parseRetryAfter(res.headers.get("Retry-After"));
  throw new McpError("rate_limited", { retry_after_ms: retryAfterMs });
}
```

This is one of the W2 taxonomy codes; `details.retry_after_ms` lets the harness back off intelligently rather than hammering.

### Bulkheads

```typescript
// server/src/backend/pools.ts
import { Pool } from "pg";
import Bottleneck from "bottleneck";

// One Postgres pool per logical purpose, not per process.
export const sessionDb = new Pool({ max: 10, connectionString: ... });
export const auditDb   = new Pool({ max: 5,  connectionString: ... });

// Per-backend in-flight ceilings. A slow GitHub will not starve Linear.
export const githubLimiter = new Bottleneck({ maxConcurrent: 20, minTime: 0 });
export const linearLimiter = new Bottleneck({ maxConcurrent: 20, minTime: 0 });
```

Every backend client wraps its work in the matching limiter. The numbers come from the W11 load test; the W8 commitment is the *shape*, not the exact value.

### Idempotency unified with W4

W4 introduced the transport-layer idempotency store keyed on `Idempotency-Key`. W8 wires *write tools* into the same store so a write that retries through the model still hits an idempotent path:

```typescript
// server/src/tools/create-issue.ts
import { idempotencyStore } from "../idempotency.js";

export const createIssue = {
  name: "create_issue",
  annotations: { destructiveHint: false, idempotentHint: true },
  handler: instrument("create_issue", async (args) => {
    // Hash the semantic identity, not the random call ID.
    const key = `create_issue:${args.repo}:${sha256(args.title + args.body)}`;
    const existing = await idempotencyStore.lookup(key);
    if (existing) return existing.response;

    const created = await github.createIssue(args);
    const response = { content: [...], structuredContent: { id: created.id } };
    await idempotencyStore.store(key, response, { ttlMs: 24 * 60 * 60 * 1000 });
    return response;
  }),
};
```

The W4 transport store and the W8 tool-layer store are the same Postgres table with different key prefixes. A write that gets retried by the model produces *one* GitHub issue, not three.

### Response-size truncation

Every tool has a documented response ceiling and a machine-readable signal when it trips:

```typescript
// server/src/tools/_truncate.ts
const MAX_RESPONSE_BYTES = 256 * 1024; // 256KB

export function truncate<T extends { items: unknown[] }>(
  result: T,
  byteCeiling = MAX_RESPONSE_BYTES,
): T & { truncated?: { dropped: number; reason: string } } {
  let serialized = JSON.stringify(result);
  if (serialized.length <= byteCeiling) return result;

  // Drop items from the tail until we're under the ceiling.
  let dropped = 0;
  while (serialized.length > byteCeiling && result.items.length > 0) {
    result.items.pop();
    dropped++;
    serialized = JSON.stringify(result);
  }
  return { ...result, truncated: { dropped, reason: "response_size_limit" } };
}
```

The model sees `truncated: { dropped: 12, reason: "response_size_limit" }` in `structuredContent` and can paginate or refine. Without this, a tool that worked in dev returns garbled JSON in prod.

### Pagination contract

Every `list_*` tool follows the same shape:

```typescript
inputSchema: {
  type: "object",
  properties: {
    cursor: { type: "string", description: "Opaque cursor from a previous response. Omit for the first page." },
    page_size: { type: "integer", minimum: 1, maximum: 100, default: 25 },
  },
}
// Response (in structuredContent):
{
  items: [...],
  next_cursor: "opaque-string-or-null",
  total_count: 1247, // optional, only when cheap
}
```

Cursors are opaque (base64-encoded `{lastId, sortKey}`), not page numbers. Page numbers race; cursors don't. The model is told once, in the description, how to paginate; it does so reliably.

### SLOs

Commit them to `RUNBOOK.md`, not a Notion doc that drifts:

```markdown
## SLOs

- **Availability**: 99.5% of `tools/call` requests return a non-5xx response within p95 latency.
- **Latency**: p95 < 800ms, p99 < 2500ms over 28-day rolling window.
- **Correctness**: eval pass rate ≥ 95% on the canonical set in CI.
- **Concurrency**: server handles 50 concurrent sessions before degradation (validated quarterly via W11 k6 run).

Error budget: 0.5% of requests over 28 days = ~3.6 hours of full outage.
Burn-rate alerts: page on 14.4× burn over 1h (consumes 2% of monthly budget); ticket on 3× burn over 6h.
```

The numbers are placeholders until W9's metrics give you measurements. The *commitment* is what matters in W8 — a number you'll defend.

### File-mount secrets

```yaml
# docker-compose.yml (excerpt)
services:
  server:
    image: pathway-mcp:dev
    secrets:
      - oauth_signing_key
      - github_pat
    environment:
      OAUTH_SIGNING_KEY_FILE: /run/secrets/oauth_signing_key
      GITHUB_PAT_FILE: /run/secrets/github_pat

secrets:
  oauth_signing_key: { file: ./secrets/oauth_signing_key.pem }
  github_pat:        { file: ./secrets/github_pat.txt }
```

In code, read from the file path indirection — never from a plain env var:

```typescript
function readSecret(envVar: string): string {
  const filePath = process.env[`${envVar}_FILE`];
  if (filePath) return fs.readFileSync(filePath, "utf8").trim();
  const inline = process.env[envVar];
  if (inline) return inline; // dev convenience only; warn in prod.
  throw new Error(`secret ${envVar} not configured`);
}
```

Secret Manager (cloud track) mounts the same way via Cloud Run's secret-volume integration; the code path is identical.

## Artefact evolution

### Evolution: server

- **Before (end of W7):** runs via `npm run dev`, no container, no shutdown handling, no deadlines, no bulkheads.
- **Change:** containerised; `/health` + `/ready`; SIGTERM drain; deadline propagation via `AsyncLocalStorage` + `AbortController`; per-backend bulkheads via `Bottleneck`; `withRetry` with jittered backoff and a retry budget; circuit breakers on every backend client; idempotency store unified between transport and write tools; truncation helper applied at every tool exit; pagination contract on every `list_*`.
- **After:** `docker run -p 8080:8080 ...` brings up a production-shaped instance that survives container orchestration, slow backends, and retry storms.
- **Verify:** four drills, all in [scripts/drills](../scripts/drills/):
  1. **Shutdown drill** — `docker kill --signal=SIGTERM <id>` mid-call; the call completes, `/ready` flips to 503, container exits 0 within 30s.
  2. **Deadline drill** — call a tool that hits a backend stubbed to sleep 60s; request returns `backend_failure` with `details.cause: "deadline_exceeded"` at exactly the configured budget.
  3. **Bulkhead drill** — saturate the GitHub limiter; calls to Linear-backed tools succeed unaffected.
  4. **Idempotency drill** — call `create_issue` three times with the same `Idempotency-Key`; exactly one issue is created.
- **Enables:** W9 OTel slots into `instrument()` and reads deadline/retry/bulkhead state as span attributes for free; W11 load test targets this container shape; W12 audits truncation as part of PII review.

### Evolution: harness

- **Before (end of W7):** auto-refresh on 401; OAuth flow with DCR.
- **Change:** harness honours `Retry-After` from `rate_limited` errors; harness sends a per-request `X-Request-Deadline-Ms` header; harness paginates `list_*` tools via the cursor contract.
- **After:** harness behaves the way the spec says a real client should under contention.
- **Verify:** harness rerun against a backend that returns 429 with `Retry-After: 2` waits ~2s before retrying, not 200ms; trace shows it.

### Evolution: docker-compose

- **Before (end of W6-7):** server (via `npm run dev`) + Postgres + issuer.
- **Change:** server runs from the built image; Postgres pinned to the same major version it'll run in cloud; secrets mounted as files.
- **After:** the compose file matches production shape closely enough that a deploy is mechanical translation.

### Evolution: CI workflow

- **Before:** vitest + evals.
- **Change:** image build on every PR; `npm audit --audit-level=moderate`; Trivy scan with severity gate (HIGH/CRITICAL fail the build); image pushed to GHCR on merge to main, tagged with the commit SHA *and* a date stamp.
- **After:** every merged commit produces a tagged, scanned image ready to deploy.

### Evolution: error taxonomy

- **Before (end of W7):** six codes; new failure modes folded in via `details.cause`.
- **Change:** unchanged. Deadline-exceeded folds into `backend_failure` with `details.cause: "deadline_exceeded"`; circuit-open folds into `backend_failure` with `details.cause: "circuit_open"`; retry-budget-exceeded folds into `rate_limited` with `details.cause: "retry_budget_exhausted"`; truncation surfaces in `structuredContent.truncated`, not as an error.
- **After:** still six codes. The contract from W2 holds.

### Evolution: RUNBOOK.md

- **Before:** does not exist.
- **Change:** create with five sections — SLOs, SLO-breach playbook, rollback procedure, secret-rotation procedure, and a "first-30-minutes" page-response checklist.
- **After:** a real runbook committed to the workbook.
- **Enables:** W9 adds trace-debug recipes; W10 adds cost-anomaly playbook; W11 adds load-incident playbook; W12 adds security-incident playbook.

### Evolution: consumer README

- **Change:** add `docker run` one-liner (local track) or deployed URL (cloud track); document the pagination contract and truncation signal so consumer tooling knows how to handle them.

### Evolution: THREATS.md

- **Change:** add **resource exhaustion** — slow-loris-style attacks via long-deadline tool calls, mitigated by the deadline ceiling at the transport boundary; **retry amplification** — a malicious client deliberately triggering retry storms, mitigated by the per-tenant retry budget (cross-references W7 quotas).

## Common pitfalls

:::caution[Five ways this week goes sideways]
1. **Mounting `node_modules` from the build stage that contains dev deps.** `npm prune --omit=dev` between build and runtime stages, or your image is 600MB and ships test fixtures to prod.
2. **`process.exit(0)` immediately on SIGTERM.** Cuts in-flight requests cleanly in *theory*; in practice you've just abandoned the user mid-tool-call. Drain first, exit second.
3. **Setting deadlines but not threading the signal.** A `setTimeout` that calls `controller.abort()` does nothing if your fetch isn't passed `signal`. Audit every backend call. Add a lint rule if you're feeling principled.
4. **Retry without a budget.** Retries are *amplifiers*. A flaky downstream that drops 5% of requests, with three retries, sees 19% extra load — exactly when it can least afford it. Budget caps this.
5. **Pagination via offset instead of cursor.** Offset/limit pagination races with concurrent inserts (skipped or duplicate items). Opaque cursors don't. Use cursors from day one — retrofitting a contract change to consumers is painful.
:::

## Checkpoint

### Local track (required)

- [ ] Multi-stage Dockerfile builds an image under ~200 MB
- [ ] Container runs as non-root, base image pinned by digest, HEALTHCHECK present
- [ ] `/health` (liveness) and `/ready` (readiness) respond correctly; `/ready` returns 503 during shutdown
- [ ] Shutdown drill passes: SIGTERM → drain → exit 0
- [ ] Deadline drill passes: long backend call returns `backend_failure` with `deadline_exceeded` cause at exactly the configured budget
- [ ] Bulkhead drill passes: saturating one limiter does not affect others
- [ ] Idempotency drill passes: triple-call with same key produces one write
- [ ] Pagination contract documented and implemented on every `list_*` tool
- [ ] Truncation helper applied at every tool exit
- [ ] SLOs committed to `RUNBOOK.md` with explicit numbers
- [ ] `npm audit --audit-level=moderate` clean in CI; Trivy scan gating HIGH/CRITICAL
- [ ] `THREATS.md` extended with resource-exhaustion + retry-amplification rows
- [ ] `git tag week-8-complete`

### Cloud track (optional)

- [ ] Image pushed to GHCR with SHA + date tag
- [ ] Cloud Run service deployed with IAM auth required
- [ ] Secrets wired via Secret Manager (file-mount path, same code as local)
- [ ] Harness runs the canonical eval set against the public URL; pass rate matches local within ±2%

## Leadership lens

The shape of conversations the W8 work supports:

- **Defending an SLO to a stakeholder**: "p95 < 800ms is what the eval set + harness shows under 50 concurrent sessions. We measured it; it's not aspirational. Every quarter we re-validate via k6. If you want 200ms, here's the cost: a Redis cache layer at $X/mo and a 3-day rewrite of the longest-tail tool."
- **Justifying the retry budget to an SRE who wants aggressive retries**: "Retries amplify load on a struggling dependency. Without a budget, we'd convert a 5% error rate into a 19% load spike on the worst day. The budget caps the amplification at ~10%. Trade: slightly worse success rate during partial outages; far better recovery."
- **Explaining the cloud track is optional**: "The point of the local track is the engineering discipline — deadlines, bulkheads, drills. Cloud Run is mechanical once you have those. Skipping cloud doesn't skip production-readiness; skipping the drills does."

## ADR candidates

- **Base image** (`node:22-alpine` vs `gcr.io/distroless/nodejs22-debian12` vs `ubuntu:24.04`-slim) — record the security/debuggability trade.
- **Deploy target** (Cloud Run vs Fly.io vs Lambda container) — record the cold-start, cost, and stateful-flow trade.
- **Secret rotation cadence** (90-day, 30-day, on-incident) and mechanism — record the operator burden vs blast radius trade.
- **Circuit-breaker state storage** (in-process vs Redis) — in-process is cheaper but doesn't share state across replicas; Redis adds a dependency but stops thrashing on rolling deploys.
- **Retry budget per-tenant vs global** — per-tenant prevents one tenant from exhausting the budget; global is simpler. Defaults to per-tenant once W7 quotas are in.
- **Truncation policy: tail-drop vs error** — current default tail-drops with a signal; some teams prefer to error so the model sees the failure explicitly. Worth recording the reasoning.
- **Pagination cursor format** — base64 of opaque struct vs signed token vs HMAC'd token. Defaults to opaque-but-not-signed; W12 may upgrade to HMAC to prevent enumeration attacks.
