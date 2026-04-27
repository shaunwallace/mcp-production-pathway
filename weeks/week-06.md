---
title: Week 6 — OAuth 2.1 done correctly for MCP (Phase 3, part 1)
---

# Week 6 — OAuth 2.1 done correctly for MCP (Phase 3, part 1)

**Time budget:** 10 to 14 hours across four sittings. This is the densest week in the pathway.

:::tip[Where the real work is]
The OAuth flow itself is well-trodden ground. The work is in the **MCP-specific bits the 2025 spec added**: discovery via Protected Resource Metadata, audience-binding via Resource Indicators, and the Authorization Server / Resource Server separation. Every MCP server I've audited fails on at least two of these three. Your goal this week is to get all three right.
:::

## What you'll have by the end of the week

- A working OAuth 2.1 flow end-to-end, **offline**, against a ~100-line local issuer running in docker-compose
- An MCP server that acts as a proper **Resource Server** (RS): validates JWTs, enforces audience binding, returns `WWW-Authenticate` on 401 with discovery metadata
- **Protected Resource Metadata** (RFC 9728) at `/.well-known/oauth-protected-resource` so any compliant client can discover where to authenticate
- **Resource Indicators** (RFC 8707) wired through both sides: the harness asks for tokens scoped to your server's URI; the server rejects any token whose `aud` doesn't match
- **Refresh-token rotation with reuse detection** — a stolen refresh token revokes the entire family
- **Revocation** (RFC 7009) and **introspection** (RFC 7662) endpoints on the local issuer; revocation cache on the server
- **API-key fallback** for service-to-service consumers, sharing the same scope and audit pipeline as JWT auth
- An **audit log** writing one structured line per authenticated call — extended in W7 to be tamper-evident
- The error taxonomy unchanged at six codes (`auth_required` and scope failures fold into existing codes via `details.cause`)

## Why this week exists

Production MCP servers fail at auth more than at any other layer. Three patterns recur in audits:

1. **No audience binding.** The server accepts any signed JWT from the configured issuer, regardless of who the token was issued *for*. A user grants your MCP server permission to act on their behalf; an attacker registers a different MCP server that asks for the same scopes; the user's token from the attacker's server now works against yours. This is the **confused-deputy attack**, and the fix — Resource Indicators (RFC 8707) — has existed since 2020 and is named explicitly in the 2025 MCP spec. Almost no MCP server enforces it.

2. **No discovery.** The client has to know the issuer URL out-of-band. This forces every client author to ship a configuration step ("paste your IdP URL here") that no end-user will navigate correctly. RFC 9728 Protected Resource Metadata exists to make this discoverable; the 2025 MCP spec mandates it. The five-line fix is omitted because "we'll add it later."

3. **One issuer, all powers.** The server is both the Authorization Server (issuing tokens) and the Resource Server (validating them). This couples your auth implementation to your tool surface, makes federated identity impossible, and means rotating signing keys requires shipping a new MCP server. The 2025 MCP spec separates these explicitly. You'll keep them separate from day one.

These three things are why this week is dense. The OAuth 2.1 flow is mechanical. The MCP-specific glue is what determines whether your server is auditable.

## Reading list

The reading is non-negotiable this week. Skim the wrong RFC and you'll write the wrong code.

1. **MCP spec — Authorization section (2025-06-18 or later).** (~45min) This is the load-bearing document. Read it twice. Pay particular attention to the AS/RS separation diagram and the discovery flow.
   → <https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization>
2. **OAuth 2.1 draft.** (~60min) The unification of OAuth 2.0 + best-current-practice + PKCE-mandatory.
   → <https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1>
3. **RFC 9728 — OAuth 2.0 Protected Resource Metadata.** (~20min) Short and load-bearing. The whole flow hinges on this.
   → <https://datatracker.ietf.org/doc/html/rfc9728>
4. **RFC 8707 — Resource Indicators for OAuth 2.0.** (~20min) Even shorter. Read every line.
   → <https://datatracker.ietf.org/doc/html/rfc8707>
5. **RFC 7636 — PKCE.** (~15min) Mechanical, well-explained.
   → <https://datatracker.ietf.org/doc/html/rfc7636>
6. **RFC 8725 — JWT Best Current Practices.** (~30min) The list of things JWT libraries do wrong by default.
   → <https://datatracker.ietf.org/doc/html/rfc8725>
7. **Aaron Parecki, "OAuth 2.1: What's changed?"** (~15min) The plain-English summary of the OAuth 2.1 unification.
   → search: "Aaron Parecki OAuth 2.1"

Optional but useful:
- **RFC 7009 — OAuth 2.0 Token Revocation.** (~10min) You'll implement it.
- **RFC 7662 — OAuth 2.0 Token Introspection.** (~10min) You'll implement it (the endpoint, not the validation path — JWTs validate offline).

## The tooling stack for this week

- **jose** for JWT verification and (in the local issuer) signing. Battle-tested, ESM-native, RFC 8725-compliant by default. Alternatives: [jsonwebtoken](https://github.com/auth0/node-jsonwebtoken) (older API, foot-gun-prone defaults), [panva/openid-client](https://github.com/panva/openid-client) (full OIDC client; overkill for server-side validation but a fair choice if you want a real client too).
- **Postgres** (carried over from W5) for refresh-token lineage, the revocation cache, and the audit log.
- **The local issuer is hand-rolled.** ~100 lines of `jose` and `hono`. The point is that you read every line of your auth implementation; pulling in `node-oidc-provider` would hide the bits this week is meant to expose.

Install in the server scaffold:

```bash
cd server
npm install jose
```

A new sibling project for the local issuer:

```bash
mkdir -p tools/local-issuer/src
cd tools/local-issuer
npm init -y
npm install hono @hono/node-server jose pg better-sqlite3
```

## Setup checklist

- [ ] Week 5 complete; Postgres-backed sessions persist across restarts
- [ ] `openssl rand -hex 32` works (you'll generate signing material)
- [ ] An understanding that you'll spend 4 hours reading and 6 hours coding, in that order. Resist the urge to invert.

---

## The shape of the flow

Before any code, fix the picture in your head. Three actors:

```
┌─────────────┐                ┌──────────────────┐                ┌──────────────────┐
│   Client    │                │ Authorization    │                │  Resource Server │
│  (harness)  │                │     Server       │                │   (MCP server)   │
│             │                │ (local-issuer)   │                │                  │
└─────────────┘                └──────────────────┘                └──────────────────┘
       │                              │                                     │
       │ 1. unauthenticated request   │                                     │
       ├─────────────────────────────────────────────────────────────────►  │
       │                              │                                     │
       │ 401 + WWW-Authenticate + resource_metadata URL                     │
       │ ◄──────────────────────────────────────────────────────────────────┤
       │                              │                                     │
       │ 2. GET resource_metadata URL (PRM, RFC 9728)                       │
       ├─────────────────────────────────────────────────────────────────►  │
       │ {authorization_servers: [...], resource: "https://..."}            │
       │ ◄──────────────────────────────────────────────────────────────────┤
       │                              │                                     │
       │ 3. GET /.well-known/oauth-authorization-server                     │
       ├──────────────────────────────►                                     │
       │ {authorization_endpoint, token_endpoint, ...}                      │
       │ ◄─────────────────────────────                                     │
       │                              │                                     │
       │ 4. authorize (PKCE + resource= param, RFC 8707)                    │
       ├──────────────────────────────►                                     │
       │ redirect with code           │                                     │
       │ ◄─────────────────────────────                                     │
       │                              │                                     │
       │ 5. token exchange (code + verifier + resource= param)              │
       ├──────────────────────────────►                                     │
       │ {access_token (aud=server URI), refresh_token, expires_in}         │
       │ ◄─────────────────────────────                                     │
       │                              │                                     │
       │ 6. authenticated request — Authorization: Bearer <jwt>             │
       ├─────────────────────────────────────────────────────────────────►  │
       │                              │                                     │
       │                              │ verify signature, exp, aud, scopes  │
       │                              │                                     │
       │ 200                          │                                     │
       │ ◄──────────────────────────────────────────────────────────────────┤
```

Three things to notice:

- The **client never knew the issuer URL up front**. Step 1's 401 + step 2's PRM gave it. This is the discovery story.
- The **`resource=` parameter** went in twice (steps 4 and 5). The AS embeds the value in the token's `aud` claim. The RS rejects any token whose `aud` doesn't match its own canonical URI. This is RFC 8707 — the confused-deputy fix.
- The **AS and RS are different services**. They share a signing-key trust relationship (the RS knows the AS's JWKS URL); they do not share a database, a process, or a binary. In production the AS is Auth0/Okta/your-IdP; this week it's a 100-line local container.

---

## Step 1 — Build the local issuer (`tools/local-issuer/`)

The whole point of the local issuer is that you can run the entire flow offline and read every line. Real IdPs are a stretch goal for next week.

### Signing keys and the JWKS endpoint

```ts
// tools/local-issuer/src/keys.ts
import { generateKeyPair, exportJWK, JWK } from "jose";

export async function loadOrCreateKeys() {
  // In production this comes from a KMS. Locally, generate once and persist.
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const publicJwk = await exportJWK(publicKey);
  publicJwk.kid = "issuer-key-1";
  publicJwk.alg = "RS256";
  publicJwk.use = "sig";
  return { privateKey, publicJwk };
}
```

### The discovery endpoint (RFC 8414)

```ts
// tools/local-issuer/src/index.ts (excerpt)
app.get("/.well-known/oauth-authorization-server", (c) =>
  c.json({
    issuer: ISSUER_URL,
    authorization_endpoint: `${ISSUER_URL}/authorize`,
    token_endpoint: `${ISSUER_URL}/token`,
    revocation_endpoint: `${ISSUER_URL}/revoke`,
    introspection_endpoint: `${ISSUER_URL}/introspect`,
    jwks_uri: `${ISSUER_URL}/.well-known/jwks.json`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none", "client_secret_basic"],
    revocation_endpoint_auth_methods_supported: ["none"],
  })
);

app.get("/.well-known/jwks.json", (c) => c.json({ keys: [publicJwk] }));
```

### The authorization endpoint (PKCE)

```ts
app.get("/authorize", async (c) => {
  const { client_id, redirect_uri, code_challenge, code_challenge_method,
          state, scope, resource } = c.req.query();

  if (code_challenge_method !== "S256") return c.text("S256 required", 400);
  if (!resource) return c.text("resource parameter required (RFC 8707)", 400);

  const code = randomString(32);
  await codes.store(code, {
    client_id, redirect_uri, code_challenge,
    scope, resource,                         // <- carry resource through
    subject: c.req.query("login_as") ?? "user-a",   // local-issuer shortcut
    expires_at: Date.now() + 60_000,
  });
  return c.redirect(`${redirect_uri}?code=${code}&state=${state}`);
});
```

The `login_as` shortcut is a local-issuer affordance — a real AS would render a login page. This lets the harness drive the flow non-interactively while still exercising the protocol. Document this clearly: it's the only place the local issuer cheats.

### The token endpoint

```ts
app.post("/token", async (c) => {
  const form = await c.req.parseBody();
  const { grant_type, code, code_verifier, refresh_token, resource } = form;

  if (grant_type === "authorization_code") {
    const stored = await codes.consume(code as string);   // single-use
    if (!stored) return c.json({ error: "invalid_grant" }, 400);
    if (stored.expires_at < Date.now()) return c.json({ error: "invalid_grant" }, 400);

    const computed = base64url(sha256(code_verifier as string));
    if (computed !== stored.code_challenge) return c.json({ error: "invalid_grant" }, 400);

    if (resource && resource !== stored.resource) {
      return c.json({ error: "invalid_target" }, 400);    // RFC 8707
    }

    return c.json(await issueTokens({
      subject: stored.subject,
      audience: stored.resource,
      scope: stored.scope,
    }));
  }

  if (grant_type === "refresh_token") {
    return c.json(await rotateRefresh(refresh_token as string, resource as string));
  }

  return c.json({ error: "unsupported_grant_type" }, 400);
});
```

Notice three details:

- **Auth codes are single-use.** `codes.consume` deletes on read; replaying a code returns `invalid_grant`.
- **The PKCE check is `verifier → SHA-256 → base64url-equals-challenge`.** No shortcuts. RFC 7636.
- **The `resource` param threads through.** The token's `aud` claim will be set from `stored.resource`.

### Issuing tokens (the `aud` claim is the load-bearing line)

```ts
async function issueTokens({ subject, audience, scope }) {
  const access_token = await new SignJWT({ scope })
    .setProtectedHeader({ alg: "RS256", kid: "issuer-key-1" })
    .setIssuer(ISSUER_URL)
    .setSubject(subject)
    .setAudience(audience)                   // <- RFC 8707 binding lives here
    .setIssuedAt()
    .setExpirationTime("15m")
    .setJti(randomString(16))
    .sign(privateKey);

  const refresh_token = randomString(48);
  const family_id = randomString(16);
  await refreshTokens.store({
    token: refresh_token,
    family_id,                                // <- for reuse detection
    parent_id: null,
    subject,
    audience,
    scope,
    expires_at: Date.now() + 30 * 24 * 3600_000,
    used: false,
  });

  return {
    access_token,
    refresh_token,
    token_type: "Bearer",
    expires_in: 900,
  };
}
```

The `aud` claim is what makes Resource Indicators work. Without it, the rest of this week is pageantry.

### Refresh-token rotation with reuse detection

```ts
async function rotateRefresh(presented: string, requested_audience: string) {
  const stored = await refreshTokens.byToken(presented);
  if (!stored) throw new InvalidGrant();

  if (stored.used) {
    // Reuse detected — the family is compromised. Revoke everything in it.
    await refreshTokens.revokeFamily(stored.family_id);
    throw new InvalidGrant("refresh_token_reuse_detected");
  }

  // Audience must match the original — RFC 8707 §2 forbids broadening.
  if (requested_audience && requested_audience !== stored.audience) {
    throw new InvalidGrant("invalid_target");
  }

  await refreshTokens.markUsed(stored.token);

  // Issue a new pair, child of the same family.
  return issueTokens({
    subject: stored.subject,
    audience: stored.audience,
    scope: stored.scope,
    family_id: stored.family_id,
  });
}
```

The refresh-token table needs five columns: `token`, `family_id`, `parent_id`, the standard `subject`/`audience`/`scope`/`expires_at`, and a `used` flag. The reuse-detection rule is brutal: any presentation of an already-used token revokes the entire family. Documented in OAuth 2.1 §6.1; non-negotiable.

### Revocation (RFC 7009) and introspection (RFC 7662)

```ts
app.post("/revoke", async (c) => {
  const { token, token_type_hint } = await c.req.parseBody();
  if (token_type_hint === "refresh_token" || (await refreshTokens.byToken(token as string))) {
    const stored = await refreshTokens.byToken(token as string);
    if (stored) await refreshTokens.revokeFamily(stored.family_id);
  } else {
    await revokedJtis.add(jtiFromJwt(token as string), exp(token as string));
  }
  return c.body(null, 200);                // RFC 7009 returns 200 on unknown tokens too
});

app.post("/introspect", async (c) => {
  const { token } = await c.req.parseBody();
  // For JWTs the RS validates offline; introspection is mostly for opaque tokens
  // and for the RS's revocation cache to refresh on demand.
  const claims = await safeVerify(token as string);
  if (!claims) return c.json({ active: false });
  if (await revokedJtis.has(claims.jti)) return c.json({ active: false });
  return c.json({ active: true, ...claims });
});
```

JWTs validate offline at the RS — that's the performance argument for using them. Introspection exists so the RS can poll the AS to invalidate its revocation cache, and so opaque-token consumers (which we're not building) work.

---

## Step 2 — The MCP server as a Resource Server

Now wire the server side. Three pieces: PRM endpoint, JWT validation middleware, and `WWW-Authenticate` on 401.

### Protected Resource Metadata (RFC 9728)

```ts
// server/src/auth/prm.ts
const RESOURCE_URI = process.env.MCP_RESOURCE_URI ?? "http://127.0.0.1:8080/mcp";

export const prm = {
  resource: RESOURCE_URI,
  authorization_servers: [process.env.AUTH_ISSUER_URL ?? "http://127.0.0.1:9000"],
  bearer_methods_supported: ["header"],
  scopes_supported: ["mcp:read", "mcp:write", "mcp:admin"],
  resource_documentation: "https://your-server-docs/",
};

// In your hono app:
app.get("/.well-known/oauth-protected-resource", (c) => c.json(prm));
```

Five-line endpoint. Discoverable via the `resource_metadata` parameter on `WWW-Authenticate`.

### JWT validation middleware

```ts
// server/src/auth/verify.ts
import { jwtVerify, createRemoteJWKSet } from "jose";

const JWKS = createRemoteJWKSet(new URL(`${process.env.AUTH_ISSUER_URL}/.well-known/jwks.json`));
const REVOKED = new RevocationCache();    // populated on 401-cause investigations

export async function authenticate(c: Context, next: Next) {
  const auth = c.req.header("Authorization");
  if (!auth?.startsWith("Bearer ")) return unauthenticated(c);

  const token = auth.slice("Bearer ".length);

  // API-key fallback: tokens prefixed `mcp_sk_` are HMAC-validated against the
  // service-principal table. Falls through to JWT path if not matched.
  if (token.startsWith("mcp_sk_")) {
    const principal = await validateApiKey(token);
    if (!principal) return unauthenticated(c);
    c.set("principal", principal);
    return next();
  }

  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: process.env.AUTH_ISSUER_URL,
      audience: RESOURCE_URI,                // <- RFC 8707 enforcement, server side
      algorithms: ["RS256"],
      clockTolerance: "5s",
    });

    if (await REVOKED.has(payload.jti)) return unauthenticated(c, "token_revoked");

    c.set("principal", {
      kind: "user",
      subject: payload.sub,
      tenant: payload.tenant ?? "default",   // populated in W7
      scopes: (payload.scope as string ?? "").split(" "),
      jti: payload.jti,
      exp: payload.exp,
    });
    return next();
  } catch (err) {
    return unauthenticated(c, classifyJwtError(err));
  }
}

function unauthenticated(c: Context, cause = "missing_or_invalid_token") {
  c.header("WWW-Authenticate",
    `Bearer realm="mcp", resource_metadata="${RESOURCE_URI.replace("/mcp", "")}/.well-known/oauth-protected-resource", error="invalid_token", error_description="${cause}"`);
  return c.json({ error: cause }, 401);
}
```

Line by line:

- **`createRemoteJWKSet`** caches the JWKS with a TTL and re-fetches on `kid` miss. Don't fetch JWKS per request; don't cache it forever. The library's defaults are right.
- **`audience: RESOURCE_URI`** is the RFC 8707 enforcement on the RS side. The AS *issues* with the right `aud`; the RS *rejects* if `aud` doesn't match. Both halves are required.
- **`algorithms: ["RS256"]`** prevents the classic `alg: none` and `alg: HS256-with-public-key` confusion attacks. RFC 8725 §3.1.
- **`clockTolerance: "5s"`** is a sensible compromise. Don't go higher; don't go lower.
- **`WWW-Authenticate`** is what makes discovery work — the client follows the `resource_metadata` URL to find your AS.

### Scope enforcement on tools

```ts
// server/src/auth/scopes.ts
export const TOOL_SCOPES: Record<string, string[]> = {
  search_issues:      ["mcp:read"],
  read_issue:         ["mcp:read"],
  list_pull_requests: ["mcp:read"],
  create_issue:       ["mcp:write"],
  comment_on_issue:   ["mcp:write"],
  close_issue:        ["mcp:write"],
};

export function requireScope(toolName: string, principal: Principal): ToolError | null {
  const required = TOOL_SCOPES[toolName] ?? [];
  const missing = required.filter((s) => !principal.scopes.includes(s));
  if (missing.length === 0) return null;
  return toolError(ToolErrorCode.Forbidden, "Insufficient scope", {
    cause: "missing_scope",
    required,
    missing,
  });
}
```

Wire `requireScope` into the tool dispatcher. Two scopes (`mcp:read`, `mcp:write`) is a defensible starting point; `mcp:admin` is for tools introduced in W7. Avoid the urge to go fine-grained (`issues:write`, `comments:write`) before you have a real reason — narrow scope vocabularies are easier to audit.

### API-key fallback

```ts
// server/src/auth/api-keys.ts
import { createHash, timingSafeEqual } from "node:crypto";

export async function validateApiKey(presented: string): Promise<Principal | null> {
  // Format: mcp_sk_<id>_<secret>. The id lets us look up before a constant-time compare.
  const m = presented.match(/^mcp_sk_([A-Za-z0-9]+)_([A-Za-z0-9]+)$/);
  if (!m) return null;
  const [, id, secret] = m;

  const row = await db.apiKeys.byId(id);
  if (!row || row.revoked_at) return null;

  const presentedHash = createHash("sha256").update(secret).digest();
  const storedHash = Buffer.from(row.secret_hash, "hex");
  if (presentedHash.length !== storedHash.length) return null;
  if (!timingSafeEqual(presentedHash, storedHash)) return null;

  return {
    kind: "service",
    subject: `service:${row.service_principal}`,
    tenant: row.tenant,
    scopes: row.scopes,
    jti: `apikey:${id}`,
    exp: row.expires_at ? row.expires_at / 1000 : Number.MAX_SAFE_INTEGER,
  };
}
```

Three things:

- **The key format embeds an ID.** Without one, validation is O(n) over all keys (timing-attack-safe but slow); with one, it's O(1) plus a constant-time compare.
- **Storage is a SHA-256 of the secret half**, not the secret itself. If the keys table leaks, attackers can't replay the keys. (You can also use a slow KDF here — argon2 — but for keys with high entropy, SHA-256 + a long secret is fine. ADR candidate.)
- **`timingSafeEqual`** is mandatory. Don't use `===`. Don't shortcut the length check; do it after coercing to Buffer so it's still constant-time.

API keys share the rest of the pipeline: same scope check, same audit line, same tenant resolution. The only divergence is validation.

---

## Step 3 — The harness as an OAuth client (preview)

The full PKCE + token-exchange + refresh flow lands in W7 alongside multi-tenancy. This week the harness uses a **static token** minted directly from the local issuer for testing — `npm run mint-token --tenant=default --scope='mcp:read mcp:write'` — and the validation path is exercised end-to-end. The W7 work then teaches the harness to acquire its own token through the protocol.

This split is intentional: **server-side validation is the security-critical half**. Get it right under static-token conditions, then teach the client.

---

## Step 4 — Audit logging (W6 baseline)

Every authenticated request gets one structured audit line. Schema:

```ts
{
  ts: "2026-04-26T14:23:01.234Z",
  event: "tool_call",
  subject: "user-a",                          // sub claim, or service:foo for API keys
  tenant: "default",                          // populated in W7
  tool: "search_issues",
  args_hash: "sha256:abc123...",              // from W2 instrumentation
  jti: "...",                                 // token identifier; lets you trace back to a session
  outcome: "ok",                              // ok | error | denied
  duration_ms: 187,
}
```

The line is written at the end of `instrument()` — same wrapper as W2, now with the `principal` from the request context. The 2025 line schema:

```ts
log.audit({
  ts: new Date().toISOString(),
  event: "tool_call",
  subject: principal.subject,
  tenant: principal.tenant,
  tool: toolName,
  args_hash: argsHash,
  jti: principal.jti,
  outcome,
  duration_ms,
});
```

Plain JSONL this week, written to `var/audit.log`. **It is not yet tamper-evident** — a privileged process can modify the file freely. W7 introduces the hash-chain construction that makes after-the-fact tampering detectable. Resist the urge to call this audit log "tamper-evident" until W7 has shipped.

The reason for splitting it across two weeks: audit-log schema design and audit-log tamper-evidence are separable concerns. Getting the schema right under W6's auth introduction is cleaner than coupling it to the cryptographic construction.

---

## Artefact evolution

### Evolution: server

- **Before (end of W5):** anonymous calls accepted; sessions tied to a server-issued ID; no concept of a principal.
- **Change:** require a valid bearer token (JWT or API key) on every tool call except `/.well-known/*` and a narrow `/health` endpoint; enforce per-tool scopes; bind tokens to this server's URI via the `aud` claim (RFC 8707); publish PRM at `/.well-known/oauth-protected-resource`; emit `WWW-Authenticate` with `resource_metadata` on 401.
- **After:** unauthenticated calls return 401 with discovery metadata; tokens issued for a different audience are rejected; insufficient-scope calls return `forbidden` with `details.missing_scope`; every successful call writes an audit line.
- **Verify:** harness without token receives 401 + `WWW-Authenticate` containing the PRM URL; harness with a token where `aud` is wrong receives 401; harness with a `mcp:read`-only token calling `create_issue` receives `forbidden`; harness with full scope passes the entire phase-1 eval set; `tools/local-issuer` mints all tokens.
- **Enables:** W7 multi-tenancy reads the `tenant` claim; W8 deployment plugs Auth0/Okta in as the AS by changing one env var; W10 cost attribution groups by `subject` and `tenant`.

### Evolution: harness

- **Before:** anonymous calls; no `Authorization` header.
- **Change:** support `MCP_TOKEN` env var; mint a token via the local issuer's `/mint-token` admin endpoint at session start; attach `Authorization: Bearer …` to every request.
- **After:** harness can run authenticated end-to-end against the local issuer; the W3 eval set passes under auth.
- **Verify:** `MCP_TOKEN=$(npm --prefix tools/local-issuer run mint-token -- --scope='mcp:read mcp:write') harness "..."` runs to completion; trace shows the token's `sub` and `jti`; phase-1 evals pass within 1 case of the unauthenticated baseline.
- **Enables:** W7 replaces the static token with a real PKCE flow.

### Evolution: docker-compose

- **Before (end of W5):** server + Postgres + migrate one-shot.
- **Change:** add `local-issuer` service (own Postgres schema for codes, refresh tokens, revocations); add a generated dev-only signing key as a docker secret; server's `AUTH_ISSUER_URL` points at the local-issuer service.
- **After:** four services in compose; `docker compose up` brings up a complete authenticated stack with no external dependencies.
- **Verify:** `curl http://localhost:9000/.well-known/oauth-authorization-server` returns valid metadata; JWKS endpoint serves a key the server can verify against.

### Evolution: error taxonomy

- **Before:** 6 codes from W2-5.
- **Change:** **no new codes.** Auth failures map to existing codes:
  - Missing/invalid token → 401 at the transport (does not reach the tool layer)
  - Insufficient scope → `Forbidden` with `details.cause: "missing_scope"`
  - Audience mismatch → 401 at the transport with `error="invalid_token"` in `WWW-Authenticate`
  - API-key revoked → 401 at the transport with `error="invalid_token"` and `details.cause: "key_revoked"`
- **After:** still 6 codes. The `cause` field carries the auth-class detail. Document the decision in an ADR.

### Evolution: eval set

- **Change:** rerun the entire phase-1 set under auth (with a valid full-scope token); add four auth-specific cases:
  - `auth.missing_token` — assert 401 + `WWW-Authenticate` with `resource_metadata`.
  - `auth.expired_token` — assert 401 + `error="invalid_token"`.
  - `auth.wrong_audience` — assert 401 + the audience mismatch is logged.
  - `auth.insufficient_scope` — assert `forbidden` with `details.cause: "missing_scope"` and the `missing` array names the right scope.
- **After:** the auth-specific cases run alongside phase-1 every run.

### Evolution: consumer README

- **Change:** add an "Authentication" section with the PRM URL, the discovery flow in three steps, the supported scopes, and an API-key issuance procedure.
- **After:** a third-party client author can wire up auth without reading your source.

### Evolution: THREATS.md

- **Change:** add **token replay across servers** (defended by RFC 8707 audience binding), **JWT algorithm confusion** (defended by explicit `algorithms: ["RS256"]`), **stolen refresh token** (defended by reuse detection + family revocation), **API-key leakage** (defended by stored-as-hash + revocation endpoint).
- **After:** the file's auth-class section is its own subsection; W7 adds tenant-isolation threats; W12 closes the threat model.

---

## Common pitfalls

:::danger[The seven ways Week 6 goes wrong]
- **No audience check on the RS.** The single most common MCP auth bug. If `audience: RESOURCE_URI` isn't in your `jwtVerify` call, you have no Resource Indicators enforcement no matter what the AS issues.
- **Trusting the `alg` header.** `jose` defaults are safe; `jsonwebtoken`'s aren't. Always pass `algorithms: ["RS256"]` explicitly. Never `["none"]`. Never `["HS256", "RS256"]` together — the library may use the public key as an HMAC secret.
- **Issuing tokens without `aud`.** A token without an audience claim is a token any RS will accept. Set it on every issue path; reject any token without it on the RS.
- **Per-request JWKS fetch.** Caches exist for a reason. Use `createRemoteJWKSet` and let it manage the cache.
- **Storing API keys plaintext.** Hash on insert, compare hashes constant-time on verify. Same instinct as passwords.
- **Calling the audit log "tamper-evident" before it is.** The W6 audit log is plain JSONL. A root user can edit it. W7 adds the hash chain that makes tampering detectable. Don't claim a property you haven't built.
- **Forgetting `WWW-Authenticate` on 401.** Without it, no client can discover your AS. The five extra characters per response are non-negotiable.
:::

## Checkpoint — you've completed Week 6 when

- [ ] Local issuer is running in compose; `/.well-known/oauth-authorization-server` returns valid metadata; JWKS endpoint serves a key
- [ ] PKCE flow works end to end via curl: authorize → token (with `code_verifier`) → use token
- [ ] `resource=` parameter required on authorize and token endpoints; the issued token has `aud` set from it
- [ ] Server's PRM endpoint at `/.well-known/oauth-protected-resource` returns valid metadata
- [ ] Server validates JWTs with `algorithms: ["RS256"]` and `audience: RESOURCE_URI` explicit
- [ ] Server returns `WWW-Authenticate: Bearer ... resource_metadata="..."` on every 401
- [ ] Tokens with the wrong `aud` are rejected; verified by curl with a token minted for a different resource
- [ ] Refresh-token rotation works; reuse of an already-used refresh token revokes the entire family (verified by integration test)
- [ ] Revocation endpoint accepts a token and the next request with that token returns 401
- [ ] API-key fallback works: a key minted via the issuer admin path validates and produces a service-principal `principal`
- [ ] Per-tool scopes enforced; phase-1 evals pass with a full-scope token, fail with insufficient scope
- [ ] One audit line per authenticated tool call; lines include `subject`, `tool`, `args_hash`, `outcome`, `duration_ms`, `jti`
- [ ] `THREATS.md` extended with the four new auth-class sections
- [ ] ADR written for the error-taxonomy-or-new-codes decision (recommended: keep at 6 codes)
- [ ] `git tag week-6-complete`

## Leadership lens

Auth is the single largest gap between "demo works" and "I would run this in production." Most MCP servers ship with a configured-issuer-URL pattern, no audience binding, and a hand-coded JWT validation that trusts the `alg` header. Each of these is a five-line fix. None of them ship by default.

The interview question worth asking: "If a malicious MCP server stood up tomorrow with the same scopes as yours, and a user authenticated to it, what could that server do with the token they get back?" The right answer is "nothing — our tokens are bound to our resource URI by the `aud` claim, and our RS rejects any token whose `aud` doesn't match." Anything less and the candidate hasn't met confused-deputy in the wild yet.

The other question worth asking: "What does your server do when its signing key is compromised?" The answer should be "rotate the key in the AS and the RS picks up the new JWKS automatically; tokens minted under the old key fail validation immediately." If the answer involves redeploying the MCP server, the AS/RS separation isn't real.

## Optional rabbit holes

- **Real IdP.** Stand up Auth0 or Google as the AS; point the RS's `AUTH_ISSUER_URL` at it. Verify nothing in the server changes. This is the test that the AS/RS separation is genuine, not nominal.
- **Token binding (RFC 8473).** Optional but interesting; pins tokens to the TLS connection that issued them. Not in the MCP spec; worth understanding if you're heading toward FAPI-class deployments.
- **mTLS-bound access tokens (RFC 8705).** Same idea, different mechanism. Use cases: very-high-trust service-to-service calls.
- **DPoP (RFC 9449).** Sender-constrained access tokens for public clients. Worth knowing about; not needed for this pathway.
- **PAR (RFC 9126) — Pushed Authorization Requests.** Stops authorization-request tampering. Mainstream IdPs are starting to require it. Worth a half-day's reading.

## ADR candidates

- **Error taxonomy under auth** — keep at 6 codes with `cause`, or add `auth_required`/`auth_invalid`/`token_revoked`. Recommended: keep at 6.
- **Scope granularity** — coarse (`mcp:read`, `mcp:write`) vs. tool-specific (`issues:write`, `comments:write`). Recommended: coarse until eval evidence shows the model is mis-routing.
- **JWKS cache TTL** — `jose` default vs. explicit. Recommended: explicit, 10 minutes, with `kid`-miss refresh.
- **API-key storage hash** — SHA-256 vs. argon2id. Recommended: SHA-256 if your keys have ≥128 bits of entropy at issue time; argon2id if you're worried about lower-entropy keys (you shouldn't be).
- **API-key format** — opaque `mcp_sk_<id>_<secret>` vs. JWT-shaped service tokens. Recommended: opaque; service principals don't need the JWT machinery.
- **Refresh-token storage** — Postgres row per token vs. encrypted-at-rest token blob. Recommended: row per token; the reuse-detection logic needs the lineage anyway.
- **Audit-log destination this week** — file vs. table. Recommended: file. W7's hash chain works on either; W9's OTel pipeline ships the file. A table fights the W7 design.
