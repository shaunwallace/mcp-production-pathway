---
title: Week 2 — Build your first server (Phase 1, part 1)
---

# Week 2 — Build your first server (Phase 1, part 1)

**Time budget:** 8 to 12 hours across three or four sittings.

:::tip[Where the real work is]
The protocol layer is mostly handled by the SDK. The work — and the learning — is in **tool design**: naming, granularity, error shapes, idempotency. Spend your time there.
:::

## What you'll have by the end of the week

- A working MCP server exposing 4-6 tools and 1 resource against a real backend
- A minimal agent harness (~40 lines) that drives the server end-to-end through Claude
- A vitest suite covering unit tests of tool handlers and contract tests against recorded backend fixtures
- Structured `pino` logs emitted per tool call via an `instrument()` wrapper
- A canonical error taxonomy the model can reason about
- A stub consumer-facing README in your workbook
- First-draft tool definitions committed with narrative rationale

## Why this week exists

Most MCP servers fail not at the protocol layer, where the SDKs handle most of the work, but at the tool-design layer, which SDKs can't help with. By building a small server against a real third-party backend of your choice, you're forced to confront the real questions: naming, granularity, error shape, idempotency. These are skills that carry for the rest of the pathway.

The worked example below uses GitHub as the canonical backend (matching Week 0's default). If you picked a different backend, the shape of the work is identical — substitute your backend's primitives for the names shown.

## Reading list

1. **MCP TypeScript SDK README and examples.** (~45min) Skim, run one example, re-read.
   → <https://github.com/modelcontextprotocol/typescript-sdk>
2. **MCP Inspector.** (~20min) You'll use this all week.
   → <https://github.com/modelcontextprotocol/inspector>
3. **Anthropic's "Building effective agents," the tool-design sections** (Dec 2024). (~20min) Particularly the descriptions-over-schemas point.
   → <https://www.anthropic.com/research/building-effective-agents>
4. **Claude Desktop user quickstart.** (~10min) Confirms where `claude_desktop_config.json` lives so you can register your server.
   → <https://modelcontextprotocol.io/quickstart/user>
5. **Zod docs, "Usage with TypeScript" and "Error handling" sections.** (~20min) You'll derive JSON Schema from zod, and the error shape informs this week's error taxonomy.
   → <https://zod.dev>

## The tooling stack for this week

Opinionated but swappable. Canonical choices stay consistent across the pathway; alternatives are flagged so you can substitute without translating every snippet.

- **zod** for input validation and as the single source of truth for schemas. Alternatives: [valibot](https://valibot.dev) (smaller bundle, similar API — tradeoff: smaller ecosystem), [ajv](https://ajv.js.org) (JSON Schema native — tradeoff: less ergonomic for TS-first code).
- **pino** for structured logging. Alternatives: [winston](https://github.com/winstonjs/winston) (more featureful, more overhead), [roarr](https://github.com/gajus/roarr) (log-everywhere philosophy).
- **vitest** for tests. Alternatives: [`node:test`](https://nodejs.org/api/test.html) (zero dep — tradeoff: less featured), [jest](https://jestjs.io) (bigger, slower start in ESM).
- **MSW** for HTTP mocking in contract tests. Alternative: [nock](https://github.com/nock/nock) (older, still fine).
- **zod-to-json-schema** to derive the MCP `inputSchema` from the zod schema — one source of truth.

Install in the server scaffold:

```bash
cd server
npm install zod zod-to-json-schema pino
npm install -D vitest msw @types/node
```

## Setup checklist

Work through this before you write any code. Should take 20-40 minutes.

- [ ] Node 22+ (`node --version`)
- [ ] Backend credentials for your chosen Week 2 backend, with 5-10 seeded test items
- [ ] Anthropic API key in `~/.zshrc` or `.env`
- [ ] Claude Desktop installed for manual testing (macOS/Windows) OR plan to use only Inspector (Linux)
- [ ] MCP Inspector available: `npx @modelcontextprotocol/inspector` works without install
- [ ] Your workbook repo cloned locally

## Exercise: design 4-6 tools and 1 resource

This is the core work of the week. Before you write any implementation code, design the surface.

**Constraints for tools:**

- **4 to 6 tools.** More than six is almost always wrong in a first pass; fewer than four doesn't exercise the design space.
- **At least one read tool, at least one write tool.** Writes force you to think about idempotency and error handling.
- **No tool may overlap meaningfully with another.** If two tools could plausibly be picked for the same query, one of them is wrong.
- **Every tool must have a verb-noun or verb-object name.** Generic names like `query`, `get`, `run`, or `do` are disqualifying.

**Constraint for the resource (new this revision):**

Expose at least **one resource**. Resources are addressable, read-only data the client can fetch directly by URI without the model "calling" anything. Good candidates: your backend's user profile, a config blob, a schema description, a README-like index. Bad candidate: anything that needs parameters richer than a URI template.

This matters. A pathway graduate who has only ever built tool-servers has a credibility gap. Resources are part of MCP; use them.

Suggested starter sets (pick the row that matches your backend, then adjust):

| Backend | Read tools | Write tools | Resource |
|---------|-----------|-------------|----------|
| GitHub | `search_issues`, `read_issue`, `list_pull_requests` | `create_issue`, `comment_on_issue`, `close_issue` | `github://user/profile` |
| Linear | `search_issues`, `read_issue`, `list_project_issues` | `create_issue`, `comment_on_issue`, `update_issue_status` | `linear://viewer` |
| Notion | `search_pages`, `read_page`, `list_database_entries` | `create_page`, `append_to_page`, `comment_on_page` | `notion://databases/index` |
| Todoist | `search_tasks`, `read_task`, `list_project_tasks` | `create_task`, `comment_on_task`, `complete_task` | `todoist://user/projects` |
| Trello | `search_cards`, `read_card`, `list_board_cards` | `create_card`, `comment_on_card`, `move_card_to_list` | `trello://boards/index` |

Write the tool definitions first, in `server/src/tools/definitions.ts`. For each tool, write the name, description (written as a prompt for the model — "Use this when…"), and the zod schema for inputs. No implementation yet.

Then write a short tool-design note at `notes/week-02-tool-design.md`: why these tools, why these names, what you considered and rejected.

## Worked example: `search_issues` end-to-end

One tool, shown in full. The others follow the same pattern.

### Definition (`server/src/tools/search-issues.ts`)

```ts
import { z } from "zod";
import zodToJsonSchema from "zod-to-json-schema";
import { instrument } from "../instrumentation.js";
import { toolError, ToolErrorCode } from "../errors.js";
import { GithubClient } from "../backends/github.js";

const SearchIssuesInput = z.object({
  query: z.string().min(1).describe("Free-text search query — title, body, labels"),
  repo: z.string().regex(/^[\w.-]+\/[\w.-]+$/).describe("owner/repo, e.g. 'anthropics/claude-code'"),
  state: z.enum(["open", "closed", "all"]).default("open"),
  limit: z.number().int().min(1).max(50).default(10),
});

export const searchIssues = {
  name: "search_issues",
  description:
    "Full-text search across issues in a single GitHub repo. " +
    "Use this when the user is looking for an issue by topic, title, or body text " +
    "but does not have the issue number. Returns up to 50 results sorted by relevance. " +
    "Do NOT use for pull requests — use list_pull_requests for those.",
  inputSchema: zodToJsonSchema(SearchIssuesInput, { target: "openApi3" }),
  handler: instrument("search_issues", async (raw: unknown) => {
    const parsed = SearchIssuesInput.safeParse(raw);
    if (!parsed.success) {
      return toolError(ToolErrorCode.InvalidArgs, "Invalid arguments", parsed.error.issues);
    }
    const client = new GithubClient(process.env.GITHUB_TOKEN!);
    try {
      const results = await client.searchIssues(parsed.data);
      if (results.length === 0) {
        return { content: [{ type: "text", text: `No issues matched "${parsed.data.query}" in ${parsed.data.repo}.` }] };
      }
      return {
        content: [{
          type: "text",
          text: results.map(r => `#${r.number} (${r.state}) ${r.title}`).join("\n"),
        }],
      };
    } catch (err) {
      return toolError(ToolErrorCode.BackendFailure, "GitHub search failed", { cause: String(err) });
    }
  }),
};
```

Things to notice:

- **The description is long and model-facing.** The "Use this when" and "Do NOT use for" phrasing is what steers selection. You'll tune these in Week 3 based on eval failures.
- **The zod schema is the one source of truth.** `zod-to-json-schema` derives the `inputSchema` MCP exposes to the client; the same schema validates at handler entry. Change the schema in one place.
- **The handler returns a structured error, not a thrown exception.** The model can read the error shape and recover; it cannot recover from a stack trace.
- **The handler is wrapped with `instrument()`.** That wrapper is the single log-emission point — it becomes the OpenTelemetry span in Week 9.

### The instrumentation wrapper (`server/src/instrumentation.ts`)

```ts
import { createHash } from "node:crypto";
import pino from "pino";

const log = pino({
  base: null,
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: { level: (label) => ({ level: label }) },
});

export type Handler = (args: unknown) => Promise<unknown>;

export function instrument(toolName: string, fn: Handler): Handler {
  return async (args) => {
    const start = performance.now();
    const argsHash = createHash("sha256").update(JSON.stringify(args ?? {})).digest("hex").slice(0, 16);
    const sessionId = process.env.MCP_SESSION_ID ?? "local";
    try {
      const result = await fn(args);
      log.info({
        event: "tool_call",
        tool: toolName,
        args_hash: argsHash,
        session_id: sessionId,
        duration_ms: Math.round(performance.now() - start),
        outcome: "ok",
      });
      return result;
    } catch (err) {
      log.error({
        event: "tool_call",
        tool: toolName,
        args_hash: argsHash,
        session_id: sessionId,
        duration_ms: Math.round(performance.now() - start),
        outcome: "error",
        error_class: err instanceof Error ? err.constructor.name : "Unknown",
      });
      throw err;
    }
  };
}
```

The shape of the log line is deliberately fixed. You'll bolt on OTel attributes in Week 9 without breaking any downstream consumer of these logs.

### Error taxonomy (`server/src/errors.ts`)

Every tool returns errors in the same shape. The model can pattern-match on `code`; a human operator reads `message` and `details`.

```ts
export enum ToolErrorCode {
  InvalidArgs = "invalid_args",        // caller's fault, do not retry without changes
  NotFound = "not_found",              // target doesn't exist
  BackendFailure = "backend_failure",  // upstream error; may be transient
  RateLimited = "rate_limited",        // upstream throttling; retry later
  Forbidden = "forbidden",             // auth/permission issue
  Internal = "internal",               // our bug; user should not retry
}

export function toolError(code: ToolErrorCode, message: string, details?: unknown) {
  return {
    isError: true,
    content: [{
      type: "text",
      text: JSON.stringify({ code, message, details }, null, 2),
    }],
  };
}
```

Six codes, no more. If you're tempted to add a seventh, you probably want to widen `details` instead. Narrow error vocabularies are easier for a model to reason about than fine-grained taxonomies.

### Unit test (`server/src/tools/search-issues.test.ts`)

```ts
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { searchIssues } from "./search-issues.js";

const server = setupServer(
  http.get("https://api.github.com/search/issues", ({ request }) => {
    const q = new URL(request.url).searchParams.get("q");
    if (q?.includes("auth")) {
      return HttpResponse.json({ items: [{ number: 42, title: "Fix auth migration", state: "open" }] });
    }
    return HttpResponse.json({ items: [] });
  }),
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("search_issues", () => {
  it("rejects invalid args", async () => {
    const result: any = await searchIssues.handler({ repo: "not-a-repo" });
    expect(result.isError).toBe(true);
    expect(JSON.parse(result.content[0].text).code).toBe("invalid_args");
  });

  it("returns hits for matching query", async () => {
    const result: any = await searchIssues.handler({ query: "auth", repo: "anthropics/claude-code" });
    expect(result.content[0].text).toContain("#42");
  });

  it("handles zero hits with useful text, not an error", async () => {
    const result: any = await searchIssues.handler({ query: "no-such-thing", repo: "anthropics/claude-code" });
    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain("No issues matched");
  });
});
```

Three tests cover the three outcomes the model sees: invalid args, hits, zero-hits-but-not-an-error. The last one is how you start guarding against **empty success** — a tool that returns "success" with useless content, which Week 3 explores in depth.

## Tool annotations: telling clients what your tool does

The `searchIssues` definition above is correct as far as it goes, but it's missing four hints that the 2025-06-18 spec added: **tool annotations**. They sit on the tool object alongside `name`/`description`/`inputSchema`, and they tell the client what kind of operation this is so the client can render appropriate UX — a "skip review" badge for read-only tools, a confirmation prompt for destructive ones.

```ts
export const searchIssues = {
  name: "search_issues",
  description: "...",
  inputSchema: zodToJsonSchema(SearchIssuesInput, { target: "openApi3" }),
  annotations: {
    title: "Search issues",        // human-readable label clients display
    readOnlyHint: true,             // does not modify any state
    destructiveHint: false,         // never destroys data
    idempotentHint: true,            // calling twice = same effect as once
    openWorldHint: true,             // reaches an external system (GitHub)
  },
  handler: instrument(...),
};
```

| Annotation | Meaning | True when |
|---|---|---|
| `readOnlyHint` | Tool does not modify any state | All `search_*`, `read_*`, `list_*` tools |
| `destructiveHint` | If not read-only, does the write destroy data? | `delete_*`, `close_*`, `complete_*` where state can't be recovered cheaply |
| `idempotentHint` | Calling N times with the same args has the same effect as calling once | All read tools; `update_status` usually; `comment_on_*` is **not** |
| `openWorldHint` | Tool reaches systems beyond the server itself | Any backend-hitting tool; false for server-internal utilities |

Applied to the GitHub starter set:

| Tool | readOnly | destructive | idempotent | openWorld |
|---|---|---|---|---|
| `search_issues` | ✓ | ✗ | ✓ | ✓ |
| `read_issue` | ✓ | ✗ | ✓ | ✓ |
| `list_pull_requests` | ✓ | ✗ | ✓ | ✓ |
| `create_issue` | ✗ | ✗ | ✗ | ✓ |
| `comment_on_issue` | ✗ | ✗ | ✗ | ✓ |
| `close_issue` | ✗ | ✓ | ✓ | ✓ |

`close_issue` is destructive *and* idempotent — closing a closed issue is a no-op, but the close itself can't be undone in a single call, so the destructive bit stays set. The common mistake is marking `comment_on_issue` as idempotent because "the API still accepts it." It isn't — two calls create two comments. The hint describes the user-observable effect, not the API's tolerance.

:::caution[Annotations are hints, not contracts]
The spec is explicit: a malicious server can lie. Clients should treat annotations as UX guidance, not as a security boundary. Your real authorization happens at the backend, not on the strength of `readOnlyHint: true`.
:::

## Structured results with `outputSchema`

The `searchIssues` handler above returns text content with newline-joined results. That works, but it asks the model to parse strings — fragile, and the model occasionally hallucinates fields the text doesn't contain. Worse for evals: a regex-based pass check on `"#42"` will silently keep passing if the rendering changes shape.

The 2025-06-18 spec added `outputSchema` for tools that return structured data. Declare the output shape, return a typed object alongside the text, and clients (and your eval harness) can parse it directly.

```ts
const SearchIssuesOutput = z.object({
  results: z.array(z.object({
    number: z.number(),
    title: z.string(),
    state: z.enum(["open", "closed"]),
    url: z.string().url(),
  })),
  total: z.number(),
  truncated: z.boolean(),
});

export const searchIssues = {
  name: "search_issues",
  description: "...",
  inputSchema: zodToJsonSchema(SearchIssuesInput, { target: "openApi3" }),
  outputSchema: zodToJsonSchema(SearchIssuesOutput, { target: "openApi3" }),
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  handler: instrument("search_issues", async (raw) => {
    const parsed = SearchIssuesInput.safeParse(raw);
    if (!parsed.success) {
      return toolError(ToolErrorCode.InvalidArgs, "Invalid arguments", parsed.error.issues);
    }
    const client = new GithubClient(process.env.GITHUB_TOKEN!);
    const hits = await client.searchIssues(parsed.data);
    const structured = SearchIssuesOutput.parse({
      results: hits.slice(0, parsed.data.limit).map(h => ({
        number: h.number, title: h.title, state: h.state, url: h.html_url,
      })),
      total: hits.length,
      truncated: hits.length > parsed.data.limit,
    });
    return {
      content: [{ type: "text", text: JSON.stringify(structured, null, 2) }],
      structuredContent: structured,
    };
  }),
};
```

Two things changed from the earlier version:

- `outputSchema` is declared alongside `inputSchema`. Same `zod-to-json-schema` derivation; the zod schema stays the single source of truth.
- The handler returns **both** `content` (for older clients that only consume text) and `structuredContent` (the typed object modern clients prefer). Backward-compatible by construction.

The error path is unchanged. The convention is now:

- **Success** → return `structuredContent` (plus a `content` text fallback).
- **Tool-execution error** → return `{ isError: true, content: [...] }` as before. The model reads `code` and recovers.
- **Protocol error** (server crashed, malformed request) → bubbles up as a JSON-RPC error from the SDK, never reaches the tool handler. You don't write code for this case; the SDK handles it.

When to use `outputSchema`:

- **Yes** — any tool returning data the model will reason about, list, or filter. All `search_*`, `read_*`, `list_*` tools. Anything currently returning a stringified table.
- **No** — tools whose entire output is a single human-readable acknowledgement. `close_issue` → "Issue #42 closed" is fine as plain text.
- **Maybe** — write tools. Returning the created entity's structured shape lets the model reference its ID without a follow-up `read_*` call. Worth doing.

Update your starter set: add `outputSchema` to the three read tools and the resource handler this week. The write tools can stay text-only; revisit in Week 3 if eval failures point at parsing.

## Harness v0 (`harness/src/index.ts`)

Keep it under 300 lines — enforced by `scripts/check-line-count.sh`. The goal is a test bench, not a framework. Core loop:

:::caution[300-line ceiling is load-bearing]
The cap exists so the harness stays readable in one sitting. Once it grows past 300 lines, people start treating it as a framework and stop reading it — that's when eval debugging gets painful. If you hit the ceiling, simplify rather than raise it.
:::

```ts
// abbreviated — real file handles errors, prints trace, flags CLI args
import Anthropic from "@anthropic-ai/sdk";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const anthropic = new Anthropic();
const client = new Client({ name: "pathway-harness", version: "0.0.1" }, {});
await client.connect(new StdioClientTransport({ command: "node", args: ["../server/dist/index.js"] }));

const { tools } = await client.listTools();
const anthropicTools = tools.map(t => ({ name: t.name, description: t.description, input_schema: t.inputSchema }));

const messages: Anthropic.MessageParam[] = [{ role: "user", content: process.argv[2] }];
const trace: Array<{ tool: string; args: unknown; ms: number }> = [];

for (let i = 0; i < 10; i++) {                     // hard iteration cap
  const resp = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    tools: anthropicTools,
    messages,
  });
  messages.push({ role: "assistant", content: resp.content });
  if (resp.stop_reason !== "tool_use") {
    for (const c of resp.content) if (c.type === "text") console.log(c.text);
    break;
  }
  const toolUse = resp.content.find((c): c is Anthropic.ToolUseBlock => c.type === "tool_use")!;
  const t0 = performance.now();
  const result = await client.callTool({ name: toolUse.name, arguments: toolUse.input as any });
  trace.push({ tool: toolUse.name, args: toolUse.input, ms: Math.round(performance.now() - t0) });
  messages.push({
    role: "user",
    content: [{ type: "tool_result", tool_use_id: toolUse.id, content: JSON.stringify(result) }],
  });
}

console.log("\n[trace]");
for (const t of trace) console.log(`  ${t.tool}  ${JSON.stringify(t.args)}  (${t.ms}ms)`);
```

This is ~40 lines of core loop. Your full harness file will add argument parsing, prettier output, and a trace printer — but the loop itself should stay this shape.

Check the full trace format in `templates/examples/harness-trace-example.md`.

## Consumer README stub (`server/README.md` in your workbook)

Start a consumer-facing README this week — written for a hypothetical person or agent that wants to connect to your server, not for your future self.

Minimum viable version:

````markdown
# <Your server name>

An MCP server wrapping <backend>. Exposes the following tools and resources.

## Connect

```json
// claude_desktop_config.json
{
  "mcpServers": {
    "<your-server>": {
      "command": "node",
      "args": ["/absolute/path/to/dist/index.js"],
      "env": { "<BACKEND>_TOKEN": "..." }
    }
  }
}
```

## Tools

- **search_issues** — <one-line description>
- ...

## Resources

- **<uri>** — <one-line description>

## Errors

See `src/errors.ts`. All tools return `{ code, message, details }` on failure; `code` is one of six values.
````

This file grows every time the surface changes. In Week 4 you add an HTTP connection section; in Week 6-7 you add an auth section; in Week 8 you add the deployed URL. Treat it like the compose file — a visible, evolving artefact.

## Evolution quality gates

At the end of the week, four tracked artefacts are in their W2 state. Every subsequent week that changes them uses the five-part block (Before / Change / After / Verify / Enables) to make the delta visible. The baselines this week establishes:

| Artefact | W2 baseline |
|---|---|
| Server | 4-6 tools + 1 resource over stdio, zod-validated, pino-logged, `instrument()`-wrapped, annotations + `outputSchema` on read tools |
| Harness | ~40-line tool-use loop over stdio, prints trace |
| Tests | vitest unit + MSW contract tests; all passing |
| Error taxonomy | 6 codes; `{ code, message, details }` shape |
| Consumer README | tools + resources + errors sections |

## What goes in your workbook this week

| Path | What |
|------|------|
| `notes/week-02-tool-design.md` | Your tool + resource design rationale |
| `server/` | Filled-in scaffold: tools, resource, instrument, errors, tests |
| `server/README.md` | Consumer README stub |
| `harness/` | Filled-in harness, working end-to-end |
| `progress.md` | Appended entries per session |

## Checkpoint — you've completed Week 2 when

- [ ] Server boots clean with no warnings
- [ ] All 4-6 tools and 1 resource work through Inspector
- [ ] Server registered with Claude Desktop (or exercised through Inspector on Linux) and used in real conversation
- [ ] Harness v0 runs against the server end-to-end
- [ ] Every tool call emits a structured log line via `instrument()`
- [ ] `npm test` passes in `server/` with unit + MSW contract tests for every tool
- [ ] Error taxonomy (6 codes) is used consistently across tools
- [ ] Tool annotations (`readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`) set correctly on every tool
- [ ] `outputSchema` + `structuredContent` on every read tool (`search_*`, `read_*`, `list_*`)
- [ ] Consumer README stub committed with tools, resource, errors sections
- [ ] Tool-design note committed
- [ ] `bash scripts/check-line-count.sh` passes (harness under 300 lines)
- [ ] `git tag week-2-complete` on your workbook

## Leadership lens

Tool design is the new API design, and most organisations have 15 years of REST muscle memory that hurts them here. REST APIs have consumers who read docs, use autocomplete, and debug with Postman. Your MCP tools' consumer is an LLM that reads only names and descriptions. It won't retry sensibly. It will just call the wrong tool. If your team can't articulate why a tool is named what it's named, that's where their agent reliability problem lives.

## Common pitfalls

:::danger[The five ways Week 2 goes wrong]
- **Starting with the implementation.** Write the definitions first.
- **Making a generic `query` tool.** Split it — generic names mean random selection.
- **Returning stack traces as errors.** Use the six-code taxonomy; the model can reason about codes, not traces.
- **Skipping the resource.** It's not decorative; it's a protocol primitive. Graduates who've never built one have a credibility gap.
- **Testing only one prompt.** Test ambiguous prompts, test prompts that should match nothing.
- **Lying with annotations.** Marking a write tool `readOnlyHint: true` because "the client UX is nicer" trains the wrong instinct. Annotations describe behaviour, not the UX you wish you had.
- **Skipping `outputSchema` on read tools.** You'll write regex-based eval checks against rendered text, the rendering will change, and your evals will silently pass on broken output.
:::

## Optional rabbit holes

- Read one production MCP server's source (`@modelcontextprotocol/servers`). Observe naming patterns.
- Try Cloudflare's `agents` SDK for comparison; you'll meet it in Phase 4 anyway.
- Experiment with resource templates if your backend's URIs lend themselves to it (e.g., `github://repos/{owner}/{repo}/issues/{number}`).
- Skim MCP's `prompts`, `sampling`, and `elicitation` primitives. You'll build with them in Week 5.
