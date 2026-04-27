---
title: Server scaffold
description: Brief and TODOs for the MCP server scaffold in server/.
---

# Server scaffold

This is the starter project for your MCP server. The scaffold boots cleanly and exposes a single hello-world tool so you have something that runs from commit zero. Your job across Phase 1 (Weeks 2-3) is to design and implement 4-6 real tools against your chosen backend.

## What's in here

```
server/
├── package.json         # minimal deps: @modelcontextprotocol/sdk, pino
├── tsconfig.json
├── src/
│   ├── index.ts         # server bootstrap + stdio transport
│   ├── instrumentation.ts  # structured logging middleware
│   └── tools/
│       ├── index.ts     # tool registry
│       └── hello.ts     # starter hello-world tool
```

## Getting it running

```bash
cd server
npm install
npm run dev
```

The server will listen on stdio. Connect the MCP Inspector:

```bash
npx @modelcontextprotocol/inspector npm run dev
```

You should see the `hello` tool listed. Invoke it and confirm you get a response and a log line.

## TODOs you'll work through in Weeks 2-3

Search the codebase for `TODO(week-2)` and `TODO(week-3)` for inline guidance. The high-level work:

- [ ] **Week 2:** Replace `hello` with your 4-6 designed tools. One file per tool in `src/tools/`.
- [ ] **Week 2:** Each tool must emit a structured log line via the instrumentation middleware.
- [ ] **Week 2:** Write thoughtful JSON schemas for tool inputs. The descriptions matter as much as the types.
- [ ] **Week 2:** Set tool annotations (`readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`) so clients can render correct UX.
- [ ] **Week 2:** Declare an `outputSchema` and return `structuredContent` for every read tool — text-only results fool eval regexes.
- [ ] **Week 2:** Return structured errors (with `code` and `message`) rather than throwing raw exceptions.
- [ ] **Week 3:** Add one read tool and one write tool at minimum; idempotency matters for writes.
- [ ] **Week 3:** Consider which data should be a `resource` rather than a `tool`.

## Design principles to hold yourself to

- **Names are the API.** `search_pages` beats `query` every time. `list_database_entries` beats `get`.
- **Descriptions are prompts for the model.** Write them as instructions, not docs: "Use this when..." is stronger than "This tool does..."
- **Error messages are the model's recovery path.** "Not found: page ID `abc123`" is recoverable; a stack trace is not.
- **Idempotency matters for writes.** If the model calls your `create_page` tool twice, do you create two pages? What should happen?

## When you know a tool is well-designed

The MCP Inspector is the first test. The real test is the harness: run the harness with a prompt that should invoke your tool, and watch which one the model picks. If the model picks the wrong tool, the tool's name or description is wrong.

## What this scaffold deliberately doesn't do

- **Auth.** Added in Phase 3. stdio is trusted-local for now.
- **HTTP transport.** Added in Phase 2. Start simple.
- **OpenTelemetry.** Added in Phase 4. Structured logs first.
- **Multi-tenancy.** Added in Phase 6.

Keep it simple. The scaffold is minimal on purpose.
