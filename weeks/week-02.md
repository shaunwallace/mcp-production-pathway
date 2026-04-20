# Week 2 — Build your first server (Phase 1, part 1)

**Time budget:** 6 to 10 hours across three or four sittings.

## What you'll have by the end of the week

- A working MCP server exposing 4-6 tools against a real backend
- A minimal agent harness that drives the server end-to-end through Claude
- Structured logs emitted per tool call
- First-draft tool definitions committed, with a clear rationale in git

## Why this week exists

Most MCP servers fail not at the protocol layer, where the SDKs handle most of the work, but at the tool-design layer, which SDKs can't help with. By building a small server against a real third-party backend of your choice, you're forced to confront the real questions: naming, granularity, error shape, idempotency. These are skills that carry for the rest of the pathway.

## Reading list

1. **MCP TypeScript SDK README and examples.** (~45min) Skim first, run one example, then re-read.
   → <https://github.com/modelcontextprotocol/typescript-sdk>
2. **MCP Inspector.** (~20min) You'll use this all week for eyeballing tool shapes.
   → <https://github.com/modelcontextprotocol/inspector>
3. **Anthropic's "Building effective agents," the tool-design sections specifically** (Dec 2024). (~20min) Particularly the descriptions-over-schemas point.
   → <https://www.anthropic.com/research/building-effective-agents>
4. **Claude Desktop user quickstart.** (~10min) Confirms where `claude_desktop_config.json` lives on your OS so you can register your server.
   → <https://modelcontextprotocol.io/quickstart/user>
5. **A tool-design critique piece.** (~30min) Search Simon Willison's MCP tag for a post about tool-name selection, tool bloat, or overlapping tools — the top failure modes.
   → <https://simonwillison.net/tags/model-context-protocol/>

## Setup checklist

Work through this before you write any code. Should take 30-60 minutes.

- [ ] Node 20+ (`node --version`)
- [ ] Package manager of choice (pnpm recommended for monorepo feel)
- [ ] Anthropic API key in `~/.zshrc` or `.env`
- [ ] Backend credentials for your chosen Week 2 backend, plus a few seeded test items to exercise your tools against. `weeks/week-00-setup.md` has a criteria-based menu with setup time estimates — if you haven't picked yet, pick now. GitHub is a reasonable default if you have no strong preference.
- [ ] Claude Desktop installed, so you can manually test the server through the canonical host. Config file path:
  - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
  - Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- [ ] MCP Inspector installed: `npx @modelcontextprotocol/inspector` works without install
- [ ] Your workbook repo cloned locally

## The backend choice

You picked a backend in Week 1 (committed to `decisions/0001-sdk-and-backend-choice.md`). If you haven't, go back to `weeks/week-00-setup.md` for the criteria and menu, pick now, and record the decision as an ADR before writing code. Not picking deliberately is a common reason Week 2 drifts.

The specific examples below use GitHub-shaped tool names (`search_issues`, `create_issue`, …) because GitHub is the most universal default. If you picked a different backend, the shape of the work is identical — substitute your backend's primitives for the example names.

## Exercise: design 4-6 tools

This is the core work of the week. Before you write any implementation code, design the tool surface.

Constraints:

- **4 to 6 tools.** More than six is almost always wrong in a first pass; fewer than four doesn't exercise the design space.
- **At least one read tool, at least one write tool.** Reads are easier; writes force you to think about idempotency and error handling.
- **No tool may overlap meaningfully with another.** If two tools could plausibly be picked for the same query, one of them is wrong.
- **Every tool must have a verb-noun or verb-object name.** Generic names like `query`, `get`, `run`, or `do` are disqualifying.

Suggested starter sets (pick the row that matches your backend, then adjust to taste — these are starting points, not prescriptions):

| Backend | Read tools | Write tools |
|---------|-----------|-------------|
| GitHub | `search_issues`, `read_issue`, `list_pull_requests` | `create_issue`, `comment_on_issue`, `close_issue` |
| Linear | `search_issues`, `read_issue`, `list_project_issues` | `create_issue`, `comment_on_issue`, `update_issue_status` |
| Notion | `search_pages`, `read_page`, `list_database_entries` | `create_page`, `append_to_page`, `comment_on_page` |
| Todoist | `search_tasks`, `read_task`, `list_project_tasks` | `create_task`, `comment_on_task`, `complete_task` |
| Trello | `search_cards`, `read_card`, `list_board_cards` | `create_card`, `comment_on_card`, `move_card_to_list` |

Notice the structural similarity: one search, one read-by-id, one list-by-container, plus a create / a comment / a state-change. The underlying tool-design principles are the same; only the nouns change.

Write the tool definitions first, in a file at `server/src/tools/definitions.ts`. For each tool, write the name, description, and JSON schema for inputs. No implementation yet.

Then write a short tool-design note in your workbook at `notes/week-02-tool-design.md`: why these tools, why these names, what you considered and rejected.

## Implementation

Now fill in the server scaffold at `server/`. The scaffold has a hello-world tool to get you started. See `server/README.md` for the scaffold brief and the TODOs.

Test each tool through Inspector before moving on. Don't wait until everything is built to test anything.

When all tools work through Inspector, register the server with Claude Desktop and exercise it through real conversation.

## Instrumentation (baseline)

Every tool call emits one structured JSON log line. Use `pino` or similar. Shape:

```json
{
  "ts": "2026-05-11T14:32:11.000Z",
  "session_id": "sess_abc123",
  "tool": "search_issues",
  "args_hash": "9f2a...",
  "duration_ms": 234,
  "outcome": "ok",
  "error_class": null
}
```

Implement as middleware that wraps every tool handler. This becomes Phase 4's OpenTelemetry starting point; get the shape right now.

## Harness v0

Fill in the harness scaffold at `harness/`. See `harness/README.md` for the brief.

Minimum viable harness: CLI that accepts a prompt, connects to your MCP server over stdio, runs an Anthropic tool-use loop to completion, and prints both the final response and a trace of which tools were selected with what arguments. Keep under 300 lines.

The 300-line ceiling is enforced by `scripts/check-line-count.sh` — run it before tagging `week-2-complete`. If you're over, simplify; the limit is there to keep the harness a test bench, not a framework.

You'll extend this in every subsequent week. Structure accordingly.

### What healthy harness output looks like

See `templates/examples/harness-trace-example.md` for fuller samples, but the minimum shape for a single-prompt run:

```
$ harness "find the auth migration issue and summarise the open blockers"

[trace]
  tool=search_issues   args={query:"auth migration"}           → 3 hits     (312ms)
  tool=read_issue      args={issue_number:142}                 → 2.1KB      (187ms)
---
Issue #142 ("Migrate to OAuth 2.1") has three open blockers:

1. Vendor delivery on the identity provider is three weeks behind plan.
2. The billing refactor must land first; it's blocking two dependent tickets.
3. The rollback path isn't agreed — the team is debating feature-flag vs
   blue/green.

The billing dependency is the most material because it blocks two other
workstreams, not just this one.
---
2 tool calls, 499ms total
```

Read your own output critically. If a call took 3 seconds, flag it. If args look wrong, flag it. The trace is where tool-selection bugs announce themselves.

## What goes in your workbook this week

| Path | What |
|------|------|
| `notes/week-02-tool-design.md` | Your tool design rationale |
| `server/` | Filled-in server scaffold, 4-6 working tools |
| `harness/` | Filled-in harness scaffold, working end-to-end |
| `progress.md` | Appended entries per session |

## Checkpoint — you've completed Week 2 when

- [ ] Server boots clean with no warnings
- [ ] All 4-6 tools work through Inspector
- [ ] Server is registered with Claude Desktop and you've exercised it in real conversation
- [ ] Harness v0 runs against the server with at least one scripted prompt, end-to-end
- [ ] Every tool call emits a structured log line
- [ ] A tool-design note is committed, explaining your design choices
- [ ] `bash scripts/check-line-count.sh` passes (harness under 300 lines)
- [ ] `git tag week-2-complete` on your workbook

## Leadership lens

Tool design is the new API design, and most organisations have 15 years of REST muscle memory that hurts them here. REST APIs have consumers who read docs, use autocomplete, and debug with Postman. Your MCP tools' consumer is an LLM that reads only names and descriptions. It won't retry. It won't escalate. It will just call the wrong tool.

As a leader, the thing to notice: if your team is shipping MCP servers and can't articulate why a tool is named what it's named, that's where their agent reliability problem lives. Bring this conversation into design reviews now, before someone ships `get_stuff` to production.

## Common pitfalls

- **Starting with the implementation.** Write the definitions first. The implementation is the easy part.
- **Making a generic `query` tool.** Split it. The model picks by name, and a generic name means random selection.
- **Returning stack traces as errors.** Return structured errors with a `code` and a human-readable `message` the model can reason about.
- **Forgetting resources.** Some data is better exposed as a resource than a tool. Reread the spec's resources section if you're unsure.
- **Testing only with one prompt.** Test with ambiguous prompts. Test with prompts that should not match any tool. Watch what the model does.

## Optional rabbit holes

- Read one production MCP server's source (the `@modelcontextprotocol/servers` GitHub org). Notice patterns.
- Try Cloudflare's `agents` SDK for comparison; you'll meet it in Phase 4 anyway.
- Experiment with MCP resource templates if your backend's URIs lend themselves to it (e.g., GitHub's `repo/issues/123` or Notion's page URLs).
