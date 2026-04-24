---
title: Week 3 — Iterate, measure, CI (Phase 1, part 2)
---

# Week 3 — Iterate, measure, CI (Phase 1, part 2)

**Time budget:** 8 to 12 hours across three or four sittings.

## What you'll have by the end of the week

- A first eval dataset covering representative user queries against your server
- A harness `--eval` mode that reports pass/fail by tool selection and flags empty-success
- At least two documented tool-design iterations with before/after numbers
- GitHub Actions CI running `npm test` and the eval suite on every PR
- Dependabot (or Renovate) configured so dependency drift doesn't accumulate
- An iteration findings note closing out Phase 1 (short, not a memo)
- Phase 1 closed and ready for Phase 2

## Why this week exists

Last week you built the server. This week you subject it to honest evaluation, then wire that evaluation into CI so regressions surface automatically. The distinction matters: in Week 2 you proved the plumbing works. In Week 3 you measure whether the tool design is any good, and you make sure future changes can't silently break it. Most teams stop at Week 2 and ship, which is why so many production MCP servers underperform.

Pulling CI forward from the original Week 10 position is deliberate. Evals without CI are good intentions. Evals in CI are a regression guard that holds for the rest of the pathway.

## Reading list

1. **Hamel Husain, "Your AI product needs evals"** (Mar 2024). (~30min) Foundational.
   → <https://hamel.dev/blog/posts/evals/>
2. **Eugene Yan, "Evaluating the effectiveness of LLM-Evaluators"** (Aug 2024). (~30min) Skim his recent index too.
   → <https://eugeneyan.com/writing/llm-evaluators/>
3. **One practitioner post on tool-selection evaluation.** (~30min) Simon Willison's MCP tag, or the Anthropic cookbook.
   → <https://simonwillison.net/tags/model-context-protocol/>
   → <https://github.com/anthropics/anthropic-cookbook>
4. **Revisit the MCP spec's error handling and structured output sections.** (~15min) You'll tune both this week.
   → <https://modelcontextprotocol.io/specification>

## The iteration loop

1. **Write a first eval set.** 12-20 representative prompts, each tagged with the expected tool (or `none`).
2. **Run the harness against the eval set.** Record which tool the model selected, with what arguments, and whether the selection matched.
3. **Identify failure modes.** Wrong tool? Malformed args? Empty-success (the tool "succeeded" but returned content the model treated as useful when it wasn't)?
4. **Make one focused change.** Rename a tool, sharpen a description, split a tool, improve an error message.
5. **Rerun the eval.** Record the delta.
6. **Commit with a narrative message.** "Renamed `query` to `search_pages` after 4/12 eval failures showed the model confused it with `list_database_entries`; post-rename pass rate moved from 8/12 to 11/12."

Iterate at least twice. Three or four times if you have the energy.

### When to stop iterating

Iteration without a stop condition is how Week 3 eats Week 4:

- **Stop when pass rate ≥ 85%**, OR
- **Stop after 4 iterations**, OR
- **Stop at the first plateau**: two consecutive iterations with no movement means the problem is structural, not naming.

A plateau is a finding, not a failure. Write it up.

## Eval dataset shape

Create at `evals/phase-1-tool-selection.jsonl`. Examples use GitHub-shape tool names; substitute your backend's primitives.

```json
{"id": "ts-001", "prompt": "find the issue about the auth migration", "expected_tool": "search_issues", "expected_args_shape": {"query": "string", "repo": "string"}}
{"id": "ts-002", "prompt": "what PRs are open in the pathway repo", "expected_tool": "list_pull_requests", "expected_args_shape": {"repo": "string"}}
{"id": "ts-003", "prompt": "add a comment to issue #42 saying we're delayed", "expected_tool": "comment_on_issue", "expected_args_shape": {"issue_number": "integer", "body": "string"}}
```

Coverage targets:

- **Clear-intent cases** (~50%): the right tool is obvious
- **Ambiguous cases** (~30%): the right tool is defensible but not obvious; this is where naming matters
- **No-tool cases** (~10%): nothing should match; the model should say so
- **Multi-step cases** (~10%): two or more tool calls in sequence

## Harness extension: `--eval` mode

Extend the harness with an eval mode. Keep the core loop untouched; add a runner that drives the loop once per case.

```ts
// harness/src/eval.ts — abbreviated
import { readFileSync } from "node:fs";

export async function runEval(path: string, runCase: (prompt: string) => Promise<RunResult>) {
  const cases = readFileSync(path, "utf8").trim().split("\n").map(l => JSON.parse(l));
  const results = [];
  for (const c of cases) {
    const { toolsCalled, finalText, totalMs } = await runCase(c.prompt);
    const firstTool = toolsCalled[0]?.name ?? "(none)";
    const expected = c.expected_tool ?? "(none)";
    const pass = firstTool === expected && !looksLikeEmptySuccess(finalText, toolsCalled);
    results.push({ id: c.id, prompt: c.prompt, expected, actual: firstTool, pass, ms: totalMs });
  }
  return results;
}

function looksLikeEmptySuccess(finalText: string, toolsCalled: Array<{ name: string; result: any }>): boolean {
  // A tool returned no isError flag but the model's final text admits it couldn't help.
  const gaveUp = /I (couldn't|was unable to|don't have)/i.test(finalText);
  const anyToolCalled = toolsCalled.length > 0;
  return gaveUp && anyToolCalled;
}
```

The `looksLikeEmptySuccess` heuristic is deliberately simple. It catches the common case: the tool technically succeeded, but the model's final answer admits defeat. You'll tune the regex as you encounter real false positives.

CLI:

```bash
$ harness --eval evals/phase-1-tool-selection.jsonl

id      prompt (truncated)                                  expected            actual              pass  lat(ms)
------  --------------------------------------------------  ------------------  ------------------  ----  -------
ts-001  find the issue about the auth migration             search_issues       search_issues       ✓     284
ts-002  what PRs are open in the pathway repo               list_pull_requests  list_pull_requests  ✓     412
ts-003  add a comment to issue #42 saying we're delayed     comment_on_issue    create_issue        ✗     301
ts-004  delete last week's bug report                       (none)              (none)              ✓     —
...

11/12 pass (91.7%). See evals/results/2026-05-18-1422.json for full traces.

Failures:
  ts-003: expected=comment_on_issue actual=create_issue
    → model treated "add a comment" as "create a new thing"; tighten
      create_issue's description to exclude comment-like intent.
```

See `templates/examples/harness-trace-example.md` for a longer sample.

## Evolution gates

Three artefacts change this week. Each uses the five-part block.

### Evolution: harness

**Before (end of W2):** tool-use loop over stdio, prints trace.
**Change:** add `src/eval.ts`, `--eval <path>` CLI flag, `looksLikeEmptySuccess` heuristic.
**After:** harness can run either a single prompt or a full eval file; prints a pass/fail table and writes full traces to `evals/results/`.
**Verify:**
```
$ harness --eval evals/phase-1-tool-selection.jsonl
11/12 pass (91.7%). See evals/results/...
```
**Enables:** the eval baseline you set here becomes the regression guard you rerun in W4 (HTTP transport), W7 (under auth), W9 (under tracing), W11 (under load), W12 (with adversarial prompts).

### Evolution: CI workflow

**Before (end of W2):** nothing — tests run locally only.
**Change:** add `.github/workflows/ci.yml` running `npm test` in `server/` and `harness/`, plus `npm run eval` against the phase-1 JSONL. Add `.github/dependabot.yml` for weekly updates on `server/`, `harness/`, and GitHub Actions.
**After:** every PR runs unit tests, contract tests, and the eval suite. Dependency PRs arrive automatically.
**Verify:**
```
$ git push origin iteration-1
# GitHub Actions runs; PR shows green check:
# ✓ CI / server-tests
# ✓ CI / harness-tests
# ✓ CI / evals (11/12 pass)
```
**Enables:** every later artefact change (HTTP port in W4, auth in W6-7, caching in W10) will fail CI if it regresses evals. Without this wiring, regressions creep in silently.

Canonical workflow shape (`.github/workflows/ci.yml`):

```yaml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "22", cache: "npm" }
      - name: Server tests
        working-directory: server
        run: npm ci && npm run build && npm test
      - name: Harness tests
        working-directory: harness
        run: npm ci && npm run build
      - name: Evals
        working-directory: harness
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          GITHUB_TOKEN_FOR_BACKEND: ${{ secrets.GITHUB_TOKEN_FOR_BACKEND }}
        run: npm run eval -- ../evals/phase-1-tool-selection.jsonl
```

Store the Anthropic key and any backend tokens as repo secrets. The eval job is the one that costs money; if you want to throttle cost, gate it to PRs into `main` only.

### Evolution: eval dataset

**Before (end of W2):** did not exist.
**Change:** create `evals/phase-1-tool-selection.jsonl` with 12-20 cases across four coverage categories.
**After:** a JSONL baseline committed alongside the server build that produced it.
**Verify:** the first run establishes a pass rate; subsequent runs must match or beat it.
**Enables:** every transport, auth, caching, or cost change from W4 onward is measured against this set.

## Documenting the iteration

Keep an iteration log at `notes/week-03-iterations.md`. One entry per rename or redesign. See `templates/examples/iteration-log-example.md`.

```markdown
## Iteration 1 — 2026-05-18

**Change:** Renamed `query` → `search_issues`. Sharpened description from "search the repo" to "Full-text search across all issues (open and closed) in the configured repo. Use when the user is looking for an issue by topic, title, or body text but doesn't have the issue number."

**Eval pass rate:** 8/12 → 11/12

**Failure analysis:** The remaining miss was ts-009 ("find the flaky test") where the model invoked `list_pull_requests` instead. Root cause: ambiguity between "issues" and "PRs" in a user mental model. Not fixing this week.
```

## Phase 1 findings note (replaces the memo)

Under the revised pathway there are only three memos total (Phase 0, Phase 3, Phase 6). Close Phase 1 with a shorter findings note at `notes/phase-1-findings.md` — 300 words, committed alongside your eval results.

Structure:

- **What the eval baseline is.** Pass rate, coverage mix, which prompts are hardest.
- **The two most instructive iterations.** What you changed, what moved.
- **One thing you chose not to fix.** Why a plateau or a known failure is deferred.
- **What Phase 2 needs to be careful of.** The thing about your current design that HTTP, sessions, or auth will stress.

The note becomes forward-reference context for every subsequent phase's rerun of the eval set.

## What goes in your workbook this week

| Path | What |
|------|------|
| `evals/phase-1-tool-selection.jsonl` | Your eval dataset |
| `evals/results/` | Result JSON per run (gitignored by default) |
| `harness/` | Extended with `--eval` mode + empty-success detection |
| `.github/workflows/ci.yml` | CI pipeline |
| `.github/dependabot.yml` | Dependency drift guard |
| `notes/week-03-iterations.md` | Iteration log with before/after numbers |
| `notes/phase-1-findings.md` | Closing note |
| `progress.md` | Appended entries per session |

## Checkpoint — you've completed Week 3 when

- [ ] `evals/phase-1-tool-selection.jsonl` has 12+ cases across four coverage categories
- [ ] Harness runs the eval dataset and reports pass/fail + empty-success
- [ ] At least two documented iterations with before/after pass rates
- [ ] GitHub Actions CI is green on the latest commit to `main` (tests + evals)
- [ ] Dependabot is configured and has opened its first PR
- [ ] `notes/phase-1-findings.md` is committed
- [ ] `git tag week-3-complete`
- [ ] `git tag phase-1-complete`

If the pass rate didn't improve across iterations, that's a finding, not a failure.

## Leadership lens

Most engineering orgs don't run tool-selection evals on their MCP servers, and their CI doesn't catch tool-selection regressions. They ship, they get vague "the AI is flaky" feedback, they patch the system prompt. That's the anti-pattern you're inoculating yourself against. Evals are to agentic systems what tests are to conventional software, and they belong in CI from day one — not day 100.

## Common pitfalls

- **Tuning the eval dataset until you pass.** Eval cases should represent real usage, not the capabilities of your current tools.
- **Multiple changes between eval runs.** One change per iteration, otherwise you can't attribute the delta.
- **Ignoring empty-success.** The heuristic above is a starting point; scan traces manually too.
- **Running evals only locally.** If the CI job is skipped "because it's flaky," fix the flakiness — don't silence the signal.

## Optional rabbit holes

- Add a latency-budget assertion to the eval runner (stretch — expanded in W10/W11).
- Look at how the Anthropic SDK formats tool errors. Pattern worth adopting.
- Experiment with `elicitation` (asking the user for input mid-turn) if any of your tools have ambiguous required args. Full treatment in W5.

## What's coming in Week 4

Phase 2 begins: port from stdio to Streamable HTTP using `hono`, test against multiple clients, handle transport-layer concerns (timeouts, idempotency keys, transport-vs-tool validation boundaries). The eval dataset you built this week is the first thing that runs under the new transport.
