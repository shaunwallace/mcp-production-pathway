---
title: Week 7 — DCR, multi-tenancy, tamper-evident audit, quotas (Phase 3, part 2)
---

# Week 7 — DCR, multi-tenancy, tamper-evident audit, quotas (Phase 3, part 2)

**Time budget:** 10 to 14 hours across four sittings. Second-densest week in the pathway, after W6.

:::tip[Where the real work is]
W6 made auth correct. W7 makes it usable at scale. Four pieces, each independently load-bearing: clients can self-register (DCR), tokens are tenant-scoped end-to-end, the audit log is cryptographically tamper-evident, and a misbehaving tenant can't starve the others (quotas). Each piece is a week of work elsewhere; this week threads them together against the foundation W6 laid.
:::

## What you'll have by the end of the week

- A real OAuth 2.1 client in the harness — discovery, PKCE, token exchange, refresh, automatic 401-driven re-auth — with no static-token shortcut
- **Dynamic Client Registration** (RFC 7591) on the local issuer, used by the harness on first connect; registration metadata persisted in the issuer's DB
- **Multi-tenancy** end-to-end: every JWT carries a `tenant` claim, every tool call resolves a tenant context, every Postgres query scopes by tenant via either RLS or a tenant-id column the framework enforces
- **Per-tenant quotas** with a token-bucket implementation; an exceeding tenant gets `rate_limited` while peers are unaffected
- **Tamper-evident audit log** built on a hash chain — each entry includes the SHA-256 of the previous entry, so any after-the-fact mutation is detectable by re-walking the chain
- A daily **chain-verification job** that runs in compose and emits a Prometheus counter for "audit chain breaks detected"
- **Phase 3 memo** — second of three. ~800 words. Identity and tenancy tradeoffs.

## Why this week exists

W6 leaves you with a single-tenant server protected by valid OAuth 2.1. That's enough to ship if you have one customer. Real production has two complications it doesn't:

1. **Onboarding is interactive.** Real clients can't be hand-registered in your AS's admin UI. Dynamic Client Registration (RFC 7591) lets a client POST its metadata to a registration endpoint and receive a `client_id` in response. Without DCR, every new client integration is a support ticket.

2. **One bad tenant degrades all the others.** Without quotas, a tenant burning through your backend's rate limit takes the rest of your customers down with them. Without tenant scoping at the data layer, a bug in one tool surface can leak across tenants — the worst class of incident in any multi-tenant system.

The audit log piece — making it tamper-evident — sits alongside these because it's the foundation for trust in a multi-tenant audit trail. A tenant disputing a charge, a regulator asking who ran what when, an investigator tracing a leak: all of these need the audit log to be something you can stand behind under scrutiny. Plain JSONL isn't.

## Reading list

1. **RFC 7591 — OAuth 2.0 Dynamic Client Registration.** (~25min) Short. The error-response codes are the bit people get wrong.
   → <https://datatracker.ietf.org/doc/html/rfc7591>
2. **RFC 7592 — Dynamic Client Registration Management.** (~15min) The "manage your registered client after the fact" companion. Optional this week; useful to know exists.
   → <https://datatracker.ietf.org/doc/html/rfc7592>
3. **Google, "Multi-tenancy isolation models" (any current version).** (~20min) The shared-schema / separate-schema / separate-DB tradeoff. The pathway picks shared-schema; the document explains when you'd pick something else.
4. **PostgreSQL row-level security docs.** (~30min) RLS is one of two real implementation choices for tenant scoping; understand it before deciding.
   → <https://www.postgresql.org/docs/current/ddl-rowsecurity.html>
5. **Stripe engineering, "Scaling multi-tenant systems."** (~20min) The reference document for token-bucket rate limiting in a multi-tenant context.
6. **Scott Helme or any current write-up on hash-chain audit logs.** (~15min) Also called "tamper-evident logs," "linked timestamping," or "Merkle log lite." The construction is small; the trap is assuming it gives you tamper-*proof*.

## Tooling additions

- **`pg-listen`** for `LISTEN`/`NOTIFY`-driven cache invalidation when tenant or quota config changes. Optional; adds polish without much risk. Alternative: poll every N seconds (simpler, fine for now).
- **No new auth lib.** PKCE in the harness is ~20 lines of `crypto.subtle`; DCR is a JSON POST. Resist the urge to add a library that hides the protocol you're meant to be reading.
- **`prom-client`** lands properly in W9; this week emits one counter via a tiny shim so the chain-verification job can publish a metric. The shim gets replaced in W9.

## Setup checklist

- [ ] Week 6 complete; phase-1 evals pass under static-token auth
- [ ] Postgres has the W5 schema; you'll add three tables this week (`oauth_clients`, `tenants`, `audit_chain`)
- [ ] You've decided whether you'll implement tenant scoping via RLS or via app-layer enforcement (the ADR for this is the most consequential of the week — see "Tenancy implementation choices" below)

---

## Step 1 — Dynamic Client Registration

The local issuer needs one new endpoint: `POST /register`. The harness, on first connect, posts its metadata and receives back a `client_id`. From then on the client can do PKCE flows.

### The registration endpoint

```ts
// tools/local-issuer/src/index.ts (excerpt)
app.post("/register", async (c) => {
  const body = await c.req.json();

  // RFC 7591 §2 — required and optional metadata.
  const required = ["client_name", "redirect_uris"];
  for (const f of required) {
    if (!body[f]) return c.json({ error: "invalid_client_metadata", error_description: `${f} required` }, 400);
  }

  // Validate redirect_uris — must be HTTPS, localhost exempt, no fragments.
  for (const uri of body.redirect_uris) {
    const u = new URL(uri);
    if (u.protocol !== "https:" && u.hostname !== "127.0.0.1" && u.hostname !== "localhost") {
      return c.json({ error: "invalid_redirect_uri" }, 400);
    }
    if (u.hash) return c.json({ error: "invalid_redirect_uri" }, 400);
  }

  const client_id = `client_${randomString(24)}`;
  const client_secret = body.token_endpoint_auth_method === "none" ? null : randomString(48);

  await oauthClients.store({
    client_id,
    client_secret_hash: client_secret ? sha256Hex(client_secret) : null,
    client_name: body.client_name,
    redirect_uris: body.redirect_uris,
    grant_types: body.grant_types ?? ["authorization_code", "refresh_token"],
    scope: body.scope ?? "mcp:read mcp:write",
    token_endpoint_auth_method: body.token_endpoint_auth_method ?? "none",
    created_at: Date.now(),
  });

  return c.json({
    client_id,
    client_secret,                              // returned ONCE; never recoverable
    client_id_issued_at: Math.floor(Date.now() / 1000),
    client_secret_expires_at: 0,                // 0 = does not expire
    redirect_uris: body.redirect_uris,
    grant_types: body.grant_types ?? ["authorization_code", "refresh_token"],
    token_endpoint_auth_method: body.token_endpoint_auth_method ?? "none",
  });
});
```

Three things worth pausing on:

- **`client_secret` returned exactly once.** Storage is the SHA-256 hash; the plaintext is only in the response body to this single request. Lose it and the client must re-register. (RFC 7592 lets you implement an update flow if you want — out of scope this week.)
- **`redirect_uris` validation.** HTTPS only, localhost exempt for development, no fragments. Lax redirect validation is how authorization-code interception happens.
- **The endpoint is open by default.** That's RFC 7591's `Open Registration` profile. For a public-facing AS you'd require an initial-access token (RFC 7591 §3); for the local issuer, open is fine. Document this in your ADR — production AS choices will require a different position.

### Discovery: advertising the endpoint

Update the local issuer's `/.well-known/oauth-authorization-server` to include:

```ts
registration_endpoint: `${ISSUER_URL}/register`,
registration_endpoint_auth_methods_supported: ["none"],   // or ["bearer"] in production
```

A compliant client now finds the endpoint via discovery, posts its metadata, and proceeds.

### Harness registration on first connect

```ts
// harness/src/auth/register.ts
export async function ensureRegistered(metadataUrl: string): Promise<{ client_id: string; client_secret?: string }> {
  const cached = await loadFromDisk();          // ~/.config/mcp-harness/clients.json
  if (cached) return cached;

  const meta = await fetch(metadataUrl).then(r => r.json());
  const reg = await fetch(meta.registration_endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_name: "pathway-harness",
      redirect_uris: ["http://127.0.0.1:54321/callback"],
      grant_types: ["authorization_code", "refresh_token"],
      token_endpoint_auth_method: "none",
      scope: "mcp:read mcp:write",
    }),
  }).then(r => r.json());

  await saveToDisk(reg);
  return reg;
}
```

The harness now bootstraps from "I know the resource URL" to "I have a client registered with the AS that protects it" without human intervention. That's the user experience DCR exists to enable.

---

## Step 2 — The full PKCE flow in the harness

W6 had the harness use a static token. This week it does the real flow.

```ts
// harness/src/auth/flow.ts
import { createHash, randomBytes } from "node:crypto";

function pkcePair() {
  const verifier = base64url(randomBytes(32));
  const challenge = base64url(createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

export async function login({ resourceUrl, scope, loginAs }: LoginArgs): Promise<TokenSet> {
  // 1. Discover RS metadata.
  const prm = await fetch(`${resourceUrl}/.well-known/oauth-protected-resource`).then(r => r.json());
  const issuer = prm.authorization_servers[0];

  // 2. Discover AS metadata.
  const asMeta = await fetch(`${issuer}/.well-known/oauth-authorization-server`).then(r => r.json());

  // 3. Ensure we're registered.
  const { client_id } = await ensureRegistered(asMeta.registration_endpoint);

  // 4. Authorize with PKCE + resource indicator.
  const { verifier, challenge } = pkcePair();
  const state = base64url(randomBytes(16));
  const callbackPort = 54321;
  const redirect_uri = `http://127.0.0.1:${callbackPort}/callback`;
  const authUrl = new URL(asMeta.authorization_endpoint);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", client_id);
  authUrl.searchParams.set("redirect_uri", redirect_uri);
  authUrl.searchParams.set("code_challenge", challenge);
  authUrl.searchParams.set("code_challenge_method", "S256");
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("scope", scope);
  authUrl.searchParams.set("resource", resourceUrl);             // RFC 8707
  if (loginAs) authUrl.searchParams.set("login_as", loginAs);    // local-issuer affordance

  const code = await runCallbackServer(callbackPort, authUrl.toString(), state);

  // 5. Exchange code for tokens.
  const tokenRes = await fetch(asMeta.token_endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri,
      client_id,
      code_verifier: verifier,
      resource: resourceUrl,                                      // RFC 8707
    }),
  }).then(r => r.json());

  return tokenRes;
}
```

Flow is exactly what the W6 sequence diagram shows; reading it after W6 makes the diagram concrete.

### Refresh and re-auth on 401

```ts
// harness/src/auth/refresh.ts
export async function callWithAutoRefresh<T>(token: TokenSet, op: (t: TokenSet) => Promise<Response>): Promise<T> {
  let res = await op(token);
  if (res.status !== 401) return res.json() as Promise<T>;

  const refreshed = await refreshToken(token);
  if (!refreshed) {
    // Refresh failed — fall back to a full re-auth.
    const fresh = await login(currentLoginArgs);
    res = await op(fresh);
  } else {
    res = await op(refreshed);
  }
  if (!res.ok) throw new Error(`auth retry failed: ${res.status}`);
  return res.json() as Promise<T>;
}
```

The `WWW-Authenticate` header on the 401 tells the client *why* it failed; in practice the harness only differentiates "token expired" (refresh) from "everything else" (re-auth). More elaborate logic is unnecessary at this layer.

---

## Step 3 — Multi-tenancy

Two implementation choices, one ADR. Pick one and live with it.

### Tenancy implementation choices

| Approach | What you do | Why pick it | Why avoid it |
|---|---|---|---|
| **App-layer (`tenant_id` in every query)** | Every Postgres call goes through a query builder that injects `WHERE tenant_id = $current` | Simple, explicit, easy to audit at code review | A single missed call is a cross-tenant leak; defence-in-depth requires another layer |
| **Postgres RLS (row-level security)** | Set `app.tenant_id` per request; tables have policies `USING (tenant_id = current_setting('app.tenant_id'))` | The DB enforces the boundary; missing a `WHERE` clause is no longer fatal | Higher learning curve; harder to debug when a query mysteriously returns nothing |
| **Schema-per-tenant** | Each tenant has its own Postgres schema; connection string sets the search path | Strong isolation; per-tenant backup/restore trivial | Schema migrations apply to every tenant; doesn't scale past low hundreds of tenants |
| **DB-per-tenant** | Each tenant has its own Postgres database | Strongest isolation; per-tenant resource limits trivial | Operational complexity; high overhead; only justified at very large scale or strict regulatory boundaries |

**Recommendation for the pathway: app-layer + RLS.** The query builder gives you a code-review story; RLS gives you defence-in-depth. The two layers fail differently — app-layer protects against bugs in the dispatcher; RLS protects against bugs in the query builder. Together, both have to break for a tenant leak to occur.

### The data model

Three new tables (in W5's `migrations/`):

```sql
-- 0007_tenants.sql
CREATE TABLE tenants (
  id              TEXT PRIMARY KEY,
  display_name    TEXT NOT NULL,
  quota_per_min   INTEGER NOT NULL DEFAULT 60,
  status          TEXT NOT NULL DEFAULT 'active',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Every tenant-scoped table gains a tenant_id column.
ALTER TABLE sessions       ADD COLUMN tenant_id TEXT NOT NULL REFERENCES tenants(id);
ALTER TABLE session_events ADD COLUMN tenant_id TEXT NOT NULL REFERENCES tenants(id);
ALTER TABLE prompt_invocations ADD COLUMN tenant_id TEXT NOT NULL REFERENCES tenants(id);

-- 0008_rls.sql — defence-in-depth.
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON sessions
  USING (tenant_id = current_setting('app.tenant_id'));
-- Repeat for every tenant-scoped table.
```

### Resolving the tenant per request

```ts
// server/src/tenancy/context.ts
export const tenantContext = new AsyncLocalStorage<{ tenantId: string }>();

export async function withTenant(c: Context, next: Next) {
  const principal = c.get("principal") as Principal;
  const tenantId = principal.tenant ?? "default";

  // Verify tenant exists and is active.
  const tenant = await db.tenants.byId(tenantId);
  if (!tenant) return c.json({ error: "unknown_tenant" }, 401);
  if (tenant.status !== "active") return c.json({ error: "tenant_suspended" }, 403);

  // Set the RLS-driven session variable for this request.
  await db.query(`SET LOCAL app.tenant_id = $1`, [tenantId]);

  return tenantContext.run({ tenantId }, () => next());
}
```

Wire `withTenant` after `authenticate` in the middleware chain. From here on, every Postgres call inside the request inherits the right tenant context — both at the app layer (the query builder reads `tenantContext`) and at the DB layer (RLS reads `app.tenant_id`).

The local issuer needs to mint tokens with a `tenant` claim. Add a `tenant` parameter to the `/authorize` endpoint (or fetch it from the user-tenant mapping table). For the local issuer, a query parameter is fine; for a real AS this comes from the user's profile.

---

## Step 4 — Per-tenant quotas

Token-bucket implementation. Each tenant has a bucket of `quota_per_min` tokens that refills at the same rate; each authenticated tool call consumes one. When the bucket hits zero, return `rate_limited`.

```ts
// server/src/tenancy/quota.ts
export async function consumeQuota(tenantId: string): Promise<{ ok: true } | { ok: false; retryAfterMs: number }> {
  const now = Date.now();

  const result = await db.query(`
    INSERT INTO tenant_buckets (tenant_id, tokens, last_refill_at, capacity)
      SELECT $1, t.quota_per_min, $2, t.quota_per_min FROM tenants t WHERE t.id = $1
    ON CONFLICT (tenant_id) DO UPDATE SET
      tokens = LEAST(
        tenant_buckets.capacity,
        tenant_buckets.tokens + (($2 - tenant_buckets.last_refill_at) * tenant_buckets.capacity / 60000)::int
      ),
      last_refill_at = $2
    RETURNING tokens, capacity, last_refill_at
  `, [tenantId, now]);

  const row = result.rows[0];
  if (row.tokens >= 1) {
    await db.query(`UPDATE tenant_buckets SET tokens = tokens - 1 WHERE tenant_id = $1`, [tenantId]);
    return { ok: true };
  }

  // Compute retry-after.
  const msPerToken = 60000 / row.capacity;
  return { ok: false, retryAfterMs: Math.ceil(msPerToken - (now - row.last_refill_at)) };
}
```

Wire into the middleware:

```ts
app.use("/mcp", authenticate, withTenant, async (c, next) => {
  const result = await consumeQuota(c.get("principal").tenant);
  if (!result.ok) {
    c.header("Retry-After", String(Math.ceil(result.retryAfterMs / 1000)));
    return c.json(toolError(ToolErrorCode.RateLimited, "Tenant quota exceeded", {
      cause: "tenant_quota",
      retry_after_ms: result.retryAfterMs,
      tenant: c.get("principal").tenant,
    }), 429);
  }
  return next();
});
```

Three implementation notes:

- **Postgres for the bucket store is fine at this stage.** Redis is the scale-out answer when the bucket-update query becomes the hottest write path; pre-Redis, the row-level locking that Postgres gives you is one less moving part.
- **Quota is per-tenant, not per-subject.** If you also want per-user quotas (a single user inside a tenant burning the tenant's budget), it's a second table and a second middleware. Don't ship it without a reason.
- **Quota responses must include `Retry-After` and a structured-error `details.retry_after_ms`.** The model needs both: the header for HTTP-level clients, the structured detail for the agent loop's retry logic.

---

## Step 5 — Tamper-evident audit log

W6 wrote plain JSONL. This week makes each line link to the previous one via a hash, so any after-the-fact mutation is detectable.

### The construction

```
entry_n = {
  ts, event, subject, tenant, tool, args_hash, jti, outcome, duration_ms,   // payload
  seq: n,
  prev_hash: sha256(canonical_json(entry_{n-1})),
  hash:      sha256(canonical_json({ ...payload, seq, prev_hash })),
}
```

Each entry's `hash` covers the payload plus the previous entry's hash. Mutating any entry changes its `hash`; the next entry's `prev_hash` no longer matches the recomputed hash; the chain breaks. A daily verification job walks the chain and asserts every link.

```ts
// server/src/audit/chain.ts
import { createHash } from "node:crypto";

interface AuditEntry {
  ts: string; event: string; subject: string; tenant: string;
  tool: string; args_hash: string; jti: string;
  outcome: "ok" | "error" | "denied"; duration_ms: number;
  seq: number; prev_hash: string; hash: string;
}

let lastHash: string = "GENESIS";       // loaded from DB on boot
let nextSeq = 0;

export async function append(payload: Omit<AuditEntry, "seq" | "prev_hash" | "hash">) {
  const seq = nextSeq++;
  const prev_hash = lastHash;
  const toHash = canonicalJson({ ...payload, seq, prev_hash });
  const hash = createHash("sha256").update(toHash).digest("hex");
  const entry: AuditEntry = { ...payload, seq, prev_hash, hash };

  await db.query(`
    INSERT INTO audit_chain (seq, prev_hash, hash, payload)
    VALUES ($1, $2, $3, $4)
  `, [seq, prev_hash, hash, JSON.stringify(payload)]);

  lastHash = hash;
  return entry;
}

export async function verifyChain(): Promise<{ ok: true } | { ok: false; brokenAt: number }> {
  let prev = "GENESIS";
  for await (const row of db.streamRows(`SELECT seq, prev_hash, hash, payload FROM audit_chain ORDER BY seq`)) {
    if (row.prev_hash !== prev) return { ok: false, brokenAt: row.seq };
    const recomputed = createHash("sha256")
      .update(canonicalJson({ ...row.payload, seq: row.seq, prev_hash: row.prev_hash }))
      .digest("hex");
    if (recomputed !== row.hash) return { ok: false, brokenAt: row.seq };
    prev = row.hash;
  }
  return { ok: true };
}
```

### The verification job

```yaml
# docker-compose.yml (excerpt)
audit-verify:
  build: ./tools/audit-verify
  depends_on: [postgres]
  environment:
    DATABASE_URL: postgres://mcp:mcp@postgres:5432/mcp
    PROMETHEUS_PUSHGATEWAY: pushgateway:9091
  restart: unless-stopped
  # Runs every 24h via tools/audit-verify/cron.sh
```

The job runs daily, calls `verifyChain()`, and emits a Prometheus metric:

```
audit_chain_intact{environment="local"} 1     # or 0 with broken_at_seq label
audit_chain_length{environment="local"} 18234
audit_chain_last_verified_seconds{environment="local"} 1714104000
```

In W9 the metric routes through OTel; this week emit it via `prom-client` directly (the metrics shim mentioned earlier).

### What this construction does and doesn't give you

- **Detects** any after-the-fact mutation, deletion, or reordering of audit entries by anyone who lacks access to the chain head.
- **Does not prevent** mutation by an attacker who can rewrite the entire database (they recompute every hash and `last_hash` and the chain remains internally consistent). To prevent that, periodically publish the latest `hash` to a write-once external store (S3 with object lock, a transparency log, a tamper-evident timestamping service). That's tamper-*proof* — not in scope this week.
- **Does not prove** the entries were written at the times the `ts` field claims. For that, integrate with RFC 3161 timestamping. Out of scope.

The right mental model: this week's chain detects sloppy tampering. Production tamper-*proof* requires periodically anchoring the chain head externally. Document the gap honestly in `THREATS.md`.

---

## Phase 3 memo (`memos/02-identity-and-tenancy.md`)

The second of three memos. ~800 words. Audience: your exec team, a technical partner, or a candidate evaluating your platform's auth posture.

Required sections:

- **TL;DR** — three bullets capturing your position on identity and tenancy.
- **Context** — one paragraph: what shipped in Phase 3, what didn't, what you defer to W12.
- **Argument** — your opinionated view. Defend the choices that surprised you. Examples worth taking a position on:
  - Why OAuth 2.1 over API keys as the primary path (and why API keys are the secondary path, not banned).
  - Why audience binding is non-negotiable, not a nice-to-have.
  - Why tenant scoping has two layers (app + RLS) instead of one.
  - Why the audit log is tamper-evident, not tamper-proof — and what you'd add if a regulator asked.
  - Why coarse scopes (`mcp:read`, `mcp:write`) over tool-specific scopes for the first iteration.
- **What I'd say in a design review** — 2-3 sentences that would survive contact with a senior reviewer.
- **What I changed my mind on** — one thing, honest. Memo 1 was about MCP; memo 2 should reveal a position you held in W6 and abandoned by W7.

The memo is the artefact a future-you (or a future hire) reads to understand *why* the auth shape is what it is. The implementation will rot; the reasoning won't.

---

## Artefact evolution

### Evolution: harness

- **Before (end of W6):** static token from `MCP_TOKEN` env.
- **Change:** full PKCE flow with Resource Indicators on authorize and token requests; DCR on first connect; refresh on 401; full re-auth on refresh failure.
- **After:** harness can run `harness --login tenant-a "..."` from a clean state and complete the entire auth flow against the local issuer end-to-end.
- **Verify:** delete `~/.config/mcp-harness/clients.json` and `~/.config/mcp-harness/tokens.json`; run a query; harness re-registers, re-authenticates, runs to completion.
- **Enables:** W10 cost attribution groups by the tenant the harness logged in as; W11's concurrent harness logs in as N different tenants and exercises tenant isolation under load.

### Evolution: server

- **Before (end of W6):** single-tenant; tokens valid; audit log plain JSONL.
- **Change:** every request resolves a tenant from the JWT `tenant` claim; every Postgres call scopes by tenant via app-layer + RLS; per-tenant quota enforced at the middleware; audit log writes hash-chained entries to `audit_chain`.
- **After:** two tenants running against the same server can't see each other's data even via a deliberate cross-tenant query; an exceeding tenant's calls return `rate_limited` while peers are unaffected; the audit log can be verified via `tools/audit-verify`.
- **Verify:** integration test runs two harness instances under different tenants concurrently, asserts each sees its own data only; load-spikes one tenant past `quota_per_min`, asserts the other tenant is unaffected; mutate one row in `audit_chain` and confirm `verifyChain()` returns `{ ok: false, brokenAt }` at the right `seq`.
- **Enables:** W8 deployment runs the same compose against a hosted Postgres; W12 threat model attacks the tenant boundary in earnest.

### Evolution: docker-compose

- **Before (end of W6):** server + Postgres + migrate + local-issuer.
- **Change:** add `audit-verify` cron service emitting one Prometheus metric.
- **After:** five services + a one-shot migrate; daily verification of the audit chain.
- **Enables:** W9 routes the metric through OTel; W12 cites the verification job in the threat model.

### Evolution: error taxonomy

- **Change:** `rate_limited` now carries `details.retry_after_ms` and `details.cause: "tenant_quota"`; tenant-suspension at the middleware returns `forbidden` with `details.cause: "tenant_suspended"`. **Still 6 codes** — keep the discipline.

### Evolution: eval set

- **Change:** duplicate phase-1 cases under three tenants (`alpha`, `beta`, `gamma`); the three runs must produce identical pass rates against isolated data. Add `tenancy.cross_tenant_leak.attempted` (deliberate cross-tenant query attempt; expect `forbidden`). Add `quota.exceeded.gracefully` (load-spike one tenant; assert peers see no degradation). Add `dcr.first_connect` (clean-state harness re-registers and runs).
- **After:** eval set has three tenancy-class cases beyond the duplicated phase-1 set.

### Evolution: consumer README

- **Change:** add a "Dynamic Client Registration" subsection under Authentication, with a one-curl example. Document the supported `token_endpoint_auth_method` values and the `Retry-After` semantics on quota responses.
- **After:** a third-party client author can integrate from cold without your help.

### Evolution: THREATS.md

- **Change:** add **cross-tenant data leak** (defended by app-layer + RLS), **tenant impersonation via forged JWT** (defended by signature + audience + tenant claim verification), **quota bypass via concurrent burst** (defended by atomic Postgres update; document the residual race window honestly), **audit-log mutation** (detected by hash chain; **explicitly note the gap** between tamper-evident and tamper-proof), **rogue DCR registration** (limit by initial-access token in production, ADR'd).
- **After:** the auth section of `THREATS.md` is comprehensive enough to hand to a security reviewer.

---

## Common pitfalls

:::danger[The seven ways Week 7 goes wrong]
- **Forgetting the `resource` parameter on token refresh.** Refresh requests also carry the resource indicator (RFC 8707 §2). Omit it and the refresh-issued token has no `aud`, your RS rejects it, and you'll spend an hour debugging.
- **Open DCR in production.** Fine for the local issuer; a denial-of-service vector against a real AS. Production deployments should require an initial-access token (RFC 7591 §3) or an admin-approval queue.
- **App-layer-only tenancy.** A single missed `WHERE tenant_id = $1` is a cross-tenant leak. RLS is the second layer that catches the inevitable bug.
- **Returning `Retry-After` in seconds when the bucket refills in milliseconds.** Round up. A `Retry-After: 0` is a wedge for tight retry loops that pin your DB.
- **Trusting the JWT `tenant` claim without checking the tenant exists and is active.** A token issued before a tenant was suspended is still cryptographically valid — the suspension lives in *your* DB, not the token.
- **Calling the audit log "tamper-proof."** It isn't, and a security reviewer will notice. "Tamper-evident, with external anchoring as a future enhancement" is the honest phrase.
- **Using `Date.now()` as the audit-log timestamp source without an NTP-disciplined clock.** Acceptable for a learning pathway; for compliance contexts you'll integrate RFC 3161 timestamping. Note the gap.
:::

## Checkpoint — you've completed Week 7 when

- [ ] Local issuer's `/register` endpoint accepts well-formed RFC 7591 metadata and rejects malformed redirect URIs
- [ ] Harness completes a full PKCE + DCR + token-exchange flow end-to-end from a clean state
- [ ] `resource=` parameter present on authorize, token, and refresh requests
- [ ] Refresh on 401; full re-auth on refresh failure; reuse of a refresh token revokes the family
- [ ] Three tenants seeded; the same eval suite runs under all three with identical pass rates and no cross-tenant data visibility
- [ ] Per-tenant quota enforced at the middleware; an exceeding tenant gets `rate_limited` with `Retry-After`; peer tenants unaffected
- [ ] Tenant scoping enforced at both layers (app-layer query builder + Postgres RLS); deliberate `tenant_id` mismatch in a query returns nothing rather than leaking
- [ ] Audit chain implemented; mutating any row in `audit_chain` causes `verifyChain()` to return `{ ok: false, brokenAt }` pointing at the right entry
- [ ] `audit-verify` service runs in compose and emits the three Prometheus metrics
- [ ] `THREATS.md` extended with five new sections; the tamper-evident-vs-tamper-proof gap explicitly documented
- [ ] `memos/02-identity-and-tenancy.md` committed; ~800 words; required sections present
- [ ] ADR written for the tenancy approach (app-layer + RLS recommended)
- [ ] ADR written for the DCR profile in production (initial-access token or admin queue)
- [ ] `git tag week-7-complete`
- [ ] `git tag phase-3-complete` after `make verify`

## Leadership lens

Identity is where multi-tenant systems live or die. The questions worth asking a candidate or a vendor:

1. **"How does a new client get a `client_id` in your system?"** A good answer involves DCR, an initial-access token, or a documented admin flow. A bad answer is "they email us."
2. **"Show me a query in your codebase that touches a tenant-scoped table without a tenant filter. Then show me what happens at runtime."** A good answer is "RLS rejects it." A bad answer is "we have linting that catches that."
3. **"What does your audit log look like, and what would happen if I — with database access — wanted to alter an entry?"** A good answer is "you'd be detected by the chain verification job within 24 hours; you'd be undetectable only if you also rewrote the externally-anchored chain head, which we publish to S3 with object lock." A bad answer is "we trust the database."
4. **"What's your largest tenant's blast radius if their token leaks?"** A good answer specifies the audience, the scopes, the quota, and the revocation path. A bad answer involves the word "all."

Each of these is one question with a five-minute answer. Each separates teams that have run multi-tenant in production from teams that have read about it.

## Optional rabbit holes

- **Initial-access tokens for DCR (RFC 7591 §3).** The production answer to "open DCR is a DoS vector." Worth implementing as a stretch goal.
- **Software statement (RFC 7591 §2.3).** A signed JWT asserting client metadata, vouched-for by a third party. Niche; useful in B2B integration scenarios.
- **External anchoring of the audit chain.** Periodically write `last_hash` to S3 with object lock, or to a public transparency log. Closes the gap between tamper-evident and tamper-proof.
- **Per-user-within-tenant quotas.** Second middleware after `consumeQuota`; second bucket table. Don't ship without a reason.
- **Replace Postgres bucket with Redis.** When the bucket-update query is the hottest write path. Today it isn't; in W11 under load it might be — that's the right time to revisit.
- **DPoP-bound access tokens.** Sender-constrained tokens. Not in the MCP spec; worth understanding for FAPI-class deployments.

## ADR candidates

- **Tenancy implementation** — app-layer only vs. RLS only vs. both. Recommended: both.
- **DCR profile in production** — open vs. initial-access-token vs. admin-approval queue. Recommended: initial-access-token.
- **Quota algorithm** — token bucket vs. fixed window vs. sliding window. Recommended: token bucket.
- **Quota store** — Postgres vs. Redis. Recommended: Postgres until evidence (W11) says otherwise.
- **Audit-log anchoring** — none vs. S3 object lock vs. transparency log. Recommended: none for the pathway, with the gap documented and the path forward sketched in `THREATS.md`.
- **Per-tenant signing keys** — single AS key vs. per-tenant keys. Recommended: single key; per-tenant keys solve a different problem (tenant-controlled identity) and add operational complexity.
- **Tenant resolution source** — JWT claim vs. URL path vs. header. Recommended: JWT claim — keeps tenancy a property of identity, not request shape.
