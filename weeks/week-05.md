---
title: Week 5 — Sessions, persistence, prompts, roots (Phase 2, part 2)
---

# Week 5 — Sessions, persistence, prompts, roots (Phase 2, part 2)

**Time budget:** 8 to 12 hours.

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

## How session resumption works

The W4 transport already issues `Mcp-Session-Id` and replays SSE events by `Last-Event-ID`. What changes this week is **where those events live**. In W4 they were an in-memory `Map<sessionId, Event[]>` bounded at 1000; one process restart and the map is gone. This week the same interface is satisfied by a Postgres table, and resumption survives anything short of the database itself going away.

The flow, end to end:

```
┌──────────────┐                     ┌──────────────┐                ┌──────────────┐
│   Client     │                     │  MCP server  │                │   Postgres   │
│  (harness)   │                     │  (instance)  │                │              │
└──────────────┘                     └──────────────┘                └──────────────┘
       │                                    │                                │
       │ 1. POST /mcp initialize            │                                │
       ├──────────────────────────────────► │                                │
       │                                    │ INSERT sessions(id,...)        │
       │                                    ├──────────────────────────────► │
       │ Mcp-Session-Id: 7c3f...            │                                │
       │ ◄─────────────────────────────────┤                                │
       │                                    │                                │
       │ 2. POST /mcp tools/call            │                                │
       ├──────────────────────────────────► │                                │
       │                                    │ INSERT session_events(...)     │
       │                                    ├──────────────────────────────► │
       │ SSE: id=42 data={...}              │                                │
       │ ◄─────────────────────────────────┤                                │
       │                                    │                                │
       │            *** server crashes / docker compose restart ***          │
       │                                    │                                │
       │ 3. GET /mcp                        │                                │
       │    Mcp-Session-Id: 7c3f...         │                                │
       │    Last-Event-ID: 41               │                                │
       ├──────────────────────────────────► │                                │
       │                                    │ SELECT * FROM session_events   │
       │                                    │  WHERE session_id=7c3f         │
       │                                    │    AND event_id > 41           │
       │                                    ├──────────────────────────────► │
       │                                    │ ◄──────────────────────────────┤
       │ SSE: id=42 data={...}  (replay)    │                                │
       │ SSE: id=43 data={...}  (live)      │                                │
       │ ◄─────────────────────────────────┤                                │
```

Three things to internalise:

- **The session ID is the join key.** Every audit line, OTel span, eval trace, and (from W6) auth principal is grouped by it. Treat it as a first-class column, not a debug aid.
- **`event_id` is monotonically increasing per session, not globally.** That's why the schema uses `bigserial` for the global PK and indexes on `(session_id, event_id)` — you query by session, you sort by event.
- **A second server instance can serve the resumption.** The original instance that handed out `7c3f...` is dead; the new instance reads the same Postgres rows and the client can't tell the difference. This is the W8 deployment story arriving early.

## Tooling additions

- **Postgres 16** via docker-compose. Plain `pg` client; no ORM this week — SQL stays readable with 2-3 tables. Alternatives: [Drizzle](https://orm.drizzle.team) or [Kysely](https://kysely.dev) for type-safe query building (tradeoff: more setup before the first row).
- **node-pg-migrate** for schema migrations. Plain `init.sql` is tempting and wrong — by W8 you'll need versioned migrations. Start the discipline here. Alternative: [graphile-migrate](https://github.com/graphile/migrate) (more featureful, steeper curve).
- **better-sqlite3** stays for the local-only path (idempotency-key store from W4 doesn't need to move yet).

Install:

```bash
cd server
npm install pg node-pg-migrate
npm install -D @types/pg
```

## Reading list

1. **MCP spec — sessions and resumability.** (~25min) The lifecycle rules: session ID issuance, `Last-Event-ID` semantics, when the server is allowed to forget.
   → <https://modelcontextprotocol.io/specification/2025-06-18/basic/transports>
2. **MCP spec — prompts.** (~20min) The `prompts/list` and `prompts/get` shapes plus the user-invocation model (the model never sees prompts; the user picks them).
   → <https://modelcontextprotocol.io/specification/2025-06-18/server/prompts>
3. **MCP spec — completion.** (~15min) The `completion/complete` request and how clients render the suggestions.
   → <https://modelcontextprotocol.io/specification/2025-06-18/server/utilities/completion>
4. **MCP spec — roots.** (~15min) Short and load-bearing. Read it twice.
   → <https://modelcontextprotocol.io/specification/2025-06-18/client/roots>
5. **MCP spec — progress and cancellation.** (~15min) Two notification shapes; the cancellation one is the one most servers ignore.
   → <https://modelcontextprotocol.io/specification/2025-06-18/basic/utilities/progress>
6. **PostgreSQL docs — connection pooling.** (~20min) How `pg.Pool` works, why pool sizing matters under load (you'll meet this for real in W11).
   → <https://node-postgres.com/features/pooling>
7. **PostgreSQL docs — JSONB.** (~15min) Indexing, operators, when to reach for it vs. a typed column.
   → <https://www.postgresql.org/docs/16/datatype-json.html>
8. **Stripe engineering, "Designing webhooks."** (~15min) Adjacent to session resumption — the same idempotency-and-replay instincts apply.
   → <https://stripe.com/blog/webhook-design>

Optional but useful:
- **Postgres `LISTEN`/`NOTIFY`.** (~10min) You won't need it this week; you will in W9 when sessions need to fan out across instances.
   → <https://www.postgresql.org/docs/16/sql-listen.html>

## Setup checklist

- [ ] Week 4 complete; HTTP transport binds to `127.0.0.1` and the eval set passes
- [ ] Docker Desktop (or `colima` / `orbstack`) running; `docker compose version` returns 2.x
- [ ] `psql --version` available on the host (16.x recommended)
- [ ] Port 5432 free on the host (`lsof -i :5432`); pick another if not

---

## The session store interface

The whole point of putting the store behind an interface is that the **same call sites** work for the local sqlite path (carried from W4) and the Postgres path (new this week). Selecting between them is a one-line env-flag decision; everything else is the same.

```ts
// server/src/sessions/store.ts
import { Pool } from "pg";
import Database from "better-sqlite3";

export interface SessionRecord {
  id: string;
  subject: string | null;          // populated in W6 when auth lands
  createdAt: Date;
  lastSeenAt: Date;
  metadata: Record<string, unknown>;
}

export interface StoredEvent {
  eventId: number;
  sessionId: string;
  event: unknown;                  // the JSON-RPC envelope
  createdAt: Date;
}

export interface SessionStore {
  create(id: string, metadata?: Record<string, unknown>): Promise<SessionRecord>;
  get(id: string): Promise<SessionRecord | null>;
  touch(id: string): Promise<void>;                                     // updates last_seen_at
  appendEvent(sessionId: string, event: unknown): Promise<number>;      // returns the new event_id
  replayEventsSince(sessionId: string, lastEventId: number): Promise<StoredEvent[]>;
}

export class PostgresSessionStore implements SessionStore {
  constructor(private readonly pool: Pool) {}

  async create(id: string, metadata: Record<string, unknown> = {}) {
    const { rows } = await this.pool.query(
      `INSERT INTO sessions (id, metadata)
       VALUES ($1, $2)
       RETURNING id, subject, created_at, last_seen_at, metadata`,
      [id, metadata],
    );
    return mapSession(rows[0]);
  }

  async get(id: string) {
    const { rows } = await this.pool.query(
      `SELECT id, subject, created_at, last_seen_at, metadata
         FROM sessions WHERE id = $1`,
      [id],
    );
    return rows[0] ? mapSession(rows[0]) : null;
  }

  async touch(id: string) {
    await this.pool.query(
      `UPDATE sessions SET last_seen_at = now() WHERE id = $1`, [id],
    );
  }

  async appendEvent(sessionId: string, event: unknown) {
    const { rows } = await this.pool.query(
      `INSERT INTO session_events (session_id, event)
       VALUES ($1, $2)
       RETURNING event_id`,
      [sessionId, event],
    );
    return Number(rows[0].event_id);
  }

  async replayEventsSince(sessionId: string, lastEventId: number) {
    const { rows } = await this.pool.query(
      `SELECT event_id, session_id, event, created_at
         FROM session_events
        WHERE session_id = $1 AND event_id > $2
        ORDER BY event_id ASC`,
      [sessionId, lastEventId],
    );
    return rows.map(mapEvent);
  }
}

// Selector — one place that knows which backend is live.
export function buildSessionStore(): SessionStore {
  if (process.env.SESSION_STORE === "postgres") {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    return new PostgresSessionStore(pool);
  }
  return new SqliteSessionStore(new Database("var/sessions.db"));   // W4 carry-over
}

function mapSession(row: any): SessionRecord { /* ... */ return row; }
function mapEvent(row: any): StoredEvent { /* ... */ return row; }
```

Three things to notice:

- **`pg` over `postgres.js`.** Boring choice; widest documentation; `pg.Pool` is the de-facto Node Postgres client. `postgres.js` is faster and has nicer ergonomics; defer that swap to a Phase 4 ADR if there's a reason.
- **No ORM.** Three tables, hand-written SQL. The minute you reach for Drizzle/Kysely you've spent 30 minutes on the typed-query setup that you could have spent on prompts and roots.
- **`buildSessionStore()` is the one place env branching lives.** Every consumer takes a `SessionStore`; nothing imports `pg` or `better-sqlite3` directly. This is the abstraction W8 needs to swap in a managed Postgres without code churn.

### The schema (`server/src/sessions/migrations/001_init.sql`)

```sql
-- 001_init.sql — initial Postgres schema for sessions, event log, and prompt audit.

CREATE EXTENSION IF NOT EXISTS pgcrypto;     -- gen_random_uuid()

CREATE TABLE sessions (
  id            uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  subject       text         NULL,            -- populated in W6 when auth attaches a principal
  created_at    timestamptz  NOT NULL DEFAULT now(),
  last_seen_at  timestamptz  NOT NULL DEFAULT now(),
  metadata      jsonb        NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX sessions_last_seen_at_idx ON sessions (last_seen_at);
CREATE INDEX sessions_subject_idx      ON sessions (subject) WHERE subject IS NOT NULL;

CREATE TABLE session_events (
  event_id    bigserial    PRIMARY KEY,
  session_id  uuid         NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  event       jsonb        NOT NULL,
  created_at  timestamptz  NOT NULL DEFAULT now()
);

-- The composite index is the one that resumption queries hit.
CREATE INDEX session_events_session_event_idx
  ON session_events (session_id, event_id);

CREATE TABLE prompt_invocations (
  invocation_id  bigserial    PRIMARY KEY,
  session_id     uuid         NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  prompt_name    text         NOT NULL,
  arguments      jsonb        NOT NULL DEFAULT '{}'::jsonb,
  invoked_at     timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX prompt_invocations_session_idx ON prompt_invocations (session_id, invoked_at DESC);
CREATE INDEX prompt_invocations_name_idx    ON prompt_invocations (prompt_name);
```

Three details worth pausing on:

- **`ON DELETE CASCADE` on `session_events.session_id`.** Eviction policy is "delete the session row, lose the events." Get the cascade direction right now; reverse it later is a migration headache.
- **`metadata jsonb`.** Avoids a schema change every time you want to remember a new session-scoped fact (transport version, client name, last tool called). `jsonb` is queryable; `json` isn't. Always pick `jsonb`.
- **`prompt_invocations` is an audit table.** It's not on the `prompts/get` hot path. Writes are fire-and-forget; reads are for the eval set and for W9's observability queries.

---

## Long-running tools: progress and cancellation

A tool that runs for more than ~2 seconds without emitting progress feels broken to the user, even when it isn't. The MCP spec gives you `notifications/progress`; what most servers miss is the **other half** — honouring `notifications/cancelled` when the user gives up.

```ts
// server/src/tools/long-running.ts
import { z } from "zod";
import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { instrument } from "../instrumentation.js";
import { ToolErrorCode, toolError } from "../errors.js";

const argsSchema = z.object({
  query: z.string().min(1),
  steps: z.number().int().min(1).max(50).default(10),
});

const inputSchema = {
  type: "object",
  properties: {
    query: { type: "string", description: "Search query to expand" },
    steps: { type: "integer", minimum: 1, maximum: 50, default: 10 },
  },
  required: ["query"],
} as const;

export function buildLongRunningTool(mcp: Server) {
  return {
    name: "deep_research",
    description: "Use this when the user asks for a multi-step research expansion that takes longer than a single search. Emits progress.",
    inputSchema,
    handler: instrument("deep_research", async (raw, ctx) => {
      const args = argsSchema.parse(raw);
      const { signal, progressToken } = ctx;     // both supplied by the SDK request handler

      for (let i = 0; i < args.steps; i++) {
        if (signal.aborted) {
          return toolError(ToolErrorCode.BackendFailure, "Cancelled by client", {
            cause: "cancelled",
            completed_steps: i,
          });
        }

        await doOneStep(args.query, i, signal);

        if (progressToken !== undefined) {
          await mcp.notification({
            method: "notifications/progress",
            params: {
              progressToken,
              progress: i + 1,
              total: args.steps,
              message: `step ${i + 1} of ${args.steps}`,
            },
          });
        }
      }

      return { content: [{ type: "text", text: "done" }] };
    }),
  };
}

async function doOneStep(query: string, i: number, signal: AbortSignal): Promise<void> {
  // Pass `signal` into the longest-blocking call (HTTP fetch, DB query).
  // Checking `signal.aborted` only at loop edges is the cancellation pitfall.
  await fetch(`https://example/expand?q=${encodeURIComponent(query)}&i=${i}`, { signal });
}
```

The SDK invokes the handler with `ctx.signal` (an `AbortSignal` derived from the inbound `notifications/cancelled`) and `ctx.progressToken` (echoed from the request's `_meta.progressToken`). Two rules:

- **Pass `signal` into every awaited call that can block.** A loop that only checks `signal.aborted` between steps cancels at most once per step — fine for fast loops, useless for slow ones. `fetch`, `pg.Pool.query`, anything async — all of them take an `AbortSignal`.
- **Don't emit progress every iteration of a tight loop.** One notification per ~250ms or per logical step. Notification spam is its own pathology.

---

## Prompts as a primitive

Prompts are the third MCP primitive (alongside tools and resources). They're not "system prompts" — they're **named, server-defined templates the user invokes through the client UI**. The model never sees the prompt list; the user picks one, the client expands it into a message, the model reacts.

This week ships two: `summarise-issue` (parameterless) and `triage-pr` (with arguments + completion).

### The registry pattern (`server/src/prompts/index.ts`)

Mirrors the `tools/index.ts` pattern from W2 — same shape, same registration discipline.

```ts
// server/src/prompts/index.ts
import {
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  CompleteRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { summariseIssuePrompt } from "./summarise-issue.js";
import { triagePrPrompt } from "./triage-pr.js";

export interface PromptDefinition {
  name: string;
  description: string;
  arguments?: Array<{ name: string; description: string; required: boolean }>;
  get: (args: Record<string, string>) => Promise<{ messages: PromptMessage[] }>;
  complete?: (argName: string, value: string) => Promise<{ values: string[]; total?: number }>;
}

const prompts: PromptDefinition[] = [summariseIssuePrompt, triagePrPrompt];

export function registerPrompts(mcp: Server) {
  mcp.setRequestHandler(ListPromptsRequestSchema, async () => ({
    prompts: prompts.map((p) => ({
      name: p.name,
      description: p.description,
      arguments: p.arguments ?? [],
    })),
  }));

  mcp.setRequestHandler(GetPromptRequestSchema, async (req) => {
    const p = prompts.find((x) => x.name === req.params.name);
    if (!p) throw new Error(`unknown prompt: ${req.params.name}`);
    return p.get(req.params.arguments ?? {});
  });

  mcp.setRequestHandler(CompleteRequestSchema, async (req) => {
    const ref = req.params.ref;
    if (ref.type !== "ref/prompt") return { completion: { values: [], total: 0 } };
    const p = prompts.find((x) => x.name === ref.name);
    if (!p?.complete) return { completion: { values: [], total: 0 } };
    const result = await p.complete(req.params.argument.name, req.params.argument.value);
    return { completion: result };
  });
}
```

Same instinct as the tool registry: one array, three handlers wired off it, new prompts added by importing and pushing.

### `summarise-issue` — parameterless

```ts
// server/src/prompts/summarise-issue.ts
import type { PromptDefinition } from "./index.js";

export const summariseIssuePrompt: PromptDefinition = {
  name: "summarise-issue",
  description:
    "Summarise the most recently read GitHub issue in this session. " +
    "Use after `read_issue` to produce a 3-bullet digest for sharing.",
  async get() {
    return {
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text:
              "Summarise the issue I just read in three bullets: " +
              "(1) what the user reports, (2) the current status, " +
              "(3) the most recent meaningful comment.",
          },
        },
      ],
    };
  },
};
```

Parameterless prompts are still useful — they package a recurring instruction so the user doesn't have to retype it. The `get` handler can read session state (e.g. the last `read_issue` result from the W5 session store) and bake it into the message; this example keeps it text-only for clarity.

### `triage-pr` — arguments + completion

```ts
// server/src/prompts/triage-pr.ts
import type { PromptDefinition } from "./index.js";

const SEVERITIES = ["blocker", "major", "minor", "trivial"] as const;
const AREAS = ["api", "auth", "db", "transport", "ui", "infra"] as const;

export const triagePrPrompt: PromptDefinition = {
  name: "triage-pr",
  description:
    "Triage an open pull request. Use when reviewing the queue: " +
    "asks the model to assign severity, area, and a recommended next action.",
  arguments: [
    { name: "severity", description: "Suggested severity (blocker | major | minor | trivial)", required: true },
    { name: "area",     description: "Codebase area (api | auth | db | transport | ui | infra)", required: true },
  ],
  async get(args) {
    return {
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text:
              `Triage the open PRs in the current view. Apply severity=${args.severity ?? "<unset>"} ` +
              `as a baseline and area=${args.area ?? "<unset>"} as a hint. ` +
              `For each PR, return: severity, area, one-line justification, recommended next action.`,
          },
        },
      ],
    };
  },
  async complete(argName, value) {
    const lookup = argName === "severity" ? SEVERITIES : argName === "area" ? AREAS : [];
    const matches = lookup.filter((v) => v.startsWith(value.toLowerCase()));
    return { values: matches.slice(0, 10), total: matches.length };
  },
};
```

The `complete` handler is what makes the client offer a dropdown rather than a free-text box. Two rules:

- **Return ≤100 values per response, set `total` honestly.** The client uses `total` to decide whether to render "and N more" UI.
- **Match on prefix, not substring.** Substring matching feels nice but produces noise; users typing `b` for `blocker` don't want `[major, minor]` ranked above `blocker`.

---

## Roots: what the client lets you see

Roots are the client's declaration of *which paths/URIs the server is allowed to touch*. The classic case is a filesystem MCP server — the client says "you may read under `/Users/me/projects/foo`," and any tool that takes a path is required to validate against that list. Backend-API servers benefit too: a roots-aware server refuses to operate on a repo URL outside what the client advertised, which kills a class of confused-deputy bugs before W6 ever lands.

```ts
// server/src/roots.ts
import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { ListRootsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { resolve, sep } from "node:path";

export interface Root { uri: string; name?: string; }

let cachedRoots: Root[] | null = null;

export async function refreshRoots(mcp: Server): Promise<Root[]> {
  // The server requests the current roots from the client.
  const result = await mcp.request(
    { method: "roots/list" },
    ListRootsRequestSchema,
  );
  cachedRoots = result.roots ?? [];
  return cachedRoots;
}

export function getCachedRoots(): Root[] {
  return cachedRoots ?? [];
}

export function validatePathAgainstRoots(path: string, roots: Root[] = getCachedRoots()): boolean {
  if (roots.length === 0) return false;          // no roots advertised → deny everything
  const absolute = resolve(path);
  return roots.some((r) => {
    if (!r.uri.startsWith("file://")) return false;
    const rootPath = decodeURIComponent(r.uri.replace(/^file:\/\//, ""));
    const normalised = resolve(rootPath);
    // `path/sep` boundary stops `/Users/me/projects/foo-evil` matching root `/Users/me/projects/foo`.
    return absolute === normalised || absolute.startsWith(normalised + sep);
  });
}
```

Two non-obvious rules:

- **Deny by default when no roots are advertised.** The intuition "no roots means no restrictions" is exactly backwards — a client that hasn't advertised roots either doesn't support them or hasn't sent them yet. Either way, refuse path operations until you have an explicit list.
- **The `+ sep` boundary check is load-bearing.** Without it, `/projects/foo-evil` slips past root `/projects/foo` because `startsWith` matches a prefix. Path-traversal bugs love string-prefix checks.

### Wiring it into a W2 path-taking tool

```ts
// server/src/tools/read-file.ts (excerpt)
import { instrument } from "../instrumentation.js";
import { validatePathAgainstRoots } from "../roots.js";
import { ToolErrorCode, toolError } from "../errors.js";

export const readFileTool = {
  name: "read_file",
  description: "Use this when the user asks to read the contents of a file by path.",
  inputSchema: {
    type: "object",
    properties: { path: { type: "string", description: "Absolute path to the file" } },
    required: ["path"],
  },
  handler: instrument("read_file", async (raw) => {
    const args = z.object({ path: z.string() }).parse(raw);

    if (!validatePathAgainstRoots(args.path)) {
      return toolError(ToolErrorCode.Forbidden, "Path is outside declared roots", {
        cause: "outside_roots",
        path: args.path,
      });
    }

    return { content: [{ type: "text", text: await readFile(args.path, "utf8") }] };
  }),
};
```

One line of validation per path-taking tool. The temptation is to put the check in a wrapper — "every tool gets root-checked" — but path is one of many shapes a tool can take, and a wrapper that introspects `args` for path-shaped fields is more bug-prone than the explicit one-liner. ADR candidate this week: explicit per-tool vs. wrapper vs. annotation.

---

## The compose stack (`docker-compose.yml`)

This is the file that grows for every subsequent week. Get the conventions right now: localhost-only port bindings, healthchecks on every service, named volumes for data, one-shot containers for migrations.

```yaml
# docker-compose.yml — Week 5 baseline. Extended in W6 (local-issuer), W8 (containerised
# server), W9 (Jaeger + Prometheus), W10 (Grafana), W11 (k6).

services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER:     mcp
      POSTGRES_PASSWORD: mcp
      POSTGRES_DB:       mcp
    ports:
      - "127.0.0.1:5432:5432"      # localhost-only — same instinct as the W4 HTTP bind
    volumes:
      - postgres-data:/var/lib/postgresql/data
    healthcheck:
      test:     ["CMD-SHELL", "pg_isready -U mcp -d mcp"]
      interval: 5s
      timeout:  3s
      retries:  10
      start_period: 5s

  migrate:
    image: node:20-alpine
    working_dir: /app
    volumes:
      - ./server:/app
    environment:
      DATABASE_URL: postgres://mcp:mcp@postgres:5432/mcp
    command: ["sh", "-c", "npm ci --no-audit && npx node-pg-migrate up"]
    depends_on:
      postgres:
        condition: service_healthy
    restart: "no"                  # one-shot

  server:
    build: ./server
    environment:
      SESSION_STORE: postgres
      DATABASE_URL:  postgres://mcp:mcp@postgres:5432/mcp
      MCP_PORT:      "8080"
    ports:
      - "127.0.0.1:8080:8080"
    depends_on:
      postgres:
        condition: service_healthy
      migrate:
        condition: service_completed_successfully
    healthcheck:
      test:     ["CMD-SHELL", "wget -qO- http://127.0.0.1:8080/health || exit 1"]
      interval: 10s
      timeout:  3s
      retries:  5
      start_period: 5s

volumes:
  postgres-data:
    name: mcp-postgres-data
```

Three conventions worth fixing now because every later week assumes them:

- **All host port bindings start with `127.0.0.1:`.** Same instinct as W4's HTTP bind. Without the prefix, Docker exposes the port on every interface (including external networks).
- **`depends_on: condition: service_healthy`.** The default `depends_on` only waits for the container to *start*, not for the service inside it to be ready. Postgres takes 2-3 seconds to accept connections after the container is "up"; the migrate job will fail without the healthcheck condition.
- **Named volume, not an anonymous mount.** `docker compose down && docker compose up` preserves `mcp-postgres-data`. `docker compose down -v` is the deliberate-data-loss escape hatch.

---

## Harness changes

The harness needs three new behaviours to exercise the new server surface:

1. **Advertise roots on connect.** Send a `roots/list` response when the server requests one. The W4 harness ignored this; now it must answer.
2. **Handle `notifications/progress`.** Print them in the trace output so a learner can watch a long-running tool tick.
3. **Send `notifications/cancelled` on Ctrl-C.** Trap `SIGINT`, send the cancellation, give the server up to 1 second to wind down, then exit.

The harness also gains `prompts/list` and `prompts/get` calls in eval mode — the new cases assert that listing returns both prompts, that `triage-pr.severity` completion returns the four severity strings, and that `summarise-issue` invocation produces a non-empty message array.

---

## Artefact evolution

### Evolution: server

- **Before (end of W4):** HTTP + stdio with in-memory session map and bounded event log; no prompts; no roots.
- **Change:** swap session store and event log to Postgres-backed implementations behind the same interface; add 2 prompts (one with completion); add roots advertisement and validation in any path-taking tool.
- **After:** sessions survive a server restart; long-running tools emit progress and respect cancellation; clients can list and invoke prompts; tools refuse paths outside the client's declared roots.
- **Verify:**
  ```bash
  docker compose up -d
  # Start a session, fire one tool call, kill the server, restart, resume.
  SID=$(curl -si http://127.0.0.1:8080/mcp -H 'Content-Type: application/json' \
    -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' \
    | awk -F': ' '/Mcp-Session-Id/ {print $2}' | tr -d '\r')
  docker compose restart server
  psql -h 127.0.0.1 -U mcp -d mcp -c "SELECT count(*) FROM session_events WHERE session_id = '$SID';"
  # > count = N (events survived the restart)
  curl -N "http://127.0.0.1:8080/mcp" -H "Mcp-Session-Id: $SID" -H "Last-Event-ID: 0"
  # > SSE stream replays events 1..N
  ```
- **Enables:** W6-7 attaches a user identity to every session (the `sessions` table grows a `subject` column); W8 deployment runs N instances against the same Postgres; W9 traces query by session.

### Evolution: harness

- **Before:** stateless calls; no prompt support; sends path arguments without root awareness.
- **Change:** handle `notifications/progress` in the trace; support `prompts/list` + `prompts/get`; advertise roots on connect; emit `notifications/cancelled` on Ctrl-C and verify the server honours it.
- **After:** harness exercises every primitive a real client would.
- **Verify:**
  ```bash
  cd harness
  npm run dev -- --transport http "expand the term 'incident response' across 20 sources"
  # Trace shows: 20 progress notifications, then a final assistant message.

  # In a second terminal, kill it mid-run:
  npm run dev -- --transport http "expand the term 'observability' across 50 sources" &
  sleep 2 && kill -INT %1
  # Trace shows: notifications/cancelled sent; server responds with backend_failure cause=cancelled within 1s.

  npm run eval -- --transport http evals/phase-2.jsonl
  # > prompts.invoke.summarise-issue              PASS
  # > prompts.complete.triage-pr.severity         PASS  (4 values returned)
  # > roots.reject.outside-path                   PASS
  # > cancellation.during-long-tool               PASS
  ```

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
- **Verify:**
  ```bash
  docker compose up -d --wait
  curl -fsS http://127.0.0.1:8080/health        # > 200 OK
  psql -h 127.0.0.1 -U mcp -d mcp -c "\dt"       # > sessions | session_events | prompt_invocations | pgmigrations
  docker compose down && docker compose up -d --wait
  psql -h 127.0.0.1 -U mcp -d mcp -c "SELECT count(*) FROM sessions;"
  # > rows survive across the restart (named volume holds them)
  ```
- **Enables:** every subsequent week adds services to this file — local OAuth issuer (W6-7), containerised server (W8), Jaeger + Prometheus (W9), Grafana (W10), k6 (W11).

### Evolution: consumer README

- **Before:** stdio + HTTP connect blocks.
- **Change:** add a "Prompts" section listing the available prompts and arguments; add a "Roots" section noting what the server expects clients to advertise.
- **After:** README documents four primitives.

### Evolution: THREATS.md

- **Change:** add **path-traversal via tool arguments** (defended by roots), and **session-fixation** (defended by server-issued session IDs from W4 + a `subject` binding starting in W6). Two new sections, ~50 words each.

---

## Common pitfalls

:::danger[The four ways Week 5 goes wrong]
- **Treating prompts as templated strings.** They're a server primitive with their own list/get/argument-completion lifecycle. The model never sees them; the *user* picks them through the client UI.
- **Assuming roots are advisory.** They aren't. A path-taking tool that doesn't validate against roots is a confused-deputy bug waiting to happen — covered properly in W6 and W12.
- **Skipping migrations.** "Just one `init.sql`" is the seed of a Phase 4 disaster. Versioned migrations cost 30 minutes this week and save days later.
- **Cancelling lazily.** A tool that checks for cancellation only at the start of a loop iteration is fine for fast loops and useless for slow ones. Cancellation has to thread into the longest-blocking call (the backend HTTP request) via `AbortSignal`.
:::

## Checkpoint

- [ ] Postgres-backed session store; sessions survive `docker compose restart`
- [ ] Event log migrated from in-memory to Postgres; `Last-Event-ID` resumption works after a restart
- [ ] At least one long-running tool emits progress notifications
- [ ] Cancellation works end-to-end: harness Ctrl-C terminates the in-flight tool within 1s
- [ ] Two prompts shipped — one parameterless, one with arguments + `completion/complete`
- [ ] Roots advertised by the harness; the server's path-taking tools reject out-of-root paths with `Forbidden`
- [ ] Eval set extended with the six new cases listed above; all pass
- [ ] `docker compose up` brings the stack up cleanly; healthchecks pass
- [ ] Migrations are version-controlled; rolling back the latest migration succeeds (`npx node-pg-migrate down`)
- [ ] `THREATS.md` extended with two new sections
- [ ] `git tag week-5-complete`
- [ ] `git tag phase-2-complete` after `make verify`

## ADR candidates

- Session TTL and eviction policy (idle timeout vs. absolute timeout vs. both).
- Prompt versioning (rename vs. version field vs. additive-only).
- Roots enforcement boundary (every tool, vs. a wrapper, vs. a per-tool annotation that says "this tool respects roots").
- Schema-migration tool choice (`node-pg-migrate` vs. `graphile-migrate` vs. plain SQL with a hand-rolled `applied_migrations` table).
- Postgres client choice (`pg` vs. `postgres.js`) — recommended: `pg` for now; revisit if pool ergonomics or query speed bite in W11.
