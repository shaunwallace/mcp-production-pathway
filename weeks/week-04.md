---
title: Week 4 — Streamable HTTP transport (Phase 2, part 1)
---

# Week 4 — Streamable HTTP transport (Phase 2, part 1)

**Time budget:** 8 to 12 hours across three sittings.

:::tip[Where the real work is]
The wire protocol is straightforward — `hono` does most of it. The work is at the **edges**: which origins you accept, how big a body you'll read, what happens when a write retries, what happens when a stream drops mid-response. Stdio hides all of these. HTTP forces you to confront them.
:::

## What you'll have by the end of the week

- The same MCP server binary serving both stdio and Streamable HTTP, selectable by flag
- A hardened HTTP edge: Origin allowlist, Host validation, localhost binding by default, body-size limits, structured timeout
- Session lifecycle (`Mcp-Session-Id`) wired through your existing `instrument()` log lines so every tool call is correlated to a session
- Resumable SSE streams with `Last-Event-ID` replay against an in-memory event log
- Idempotency keys on every write tool, backed by a SQLite store with TTL eviction
- An `--transport http|stdio` flag on the harness, with the Week 3 eval set passing on both
- A short `THREATS.md` in your workbook documenting the three attacks this week's defences exist for

## Why this week exists

Stdio is trusted-local: one parent process spawns one server, no network, no concurrency. The minute you put the server on a port — even `127.0.0.1` — you inherit the entire web's threat model. The protocol layer doesn't change much. The thing that changes is that **anything on the host can now talk to your server**, including a webpage the user happened to open in another tab.

Most MCP servers in the wild get this wrong. They bind to `0.0.0.0`, accept any Origin, have no body limit, and ship without idempotency. You'll meet several of them in Phase 4 when you go shopping for prior art. This week is the antidote.

## Reading list

1. **MCP spec, Streamable HTTP transport section.** (~30min) Authoritative. Read the session ID, resumability, and security sections twice.
   → <https://modelcontextprotocol.io/specification/2025-06-18/basic/transports>
2. **OWASP, "DNS rebinding."** (~15min) The canonical attack against any localhost server.
   → <https://owasp.org/www-community/attacks/Server_Side_Request_Forgery>
3. **Stripe engineering, "Designing robust and predictable APIs with idempotency."** (~20min) The reference document. Your implementation will be a small subset of theirs.
   → <https://stripe.com/blog/idempotency>
4. **hono docs — routing, middleware, streaming.** (~25min) You'll touch all three.
   → <https://hono.dev>
5. **Tavis Ormandy, "DNS rebinding attacks against Plex."** (~10min) A real exploit against a real localhost service. Worth reading to internalise that this is not theoretical.
   → search: "Plex DNS rebinding Ormandy" — pick a current write-up

## The tooling stack for this week

- **hono** as the HTTP framework. Runs unchanged on Node, Bun, Cloudflare Workers, and Deno — keeps deployment optionality alive for Phase 4. Alternatives: [express](https://expressjs.com) (heavier middleware, older patterns), [fastify](https://fastify.dev) (richer plugin system than this pathway needs).
- **better-sqlite3** for the idempotency-key store and the SSE event log. Synchronous, file-backed, single-binary. Postgres takes over in W5; for now SQLite keeps the moving parts down.
- **`undici`** (already in Node) for the HTTP-side harness client. No third-party HTTP client needed.

Install:

```bash
cd server
npm install hono @hono/node-server better-sqlite3
npm install -D @types/better-sqlite3
```

## Setup checklist

- [ ] Week 3 complete; eval set passes on stdio
- [ ] `lsof -i :8080` returns nothing — pick another port if it's busy
- [ ] `curl --version` available for the manual transport tests
- [ ] A spare browser profile or incognito window for the Origin tests (you'll point a tab at a local HTML file)

---

## How Streamable HTTP works

A single endpoint — typically `/mcp` — handles three HTTP methods:

| Method | Purpose | Response shape |
|---|---|---|
| `POST /mcp` | Client sends a JSON-RPC request or notification | Either `application/json` (immediate) or `text/event-stream` (streamed) |
| `GET /mcp` | Client opens a server-initiated event stream | `text/event-stream` always |
| `DELETE /mcp` | Client terminates the session | `204 No Content` |

The session header `Mcp-Session-Id` is issued by the server in the response to `initialize`. The client echoes it on every subsequent request. The server can also operate **stateless** — no session ID, every request stands alone — but you lose resumability and server-initiated messages, so default to stateful.

The first POST `initialize` request never carries a session ID; the server's response sets it. The client persists it for the lifetime of the connection.

### A worked request flow

```
→ POST /mcp                        Content-Type: application/json
  body: {"jsonrpc":"2.0","id":1,"method":"initialize",...}

← 200 OK                           Content-Type: application/json
  Mcp-Session-Id: 7c3f...
  body: {"jsonrpc":"2.0","id":1,"result":{...}}

→ POST /mcp                        Mcp-Session-Id: 7c3f...
  body: {"jsonrpc":"2.0","id":2,"method":"tools/call",...}

← 200 OK                           Content-Type: text/event-stream
  id: 0
  data: {"jsonrpc":"2.0","method":"notifications/progress",...}

  id: 1
  data: {"jsonrpc":"2.0","id":2,"result":{...}}

→ DELETE /mcp                      Mcp-Session-Id: 7c3f...
← 204 No Content
```

The `id:` lines on the SSE events are sequence numbers. If the client's connection drops, it reconnects with `Last-Event-ID: 0` and the server replays everything after event 0. That's the resumability story in one paragraph.

### The `hono` skeleton (`server/src/transport/http.ts`)

```ts
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHttpTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { registerTools } from "../tools/index.js";
import { originGuard } from "./origin-guard.js";
import { idempotency } from "./idempotency.js";
import { eventLog } from "./event-log.js";

export function buildHttpApp(mcp: Server) {
  const app = new Hono();

  app.use("*", originGuard({ allow: ["null", "https://claude.ai"] }));
  app.use("/mcp", async (c, next) => {
    c.req.raw.headers.get("content-length");  // hono enforces bodyLimit below
    await next();
  });

  const transport = new StreamableHttpTransport({
    sessionIdGenerator: () => crypto.randomUUID(),
    eventStore: eventLog,                                     // for Last-Event-ID replay
    enableJsonResponse: true,
  });
  await mcp.connect(transport);

  app.post("/mcp", idempotency(), (c) => transport.handleRequest(c.req.raw));
  app.get("/mcp", (c) => transport.handleRequest(c.req.raw));
  app.delete("/mcp", (c) => transport.handleRequest(c.req.raw));

  return app;
}

// server/src/index.ts — selects transport
const args = process.argv.slice(2);
const useHttp = args.includes("--http");
if (useHttp) {
  serve({ fetch: buildHttpApp(mcp).fetch, port: 8080, hostname: "127.0.0.1" });
} else {
  await mcp.connect(new StdioServerTransport());
}
```

Two things worth pausing on:

- **`hostname: "127.0.0.1"` is not optional.** Defaulting to `0.0.0.0` is the most common production-MCP mistake; it exposes your server to anything on the local network (including hotel WiFi). If you genuinely need network access later, gate it behind an ADR.
- **The same `mcp: Server` instance is reused.** Tools registered for stdio work over HTTP without modification. The transport is a swap, not a rewrite.

---

## Hardening the edge

Three defences that have to land together. Skip any one and the other two are mostly decoration.

### 1. Origin allowlist + Host validation (DNS rebinding defence)

The attack: a user opens `evil.com` in a browser tab while your MCP server is running locally. The page issues `fetch("http://localhost:8080/mcp", { method: "POST", body: ... })`. The browser sends the request because localhost is fair game. Your server processes it. Game over — the attacker just called `close_issue` on every issue in the user's GitHub.

The defence is layered:

```ts
// server/src/transport/origin-guard.ts
import { MiddlewareHandler } from "hono";

const ALLOWED_HOSTS = new Set(["127.0.0.1:8080", "localhost:8080"]);

export function originGuard(opts: { allow: string[] }): MiddlewareHandler {
  const allowed = new Set(opts.allow);
  return async (c, next) => {
    const origin = c.req.header("Origin") ?? "null";
    const host = c.req.header("Host") ?? "";

    if (!ALLOWED_HOSTS.has(host)) {
      return c.json({ error: "host_not_allowed", host }, 403);
    }
    if (!allowed.has(origin)) {
      return c.json({ error: "origin_not_allowed", origin }, 403);
    }
    await next();
  };
}
```

What each line buys you:

- **`Host` allowlist** stops DNS rebinding. The attack works by registering a domain with two A records — the attacker's IP, then `127.0.0.1` after a short TTL. The browser caches the first; the page fetches the second; from the browser's perspective they're "same-origin." The defence: even if the attacker's domain resolves to `127.0.0.1`, the browser sends `Host: evil.com` (because that's what the URL said). Your server rejects on Host mismatch.
- **`Origin` allowlist** stops cross-origin fetches from arbitrary tabs. CLI clients send `Origin: null`; that's why `null` is in the allowlist. Add the specific origins for any browser-based MCP client you intend to support — never use `*`.
- **`hostname: "127.0.0.1"`** at bind time means even if both checks fail open, an attacker on the local network can't reach the port at all.

Three layers because one is never enough. If you only validate `Origin`, an HTTP/1.1 client that doesn't send the header bypasses you. If you only validate `Host`, a same-origin attack still works. If you only bind to localhost, a malicious tab in the user's browser still reaches you.

### 2. Body-size limits

The model can be coaxed into passing huge strings as tool arguments. A 50 MB query string crashes nothing — your server happily allocates the buffer, zod validates it, the backend receives it — but it does mean a single curl call from any process on your machine can pin a CPU and OOM a 1 GB container.

```ts
import { bodyLimit } from "hono/body-limit";

app.use("/mcp", bodyLimit({
  maxSize: 1 * 1024 * 1024,       // 1 MB; tune per tool surface
  onError: (c) => c.json({ error: "body_too_large" }, 413),
}));
```

1 MB is a sensible default for tool calls. If you have a tool that legitimately needs bigger payloads — uploading a file blob — handle it with a streamed upload to a separate endpoint and pass a reference. Tool args are not the place for blobs.

This is **defence in depth**: the transport rejects oversized bodies before they reach zod, so a malicious payload that'd choke the JSON parser never gets parsed.

### 3. Timeouts that surface as tool errors

Without a timeout, a slow backend pins a request indefinitely. The model waits, your client waits, your idempotency entry stays unresolved.

```ts
// server/src/transport/timeout.ts
export function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new TimeoutError(label, ms)), ms);
    p.then((v) => { clearTimeout(t); resolve(v); },
           (e) => { clearTimeout(t); reject(e); });
  });
}
```

Wrap every backend call inside a tool handler. When a timeout fires, return a structured error using your Week 2 taxonomy:

```ts
try {
  const data = await withTimeout(client.searchIssues(args), 10_000, "github.search_issues");
  return { /* structured result */ };
} catch (err) {
  if (err instanceof TimeoutError) {
    return toolError(ToolErrorCode.BackendFailure, "Backend timed out", { ms: err.ms, label: err.label });
  }
  throw err;
}
```

Timeouts compound — model timeout (60s) > tool timeout (10s) > backend timeout (8s). Document this stack in your workbook. In Week 8 you'll formalise it as **deadline propagation**, but get the per-tool budget right this week.

---

## Idempotency keys

Once requests cross a network, retries become real. The model retries on a transport failure. The HTTP client retries on a 502. A user double-clicks a tool-confirm button. Each retry, against a write tool, creates a duplicate.

The contract:

- Client sends header `Idempotency-Key: <opaque-string>` on every write request.
- Server stores `(key, request_hash, response, expires_at)`.
- On replay with **same key + same request hash** → return cached response (without calling the backend).
- On replay with **same key + different request hash** → return 422; the client is misusing the key.
- On a key the server has never seen → execute normally, store the result, return.
- TTL: 24 hours. After that the entry is evicted and a fresh request with the same key is treated as new.

### The store (`server/src/transport/idempotency-store.ts`)

```ts
import Database from "better-sqlite3";
import { createHash } from "node:crypto";

const db = new Database("var/idempotency.db");
db.exec(`
  CREATE TABLE IF NOT EXISTS idempotency (
    key         TEXT PRIMARY KEY,
    req_hash    TEXT NOT NULL,
    response    TEXT NOT NULL,
    status      INTEGER NOT NULL,
    expires_at  INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_expires ON idempotency(expires_at);
`);

export function hashRequest(method: string, body: string) {
  return createHash("sha256").update(method).update("\n").update(body).digest("hex");
}

export function lookup(key: string) {
  const row = db.prepare(
    "SELECT req_hash, response, status FROM idempotency WHERE key = ? AND expires_at > ?"
  ).get(key, Date.now()) as { req_hash: string; response: string; status: number } | undefined;
  return row;
}

export function store(key: string, reqHash: string, status: number, response: string, ttlMs = 24 * 3600_000) {
  db.prepare(
    "INSERT OR REPLACE INTO idempotency (key, req_hash, response, status, expires_at) VALUES (?, ?, ?, ?, ?)"
  ).run(key, reqHash, status, response, Date.now() + ttlMs);
}

// Run periodically — or on a cron — to evict expired rows.
export function evict() {
  db.prepare("DELETE FROM idempotency WHERE expires_at <= ?").run(Date.now());
}
```

### The middleware

```ts
export function idempotency(): MiddlewareHandler {
  return async (c, next) => {
    const key = c.req.header("Idempotency-Key");
    if (!key) { await next(); return; }              // optional header; only enforce if sent

    const body = await c.req.text();
    const reqHash = hashRequest(c.req.method, body);
    const existing = lookup(key);

    if (existing) {
      if (existing.req_hash !== reqHash) {
        return c.json({ error: "idempotency_key_reuse" }, 422);
      }
      return new Response(existing.response, { status: existing.status });
    }

    // Re-attach body so downstream handlers can read it.
    c.req.raw = new Request(c.req.raw, { body });

    await next();

    const resBody = await c.res.clone().text();
    store(key, reqHash, c.res.status, resBody);
  };
}
```

Three things worth understanding:

- **Scope is per-server, not per-tool.** A key collision across tools is a client bug; reject it loudly (the 422 path).
- **The hash is over the method + body, not just the body.** Otherwise a `tools/call` for tool A and a `tools/call` for tool B could collide if their JSON bodies happened to match.
- **The response is cached verbatim, including status code.** A 500 response to a key gets replayed as a 500. The client is responsible for not sending a 500-replay key forever.

If your write tool is itself idempotent at the backend (a `PUT` with a deterministic ID), you can skip the middleware for that tool. Most aren't.

---

## Sessions and resumability

`Mcp-Session-Id` is the thread that ties tool calls together. The SDK's `StreamableHttpTransport` issues and validates the header for you. Your job is to **propagate the session ID into the log line** so you can later answer "what tool calls happened in session X."

Update the `instrument()` wrapper from Week 2:

```ts
import { AsyncLocalStorage } from "node:async_hooks";

export const sessionContext = new AsyncLocalStorage<{ sessionId: string }>();

export function instrument(toolName: string, fn: Handler): Handler {
  return async (args) => {
    const sessionId = sessionContext.getStore()?.sessionId ?? "stdio";
    // ... rest unchanged, log line includes sessionId
  };
}
```

Wrap the HTTP entry point so the session ID is in scope for the duration of the request:

```ts
app.post("/mcp", idempotency(), (c) => {
  const sessionId = c.req.header("Mcp-Session-Id") ?? "pre-init";
  return sessionContext.run({ sessionId }, () => transport.handleRequest(c.req.raw));
});
```

Stdio sessions get the literal string `"stdio"` — there's no real session, but you want the field present in every log line so downstream queries can group by it without null-handling.

### Resumability

The `eventStore` you passed to `StreamableHttpTransport` is what makes `Last-Event-ID` work. A minimal in-memory implementation:

```ts
// server/src/transport/event-log.ts
import { EventStore } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

const store = new Map<string, Array<{ id: string; data: unknown }>>();

export const eventLog: EventStore = {
  async storeEvent(sessionId, event) {
    const list = store.get(sessionId) ?? [];
    list.push(event);
    if (list.length > 1000) list.shift();    // bounded; tune per memory budget
    store.set(sessionId, list);
  },
  async replayAfter(sessionId, lastEventId) {
    const list = store.get(sessionId) ?? [];
    const i = list.findIndex((e) => e.id === lastEventId);
    return i === -1 ? list : list.slice(i + 1);
  },
};
```

Bounded at 1000 events per session. A multi-day session can blow that — at which point you'll move the store to SQLite and add an eviction policy. Note this as a known limitation in `server/README.md`; it's a Phase 4 concern, not a Week 4 one.

---

## SSE legacy fallback (the deprecation question)

Pre-2025-03-26 spec used two endpoints: `POST /messages` for client→server, `GET /sse` for server→client. Streamable HTTP unified them onto `/mcp`. Some clients in the wild still only speak the legacy. Three positions you can take:

| Position | What you ship | When to pick |
|---|---|---|
| **Streamable HTTP only** | Single `/mcp` endpoint; reject legacy clients with 426 Upgrade Required | You control all your clients (e.g., your own harness + Claude Desktop current) |
| **Both, with deprecation timeline** | Mount legacy SSE at `/sse` + `/messages`; emit a `Deprecation:` header; remove in N months | You're shipping a public server and have unknown clients in the field |
| **Legacy only** | Don't | Never. The unified transport is strictly better; the only reason to ship legacy is "every client I know speaks it and I haven't read the new spec" |

Document the position in an ADR. The default for this pathway is **Streamable HTTP only** — your own harness will speak it, and the Inspector can be pointed at it.

---

## Three attacks to write up in `THREATS.md`

A short workbook artefact this week. Three subsections, ~50 words each, written in the form *"What goes wrong if X is missing"*:

1. **No Origin/Host check.** Attacker page in another browser tab issues a write call. Defence: §1 above.
2. **No body-size limit.** Single curl call from any local process pins CPU and exhausts memory. Defence: §2 above.
3. **No idempotency keys on writes.** Network hiccup mid-request causes the client to retry; the model creates two issues, two comments, or closes-then-reopens-then-closes a ticket. Defence: §3 above.

You'll extend `THREATS.md` in W6 (auth-class threats) and W12 (full threat model). Starting it here means each subsequent week's threats land in a structured document instead of a `notes/` afterthought.

---

## Harness changes (`harness/src/index.ts`)

Add an `--transport http|stdio` flag. The HTTP path uses the SDK's HTTP client transport; the loop body is unchanged.

```ts
import { StreamableHttpClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const transport = args.transport === "http"
  ? new StreamableHttpClientTransport(new URL("http://127.0.0.1:8080/mcp"))
  : new StdioClientTransport({ command: "node", args: ["../server/dist/index.js"] });
```

For write tools, the harness should send `Idempotency-Key: <uuid>` per call. Generate it client-side, log it in the trace alongside the tool name. When you debug a duplicate-write incident later, the trace tells you whether the model retried with a fresh key (your bug) or the same key (the server's bug).

Re-run the Week 3 eval set under HTTP. Pass rate should match stdio within 1 case; if it doesn't, the divergence is your bug, not the protocol's.

---

## Artefact evolution

### Evolution: server

- **Before (W2-3):** stdio only; trusted-local; no transport-layer concerns.
- **Change:** add `hono` HTTP transport; introduce request-boundary validation (Origin, Host, body size, timeout) distinct from tool-boundary validation; wire session ID through `instrument()`.
- **After:** single binary serves both transports, selected by `--http` flag; same tool surface; session ID in every log line.
- **Verify:** `curl -X POST http://127.0.0.1:8080/mcp -d '{...initialize...}'` returns capabilities and a session ID; Inspector connects over HTTP; Week 3 evals rerun under HTTP match local pass rate within 1 case.
- **Enables:** W5 sessions and persistence, W6-7 OAuth at the HTTP boundary, W8 deployment.

### Evolution: harness

- **Before:** stdio client only.
- **Change:** add `StreamableHttpClientTransport`; CLI flag `--transport http|stdio`; emit `Idempotency-Key` per write call.
- **After:** same eval set runnable over either transport; idempotency-key visible in trace.
- **Verify:** `harness --transport http --eval evals/phase-1.jsonl` passes within 1 case of stdio baseline.
- **Enables:** W11 load testing requires the HTTP transport.

### Evolution: eval set

- **Before:** 12-20 cases, stdio.
- **Change:** add 3-4 transport-edge cases — large payloads (rejected by body limit), slow backends (rejected by timeout), mid-stream client disconnects (resumed via `Last-Event-ID`).
- **After:** set runs under both transports; regression on either fails CI.
- **Enables:** W11 load testing reuses the same cases.

### Evolution: error taxonomy

- **Before:** 6 codes (`invalid_args`, `not_found`, `backend_failure`, `rate_limited`, `forbidden`, `internal`).
- **Change:** decision required — fold transport errors into existing codes (recommended: timeout → `backend_failure` with `details.cause: "timeout"`, idempotency reuse → `invalid_args` with `details.cause: "idempotency_key_reuse"`), or add `transport_timeout` and `transport_aborted`. Document in an ADR.
- **After:** either 6 or 8 codes, consistently applied. Recommendation: stay at 6 — narrow vocabularies survive eval pressure better.

### Evolution: consumer README

- **Before:** stdio-only connect block.
- **Change:** add an HTTP connect section, the `Mcp-Session-Id` lifecycle, and the Origin/Host hardening note (so consumers know they can't proxy through a different hostname).
- **After:** dual-transport README with one section per transport.

### Evolution: workbook

- **New:** `THREATS.md` — three sections this week, extended every subsequent week through W12.

---

## Common pitfalls

:::danger[The five ways Week 4 goes wrong]
- **Binding to `0.0.0.0`.** Default to `127.0.0.1`. If you genuinely need external access, gate it on an ADR and a flag.
- **Allowing `Origin: *` in CORS.** It's not CORS that protects you here — it's the Origin allowlist on the request. `*` defeats it entirely.
- **Putting idempotency keys in the body.** They belong in the header. A body field is part of the hash, so the same logical request with a different "key field" looks like two requests.
- **Hashing only the body for idempotency.** A `tools/call` for `create_issue` and a `tools/call` for `comment_on_issue` can produce identical bodies if the args happen to match. Hash method + path + body.
- **Skipping the timeout.** A 30-second slow backend with no timeout is a 30-second held connection, a stuck idempotency entry, and a model that thinks the call succeeded.
:::

## Checkpoint — you've completed Week 4 when

- [ ] Server boots in both modes: `npm run dev` (stdio) and `npm run dev -- --http` (HTTP)
- [ ] HTTP transport binds to `127.0.0.1` only by default
- [ ] Origin and Host allowlists in place; `curl` from a fake Host header is rejected with 403
- [ ] Body-size limit returns 413 for payloads > 1 MB; verified with a test
- [ ] Per-tool timeout returns a structured `backend_failure` error; verified with an MSW test that hangs
- [ ] `Idempotency-Key` middleware: replay test passes (same key + same body → cached response; same key + different body → 422)
- [ ] Session ID present in every `instrument()` log line; stdio path emits `"stdio"`
- [ ] `Last-Event-ID` resumption verified manually (kill the SSE connection, reconnect, observe replay)
- [ ] Inspector connects over HTTP; harness `--transport http` runs the Week 3 eval set within 1 case of the stdio baseline
- [ ] `server/README.md` consumer section has both transports documented
- [ ] `THREATS.md` exists with the three Week 4 threats
- [ ] ADR written for the transport-error decision (fold or split)
- [ ] `git tag week-4-complete` on your workbook

## Leadership lens

The transport is where production-MCP teams reveal whether they take security seriously or whether they treat localhost as "behind the firewall." Every security audit of an MCP server I've seen finds the same three things first: bound to `0.0.0.0`, no Origin check, no body limit. Each takes ten minutes to fix and zero teams ship with all three correct on day one.

If you're hiring or reviewing, ask "what does your server do when I send `Origin: https://evil.com`?" The answer "we don't, that's a browser concern" tells you the team hasn't met DNS rebinding yet. The answer "we reject any Origin not in our allowlist, and we validate Host so rebinding is blocked even when Origin matches" tells you the team has read the right blog posts.

## Optional rabbit holes

- Read `@modelcontextprotocol/sdk`'s `streamableHttp.ts` source. The spec is 30 pages; the implementation is ~600 lines. Worth an hour.
- Try Cloudflare Workers as an HTTP host. The same `hono` app boots there with a one-line change. You'll meet this for real in Phase 4.
- Wire a Prometheus middleware that emits `mcp_request_duration_seconds` per route. You'll do this properly in W9 with OTel; doing it crudely here builds intuition.
- Write a tiny "evil" HTML page that issues `fetch("http://localhost:8080/mcp", { method: "POST", body: ... })`. Confirm your origin guard rejects it. (Run it from `file://` to get `Origin: null`, then from a local web server to get a real origin.) This is the most useful 20 minutes you'll spend on transport security.

## ADR candidates

- **Transport error shape** — fold into existing 6 codes vs. add 2 new (`transport_timeout`, `transport_aborted`). Recommended: fold, with `details.cause`.
- **Timeout policy** — single global, per-tool, or derived from a tool annotation. Recommended: per-tool, declared alongside the tool definition.
- **Idempotency key scope** — per-tool, per-tenant, per-session. Recommended: per-server, with the key's collision domain documented for clients.
- **SSE legacy support** — Streamable HTTP only vs. dual-mount with deprecation. Recommended: Streamable only for this pathway; revisit in Phase 4 if shipping publicly.
