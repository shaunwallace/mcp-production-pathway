# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

A public **GitHub template repository** — the "textbook" half of a 12-week MCP (Model Context Protocol) learning pathway. Learners template-instantiate it into a private "workbook" repo where they fill in the scaffolds. See `REPO-ARCHITECTURE.md` for the split and `PATHWAY.md` for the artefact-dependency map across the 12 weeks.

Implication: edits here should preserve the template's pristine state. `weeks/` and `templates/` are read-only curriculum in a learner's workbook. `server/` and `harness/` are deliberately-empty scaffolds with `TODO(week-N)` markers — don't "helpfully" implement them unless asked. The point is that the learner does that work.

The pathway is **released iteratively**. Weeks 1-3 are published; weeks 4-12 are outlined in `README.md` but not yet written. Don't scaffold unpublished weeks.

## Files that orient the work

- `README.md` — entry point and the 12-week outline.
- `REPO-ARCHITECTURE.md` — textbook/workbook split, git conventions.
- `PATHWAY.md` — artefact-dependency map. Which week's outputs feed which later week.
- `weeks/week-00-setup.md` — prerequisites walkthrough (API keys, backend choice menu, Claude Desktop, Node). The Week 2 backend is an explicit choice with a criteria-based menu — GitHub is the "no strong preference" default but the pathway does not prescribe one.
- `weeks/week-01.md` through `week-03.md` — the published curriculum.
- `templates/memo.md`, `adr.md`, `progress-entry.md` — blank templates.
- `templates/examples/` — worked examples (two memo variants, an ADR, an iteration log, harness traces). Reference material for a learner who is stuck and wants to see the shape of a good artefact.
- `docs/model-ids.md` — pinned Claude model IDs. Single place to bump when models rotate.
- `scripts/check-line-count.sh` — enforces the 300-line ceiling on the harness. Referenced from Week 2's checkpoint.

## Project layout and build

Two independent npm projects, no root workspace. Each has its own `package.json`, `tsconfig.json`, and is built/run from its own directory:

```bash
# Server (MCP server over stdio)
cd server && npm install && npm run dev        # tsx src/index.ts
cd server && npm run build && npm start        # tsc → node dist/index.js

# Harness (Anthropic tool-use loop driving the server)
cd harness && npm install
export ANTHROPIC_API_KEY=sk-ant-...
cd harness && npm run dev -- "prompt text"
```

Node 20+, TypeScript, ESM (`"type": "module"`). Because it's ESM, relative imports inside `src/` use the `.js` suffix even though the files are `.ts` (e.g. `import { registerTools } from "./tools/index.js"`). Preserve this.

No test runner is wired up. The regression guard is the harness's eval mode (Week 3 TODO); it loads a JSONL of cases and asserts which tool the model picks.

Debug the server with the MCP Inspector: `npx @modelcontextprotocol/inspector npm run dev` (from `server/`).

## Architecture

### Server (`server/src/`)

- `index.ts` boots an `@modelcontextprotocol/sdk` `Server` over `StdioServerTransport` and calls `registerTools(server)`.
- `tools/index.ts` is the registry. It holds a `tools` array and wires both `ListToolsRequestSchema` and `CallToolRequestSchema` handlers off it. New tools are added by importing them here and pushing into the array — one file per tool.
- Each tool is an object `{ name, description, inputSchema, handler }`. The handler **must** be wrapped with `instrument(toolName, fn)` from `instrumentation.ts`. That wrapper is the single point where structured log lines (`event: tool_call`, tool name, SHA-256 args hash, duration, outcome) are emitted. Phase 4 upgrades this to OpenTelemetry spans; preserving the wrapper pattern keeps that upgrade mechanical.
- Args are validated with `zod` inside the handler. `inputSchema` is hand-written JSON Schema (what MCP/Anthropic need); the `zod` schema is what the handler parses against. They describe the same shape but aren't auto-generated from each other — if you change one, change the other.
- The scaffold deliberately omits auth, HTTP transport, OpenTelemetry, and multi-tenancy. Those are added in later phases. Don't introduce them pre-emptively.

### Harness (`harness/src/index.ts`)

Single file, ~300 lines max by design — it's a test bench, not a framework. Flow: `parseArgs` → `connectToServer` (spawns the server as a subprocess via `StdioClientTransport`) → `listTools` (maps MCP tool shape to Anthropic's `Tool` shape) → `runAgentLoop` (Anthropic messages API with `tools`, loops on `stop_reason === "tool_use"`, feeds results back, bounded iteration cap) → print final message + tool-call trace. Week 3 adds an `--eval` mode that reads JSONL cases and reports pass/fail on expected-tool selection.

## Conventions that matter here

- **Tool naming is the API.** Descriptions are prompts for the model, not docs — write "Use this when…" not "This tool does…". See `server/README.md` for the full rationale; this is load-bearing for eval results.
- **Narrative commit messages.** First person, past tense, specific (e.g. "Renamed `query` to `search_documents` after harness showed 4/12 tool-selection failures"). Checkpoint tags at week/phase boundaries: `week-2-complete`, `phase-1-complete`.
- **ADRs before architectural changes** (stored in `decisions/` in a workbook, using `templates/adr.md`). The commit that introduces the change references the ADR.
- `evals/results/` is gitignored — eval output stays local to a workbook.
