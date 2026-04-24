---
title: Week 6 — OAuth 2.1 server side (Phase 3, part 1)
status: outline
---

# Week 6 — OAuth 2.1 server side (Phase 3, part 1)

> **Outline — full week ships in a future release.** Structure below is stable.

**Time budget (planned):** 8 to 12 hours.

## Objectives

- Implement the server side of OAuth 2.1: metadata discovery, token validation, scope enforcement.
- Include a minimal **local issuer** (`jose`-based, ~60 lines) so the full flow runs offline. Real IdPs are a stretch goal, not a requirement.
- Introduce audit logging — every authenticated tool call writes a tamper-evident line with `subject`, `tenant`, `tool`, `args_hash`.
- Extend the error taxonomy with `auth_required` and `auth_invalid`.

## Tooling additions

- **jose** for JWT verification and (in the local issuer) minting. Alternatives: [node-jose](https://github.com/cisco/node-jose) (older — tradeoff: larger API surface), [panva/openid-client](https://github.com/panva/openid-client) (full OIDC client — tradeoff: overkill for server-side validation).
- MCP SDK built-in auth middleware where available; the hono integration wraps it.

## Reading list (planned)

- MCP spec: authentication sections, carefully — this is where production servers cut corners they regret
- OAuth 2.1 draft
- PKCE RFC 7636
- JWT best-practice RFC 8725

## Local issuer (the credibility-saving detail)

~60 lines of `jose`-based code that mints tokens the harness can carry. Same validation path your server will run against Auth0 / Okta / Google later — only the JWKS URL changes. Means every learner can exercise the full authenticated flow without external accounts.

Alternatives flagged:
- [`ory/hydra`](https://www.ory.sh/hydra/) in docker-compose for a fuller-featured local OIDC (tradeoff: more services, more config).
- Real Google / GitHub OAuth apps with localhost callback for learners who want to exercise the real flow (tradeoff: external dependency, requires account setup).

## Planned canonical code example

- `server/src/auth/verify.ts` — JWT verification middleware for hono
- `server/src/auth/scopes.ts` — tool-level scope requirements + enforcement
- `server/src/audit/log.ts` — structured audit line writer
- `tools/local-issuer/` — standalone mini-issuer that signs tokens with a key the server trusts

## Artefact evolution (planned gates)

### Evolution: server

- **Before (end of W5):** anonymous calls accepted.
- **Change:** require a valid JWT on every tool call except a narrow health endpoint; enforce per-tool scopes; write an audit line per call.
- **After:** unauthenticated calls return `{code: "auth_required"}`; insufficient scope returns `{code: "forbidden"}` with `details.missing_scope`.
- **Verify:** harness without a token fails with `auth_required`; harness with a token missing a scope fails with `forbidden`; harness with full scope passes evals.
- **Enables:** W7 multi-tenancy keys off the `sub` and a `tenant` claim; W10 cost attribution reads the same claims.

### Evolution: docker-compose

- **Before (end of W5):** server + Postgres.
- **Change:** add `issuer` service running the minimal local issuer on `localhost:9000` with a static signing key.
- **After:** three-service local stack; server validates against the local JWKS URL.

### Evolution: error taxonomy

- **Before:** 6-8 codes.
- **Change:** add `auth_required`, `auth_invalid`; treat scope failures as `forbidden` with `details.missing_scope`.

### Evolution: eval set

- **Change:** rerun entire phase-1 set under auth; add cases for missing token, expired token, insufficient scope.

## Checkpoint (planned)

- [ ] All tool calls require a valid JWT
- [ ] Per-tool scopes enforced
- [ ] Local issuer mints tokens that validate end-to-end
- [ ] Audit log writes one line per authenticated call
- [ ] Phase 1 evals still pass under auth
- [ ] `git tag week-6-complete`

## ADR candidates

- Token validation: local JWKS cache vs. live fetch per request
- Scope design: coarse (`read`, `write`) vs. tool-specific (`issues:write`)
- Audit log retention and format (JSON lines vs. DB table)
