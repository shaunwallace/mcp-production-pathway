---
title: Week 8 — Docker, deployment, SLOs, secrets (Phase 4, part 1)
status: outline
banner:
  content: |
    Outline only — full curriculum lands in a future release.
---

# Week 8 — Docker, deployment, SLOs, secrets (Phase 4, part 1)

> **Outline — full week ships in a future release.** This is the week that makes the "production-grade" claim real.

**Time budget (planned):** 10 to 14 hours. Longer than most weeks deliberately.

## Objectives (local track — required, full checkpoint)

- Multi-stage `Dockerfile` with a small final image, non-root user, pinned base.
- `docker run` locally with health + readiness probes and a graceful-shutdown drill (SIGTERM, connection drain).
- Explicit SLOs (p95 latency, error budget, max concurrency).
- File-mount secrets pattern (docker secrets / bind-mount) — same abstraction Secret Manager fills in cloud.
- `RUNBOOK.md` created with SLO-breach and rollback procedures.
- Timeouts, retries with backoff, and a circuit breaker for backend calls.
- Image hygiene: `npm audit` in CI, pinned base image digest, dependency scan.

## Objectives (cloud track — optional extension)

- Push image to GHCR (or Artifact Registry / ECR).
- Deploy to Cloud Run (canonical) with IAM-gated access.
- Real Secret Manager integration.
- Public URL exercised by the harness; full eval set runs against the deployed target.

**The local track alone is the full W8 checkpoint.** Cloud is an optional extension for learners who want to exercise real deploy mechanics.

## Tooling additions

- **Docker** multi-stage. Alternatives: [Podman](https://podman.io) (daemonless — tradeoff: less ubiquitous), [Buildah](https://buildah.io) (build-only — tradeoff: specialised).
- **Cloud Run** canonical for the cloud track. Alternatives: [Fly.io](https://fly.io) (simpler DX, edge locations — tradeoff: different networking model), [Railway](https://railway.app) (easier onboarding — tradeoff: less control), [AWS Lambda container image](https://docs.aws.amazon.com/lambda/latest/dg/images-create.html) (tradeoff: cold starts, harder stateful services).
- **GCP Secret Manager** for cloud secrets. Alternatives: [AWS SSM Parameter Store](https://docs.aws.amazon.com/systems-manager/latest/userguide/systems-manager-parameter-store.html), [HashiCorp Vault](https://www.vaultproject.io).
- **p-retry** + `AbortController` for retries and timeouts.

## Reading list (planned)

- Docker best practices (multi-stage, non-root, distroless bases)
- Cloud Run quickstart + container contract
- Google SRE book chapters on SLOs and error budgets
- One practitioner post on graceful shutdown in Node

## Planned canonical code example

- `Dockerfile` — multi-stage, builder + runtime, non-root, HEALTHCHECK
- `server/src/health.ts` — `/health` (liveness) + `/ready` (readiness, checks DB)
- `server/src/shutdown.ts` — SIGTERM handler that drains in-flight requests then exits
- `server/src/backend/retry.ts` — p-retry + AbortController wrapper around backend calls with a circuit breaker
- `scripts/deploy.sh` — 30-line shell script (cloud track). Pulumi/Terraform alternative mentioned; script is canonical for readability.
- `RUNBOOK.md` — first version with SLO-breach and rollback sections

## Artefact evolution (planned gates)

### Evolution: server

- **Before (end of W7):** runs via `npm run dev`, no container, no shutdown handling.
- **Change:** containerised, health/readiness probes, SIGTERM drain, retries + circuit breaker on backend calls, file-mount secrets.
- **After:** `docker run -p 8080:8080 …` brings up a production-shaped instance that survives container orchestration.
- **Verify:** graceful-shutdown drill — send SIGTERM during a long-running tool call; the call completes, new calls are rejected with a clear error, container exits zero.
- **Enables:** W9 OTel slots into the same wrapper; W11 load test targets this container shape.

### Evolution: docker-compose

- **Before (end of W6-7):** server + Postgres + issuer, server runs via `npm run dev`.
- **Change:** server now runs from the built image in the same compose file.
- **After:** the compose file matches production shape as closely as local can.

### Evolution: CI workflow

- **Before:** tests + evals.
- **Change:** add image build on PR, `npm audit`, image scan (e.g. Trivy), upload image to GHCR on merge to main.
- **After:** every merged commit produces a tagged image ready to deploy.

### Evolution: RUNBOOK.md

- **Before:** does not exist.
- **Change:** create with SLO breach, rollback, and secret rotation sections.
- **After:** a real runbook committed to the workbook.
- **Enables:** W9 adds trace-debug recipes; W12 adds security-incident playbook.

### Evolution: consumer README

- **Change:** add deployed URL (cloud track) or the `docker run` one-liner (local track).

## Checkpoint (planned)

### Local track (required)

- [ ] Multi-stage Dockerfile builds an image under ~200 MB
- [ ] Container runs as non-root with HEALTHCHECK
- [ ] `/health` and `/ready` respond correctly
- [ ] Graceful-shutdown drill passes: SIGTERM → drain → exit zero
- [ ] SLOs documented in `RUNBOOK.md`
- [ ] Timeouts + retries + circuit breaker covered by tests
- [ ] `npm audit` clean in CI
- [ ] `git tag week-8-complete`

### Cloud track (optional)

- [ ] Image pushed to GHCR
- [ ] Cloud Run service deployed with IAM auth
- [ ] Secrets wired via Secret Manager
- [ ] Harness runs evals against the public URL

## ADR candidates

- Base image choice (`node:22-alpine`, distroless, Ubuntu slim)
- Deploy target (Cloud Run vs. Fly.io vs. Lambda)
- Secret rotation cadence and mechanism
- Circuit breaker state storage (in-process vs. Redis)
