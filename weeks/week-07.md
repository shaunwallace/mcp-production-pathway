---
title: Week 7 — Harness as OAuth client, multi-tenancy (Phase 3, part 2)
status: outline
---

# Week 7 — Harness as OAuth client, multi-tenancy (Phase 3, part 2)

> **Outline — full week ships in a future release.** Structure below is stable.

**Time budget (planned):** 8 to 12 hours.

## Objectives

- Teach the harness to complete a real OAuth 2.1 flow end-to-end: PKCE, token exchange, refresh, rotation.
- Implement **multi-tenancy** in the server: tenant isolation, per-tenant quotas, tenant-scoped audit logs.
- Close out Phase 3 with the **second of three memos** — identity and tenancy tradeoffs.

## Tooling additions

- PKCE helpers (handwritten, ~20 lines — no library needed)
- `pg` connection with tenant-aware row-level security, OR a tenant-id-in-every-query pattern. Decision is an ADR.

## Reading list (planned)

- OAuth 2.1 + PKCE flows end to end
- Google's "Multi-tenancy isolation models" whitepaper (or similar) — the shared-schema / separate-schema / separate-DB tradeoff
- One practitioner post on quota enforcement in multi-tenant SaaS

## Planned canonical code example

- `harness/src/auth/pkce.ts` — PKCE challenge/verifier generation
- `harness/src/auth/flow.ts` — discovery → authorize → token exchange → refresh
- `server/src/tenancy/context.ts` — per-request tenant resolution from the JWT
- `server/src/tenancy/quota.ts` — per-tenant rate limiting (token bucket in Postgres or Redis)

## Artefact evolution (planned gates)

### Evolution: harness

- **Before (end of W6):** sends a static token from env.
- **Change:** full OAuth flow — discovery, PKCE authorize, token exchange, refresh on 401.
- **After:** harness can log in as any tenant configured in the local issuer; token lifecycle fully exercised.
- **Verify:** `harness --login tenant-a "…"` completes the flow, prints the acquired token (truncated), then runs the eval suite under that identity.
- **Enables:** W10 cost attribution groups by the tenant the harness logged in as.

### Evolution: server

- **Before (end of W6):** single-tenant server with auth.
- **Change:** extract `tenant` claim from the JWT on every call; scope all DB access to that tenant; enforce a per-tenant request quota.
- **After:** two tenants running against the same server can't see each other's data; exceeding the quota returns `{code: "rate_limited"}`.
- **Verify:** an integration test runs two harness instances (different tenants) against the same server and asserts they see different resources.
- **Enables:** W12 tenant isolation becomes a real thing to attack in the threat model.

### Evolution: error taxonomy

- **Change:** `rate_limited` now carries `details.retry_after_seconds` and `details.tenant_quota`.

### Evolution: eval set

- **Change:** duplicate the phase-1 set under two different tenants; the two runs must produce identical pass rates but against isolated data.

## Phase 3 memo (`memos/02-identity-and-tenancy.md`)

**The second of three memos.** ~800 words. Audience: your exec team or a technical partner.

Required sections:

- **TL;DR** (3 bullets)
- **Context** (1 paragraph)
- **Argument** — your opinionated view on identity for MCP servers. Why OAuth over API keys. Why tenancy is an identity concern, not a deployment concern. What you rejected.
- **What I'd say in a design review** (2-3 sentences)
- **What I changed my mind on** (1 thing, honest)

## Checkpoint (planned)

- [ ] Harness completes a full OAuth flow end to end
- [ ] Two tenants can run the same eval suite without cross-contamination
- [ ] Per-tenant quota enforced
- [ ] `memos/02-identity-and-tenancy.md` committed
- [ ] `git tag week-7-complete`
- [ ] `git tag phase-3-complete` after `make verify`

## ADR candidates

- Tenancy model (shared schema + tenant_id, schema-per-tenant, DB-per-tenant)
- Quota strategy (token bucket, fixed window, sliding window)
- Token rotation policy
