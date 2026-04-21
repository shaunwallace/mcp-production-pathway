---
title: Week 0 — Setup and prerequisites
---

# Week 0 — Setup and prerequisites

**Time budget:** 30 to 60 minutes, once.

This is a one-shot setup guide. Do it before Week 1. Everything here is a dependency that will stall you later if it's missing.

## Accounts and keys

### Anthropic API key

1. Sign up at <https://console.anthropic.com/>.
2. Create an API key from the API Keys section.
3. **Set a monthly spend limit** in the Billing section before you use it. $10-20 is enough for the early weeks; bump later if eval runs push you over. This is the cheapest protection against a runaway harness loop.
4. Export the key in your shell profile so the harness picks it up:

   ```bash
   # in ~/.zshrc or ~/.bashrc
   export ANTHROPIC_API_KEY=sk-ant-...
   ```

### GitHub account

You'll need one to template-instantiate the public pathway repo into your private workbook. Free tier is fine.

### Pick a Week 2 backend

Week 2 has you build a server exposing 4-6 tools against a real third-party API. The backend choice is yours — the pathway doesn't prescribe one. But it does matter enough to think about for 15 minutes, because an ill-fitting backend will distort the Week 2 lessons.

**Criteria for a good Week 2 backend:**

1. **Has both reads and writes.** Writes force you to confront idempotency and error shapes. Read-only backends are too easy.
2. **At least 4 distinct primitives** worth exposing as tools — not just "get/set a thing."
3. **Real API friction**: actual rate limits, pagination, and HTTP error shapes. Your own local database is too clean and won't teach you what production feels like.
4. **Achievable setup**: under 20 minutes from nothing to a working API call.
5. **Something you'd plausibly use for real.** Picking a backend you have no interest in produces flabby tool names, because the design pressure isn't real.

**A menu that fits:**

| Backend | Read/write primitives | Setup time | Notes |
|---------|-----------------------|------------|-------|
| **GitHub** | issues, comments, PRs, file contents, repos | ~5 min | Universal account ownership. Rate limits are real and instructive. A reference server exists in `@modelcontextprotocol/servers` — self-impose a rule not to look at it until you've shipped your own design. |
| **Linear** | issues, comments, projects, cycles | ~10 min | Clean, small API. Good if you already use it for work. |
| **Todoist / TickTick / Things Cloud** | tasks, projects, labels, comments | ~10 min | Personal productivity tools with clean APIs. Good if you already live in one. |
| **Trello** | boards, lists, cards, checklists, comments | ~10 min | Classic kanban model; primitives map cleanly to tools. |
| **Notion** | pages, databases, blocks, comments | ~15 min | Well-documented; setup has one easy-to-miss step (sharing pages with the internal integration). See the Notion-specific notes below. |
| **Raindrop.io or Readwise** | bookmarks, highlights, tags | ~10 min | Read-heavy; lighter on writes. Good for a research or knowledge-management angle. |
| **Home Assistant** | device states, automations, sensor reads | ~30 min | Interesting precisely *because* some operations are destructive (turning off heating). Only if you already have it running. |

**If you have no strong preference, pick GitHub.** It has the universal-account advantage, the API is mature and boring in the good sense, and the primitives (issues, comments, PRs) map to a clean 4-6 tool surface. The only discipline required: don't open the `@modelcontextprotocol/servers/github` reference until after you've shipped your own Week 2 design.

**What not to pick:**

- **Your own local database or filesystem.** Too clean. No rate limits, no pagination, no unexpected 4xx shapes. You'll miss the API-shape friction that is half the point of Week 2.
- **A read-only public API** (Hacker News, weather, Wikipedia). Week 2 specifically requires at least one write tool.
- **A backend you've never touched.** Domain uncertainty stacked on top of tool-design uncertainty is too much for one week.

### Setting up your chosen backend

Whatever you pick, the steps are broadly the same:

1. Create the credentials the API requires (personal access token, API key, or integration token). Store in your workbook's `.env` file (gitignored) as something like `GITHUB_TOKEN=...` or `LINEAR_API_KEY=...`.
2. Give the credential enough scope for the primitives you plan to expose — but no more. Overly permissive tokens are a Phase 6 mistake you can avoid today.
3. Seed the backend with 5-10 realistic test items (issues, cards, pages, tasks, whatever applies). You'll exercise your tools against these in Week 2, and an empty backend hides tool-design bugs.
4. Make one successful API call from the terminal with `curl` or `httpie` before you write any server code. This rules out auth problems later, when they'd be tangled up with your server code.

### Notion-specific notes (if you picked Notion)

Notion has one non-obvious step that deserves calling out because it's the most common reason Week 2 stalls:

1. Go to <https://www.notion.so/my-integrations>, create an **internal integration**. (Public integrations go through OAuth and are a Phase 3 concern.)
2. Copy the integration token (starts with `secret_` or `ntn_`). Save to `.env` as `NOTION_API_KEY=...`.
3. **Critical step:** the integration has no access to any pages by default. For each test page you want accessible, open it, click the top-right menu → **Connections → add your integration → Confirm**. Child pages inherit. Without this step every API call returns a confusing 404.
4. Populate 3-5 test pages and one small database.

## Runtimes and CLI tools

### Node 20+

```bash
node --version   # should print v20.x.x or higher
```

If lower, install the current LTS from <https://nodejs.org/> or via `nvm`/`fnm`/`volta`.

### Package manager

`npm` comes with Node. `pnpm` is a reasonable alternative if you already use it. The scaffolds don't care; pick one and stick with it.

### Claude Desktop (for Week 2 manual testing)

Download from <https://claude.ai/download>. Available for macOS and Windows.

Config file path (you'll edit this in Week 2 to register your server):

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

Linux users: Claude Desktop doesn't ship a Linux build at time of writing. You can still complete Phases 0-2 using only the MCP Inspector and the harness — Claude Desktop registration is helpful but not strictly required until Phase 3. Check the Claude Desktop download page for any changes since.

### MCP Inspector

No install needed. Runs via `npx`:

```bash
npx @modelcontextprotocol/inspector
```

Run it once now against no server just to confirm the package pulls and the UI opens. Canonical source: <https://github.com/modelcontextprotocol/inspector>.

## Your workbook repo

Don't do your work in *this* repo. This is the public pathway template; the work goes in a private workbook that you template-instantiate from it. Three steps:

1. In the GitHub UI for the pathway repo, click **Use this template → Create a new repository**.
2. Name it something personal (e.g. `mcp-workbook`), set **Private**.
3. Clone locally and bootstrap:

   ```bash
   git clone git@github.com:you/mcp-workbook.git
   cd mcp-workbook
   touch progress.md
   mkdir -p notes memos decisions evals runbooks
   git add .
   git commit -m "Initialise workbook from pathway template"
   git tag week-0-start
   ```

`REPO-ARCHITECTURE.md` explains the full textbook-workbook pattern.

## Smoke test

Before you start Week 1, confirm the scaffolds run in your workbook:

```bash
# In your workbook, not this repo
cd server && npm install && npm run dev
# should print: {"level":"info","event":"server_started","transport":"stdio",...}
# Ctrl-C to stop.

cd ../harness && npm install
# (Can't smoke-test the harness end-to-end yet — that's Week 2 work.)
```

If anything fails here, fix it now. Week 1 is reading-heavy and nothing you do will surface build issues; you'll only find them when you try to implement in Week 2, and they'll eat time you'd rather spend on tool design.

## Now you're ready

Open `weeks/week-01.md`.
