---
title: Week 3 — Iterate and measure (Phase 1, part 2)
---

# Week 3 — Iterate and measure (Phase 1, part 2)

**Time budget:** 6 to 10 hours across three or four sittings.

## What you'll have by the end of the week

- A first eval dataset covering representative user queries against your server
- A harness capable of running that eval dataset and reporting pass/fail by tool selection
- At least one documented tool-design iteration (rename, re-describe, or restructure) with before/after numbers
- A Phase 1 memo committed
- Phase 1 closed out and ready for Phase 2

## Why this week exists

Last week you built the server. This week you subject it to honest evaluation. The distinction matters: in Week 2 you proved the plumbing works. In Week 3 you measure whether the tool design is any good. Most engineers stop at Week 2 and ship, which is why so many production MCP servers underperform. Do the measurement work and you'll have data you can defend in a design review.

## Reading list

1. **Hamel Husain, "Your AI product needs evals"** (Mar 2024). (~30min) Foundational.
   → <https://hamel.dev/blog/posts/evals/>
2. **Eugene Yan, "Evaluating the effectiveness of LLM-Evaluators"** (Aug 2024). (~30min) Both authors update regularly — skim their recent indexes for anything more current.
   → <https://eugeneyan.com/writing/llm-evaluators/>
3. **One practitioner post on tool-selection evaluation specifically.** (~30min) Search Simon Willison's MCP tag for tool-selection eval posts, or the Anthropic cookbook for an end-to-end example.
   → <https://simonwillison.net/tags/model-context-protocol/>
   → <https://github.com/anthropics/anthropic-cookbook>
4. **Revisit the MCP spec's sections on error handling and structured outputs.** (~15min) You'll tune both this week.
   → <https://modelcontextprotocol.io/specification>

## The iteration loop

The core activity of the week:

1. **Write a first eval set.** 12 to 20 representative prompts, each tagged with the expected tool (or `none`, if no tool should match).
2. **Run the harness against the eval set.** Record which tool the model selected, with what arguments, and whether the selection matched expectations.
3. **Identify failure modes.** Wrong tool selected? Arguments malformed? Empty-success (tool ran but returned useless output and the model treated it as success)?
4. **Make one focused change.** Rename a tool, sharpen a description, split one tool into two, or improve an error message.
5. **Rerun the eval.** Record the delta.
6. **Commit with a narrative message.** Something like: "Renamed `query` to `search_pages` after 4/12 eval failures showed the model confused it with `list_database_entries`; post-rename pass rate moved from 8/12 to 11/12."

Iterate at least twice. Three or four times if you have the energy.

### When to stop iterating

Iteration without a stop condition is how Week 3 eats Week 4. Use this rule:

- **Stop when pass rate ≥ 85%** on your eval set, OR
- **Stop after 4 iterations**, even if pass rate is still climbing, OR
- **Stop at the first plateau**: two consecutive iterations with no movement in pass rate means your tool design has a structural problem that one more rename won't fix.

A plateau is a finding, not a failure. Write it up in the memo: "the model confuses X and Y because the underlying domain distinction is ambiguous to users; splitting the tool further produced no gain; the fix is probably at the data-model level, not the tool level." That's a more valuable artefact than forcing a number up.

## Eval dataset shape

Create at `evals/phase-1-tool-selection.jsonl`. Each line is one evaluation case. Examples below use GitHub-shape tool names (matching Week 2's examples); substitute your own backend's primitives:

```json
{"id": "ts-001", "prompt": "find the issue about the auth migration", "expected_tool": "search_issues", "expected_args_shape": {"query": "string"}}
{"id": "ts-002", "prompt": "what PRs are open in the pathway repo", "expected_tool": "list_pull_requests", "expected_args_shape": {"repo": "string"}}
{"id": "ts-003", "prompt": "add a comment to issue #42 saying we're delayed", "expected_tool": "comment_on_issue", "expected_args_shape": {"issue_number": "integer", "body": "string"}}
```

Coverage guidance:

- **Clear-intent cases** (~50%): the right tool is obvious
- **Ambiguous cases** (~30%): the right tool is defensible but not obvious; this is where naming matters
- **No-tool cases** (~10%): nothing should match; the model should say so
- **Multi-step cases** (~10%): the prompt requires two or more tool calls in sequence

## Harness extension

Extend the harness to run eval mode. New CLI flag: `--eval <path-to-jsonl>`. Behaviour:

- Load cases from the JSONL
- For each case, run the agent loop against the server, capture tool selections
- Compare against `expected_tool` and (shape of) `expected_args_shape`
- Print a summary table: case ID, prompt (truncated), expected, actual, pass/fail, latency

Outcome is a simple pass rate and a list of failures you can investigate.

### What healthy eval output looks like

```
$ harness --eval evals/phase-1-tool-selection.jsonl

id      prompt (truncated)                                  expected            actual              pass  lat(ms)
------  --------------------------------------------------  ------------------  ------------------  ----  -------
ts-001  find the issue about the auth migration            search_issues       search_issues       ✓     284
ts-002  what PRs are open in the pathway repo              list_pull_requests  list_pull_requests  ✓     412
ts-003  add a comment to issue #42 saying we're delayed    comment_on_issue    create_issue        ✗     301
ts-004  delete last week's bug report                      (none)              (none)              ✓     —
...

11/12 pass (91.7%). See evals/results/2026-05-18-1422.json for full traces.

Failures:
  ts-003: expected=comment_on_issue actual=create_issue
    → model treated "add a comment" as "create a new thing"; consider tightening
      create_issue's description to exclude comment-like intent.
```

See `templates/examples/harness-trace-example.md` for a longer sample and for the shape of a full iteration cycle.

## Documenting the iteration

Keep an iteration log in your workbook at `notes/week-03-iterations.md`. One entry per rename or redesign. See `templates/examples/iteration-log-example.md` for a worked example. Shape:

```markdown
## Iteration 1 — 2026-05-18

**Change:** Renamed `query` → `search_issues`. Also sharpened description from "search the repo" to "Full-text search across all issues (open and closed) in the configured repo. Use when the user is looking for an issue by topic, title, or body text but doesn't have the issue number."

**Eval pass rate:** 8/12 → 11/12

**Failure analysis:** The remaining miss was ts-009 ("find the flaky test") where the model invoked `list_pull_requests` instead. Root cause: ambiguity between "issues" and "PRs" in a user mental model that doesn't sharply distinguish. Not fixing this week — the right fix is probably at the tool description level, not a rename.
```

This file is the first draft of the memo.

## Phase 1 memo

Use `templates/memo.md`. Commit to your workbook at `memos/01-tool-design.md`.

Structure:

- **TL;DR:** three bullets, no more
- **Context:** one paragraph, who this is for
- **Argument:** your opinionated view on tool design, with evidence from your iterations
- **What I'd say in a design review:** two or three sentences, the version you'd say out loud
- **What I changed my mind on:** one thing, honest

Hard ceiling: 800 words. Write Friday, sleep on it, edit Sunday, ship.

## What goes in your workbook this week

| Path | What |
|------|------|
| `evals/phase-1-tool-selection.jsonl` | Your eval dataset |
| `harness/` | Extended with `--eval` mode |
| `notes/week-03-iterations.md` | Iteration log with before/after numbers |
| `memos/01-tool-design.md` | Phase 1 memo |
| `progress.md` | Appended entries per session |

## Checkpoint — you've completed Week 3 when

- [ ] `evals/phase-1-tool-selection.jsonl` contains 12+ cases covering the four coverage categories
- [ ] Harness can run the eval dataset and report pass/fail
- [ ] At least two documented iterations with before/after pass rates
- [ ] `memos/01-tool-design.md` is committed
- [ ] Iteration log committed with narrative commits
- [ ] `git tag week-3-complete`
- [ ] `git tag phase-1-complete` (double-tag; Phase 1 is now done)

If the pass rate didn't improve across iterations, that's a finding, not a failure. Write the memo about what didn't move and why.

## Leadership lens

Most engineering orgs don't run tool-selection evals on their MCP servers. They ship, they get vague "the AI is flaky" feedback, and they patch by tweaking the system prompt. That's the anti-pattern you're inoculating yourself against. The skill you're building: the instinct to ask "what does the eval say?" in every design review, and the willingness to push back when the answer is "we don't have evals yet."

Evals are to agentic systems what tests are to conventional software. Teams that treat them as optional will ship unreliable products; teams that treat them as table stakes will compound quality over time. You want to be the leader who makes evals non-negotiable before the team has formed the bad habit of skipping them.

## Common pitfalls

- **Tuning the eval dataset until you pass.** Eval cases should represent real usage, not the capabilities of your current tools. If the dataset is too easy, add harder cases rather than making the tools broader.
- **Making multiple changes between eval runs.** One change per iteration. Otherwise you can't attribute the delta.
- **Ignoring empty-success.** A tool can "succeed" (return without error) and still return data the model treats as useful when it's not. Scan eval outputs manually, not just pass/fail.
- **Skipping the memo.** You will want to. Don't. It's the thing that closes Phase 1.

## Optional rabbit holes

- Add a secondary eval: latency budget per tool. Does the model tolerate slow tools, or does it retry / give up?
- Look at how the Anthropic SDK formats tool errors. There's a pattern worth adopting in your server.
- Experiment with `elicitation` (asking the user for input mid-turn) if any of your tools have ambiguous required args. It's a Phase 1 stretch goal.

## What's coming in Week 4

Phase 2 begins. You'll port from stdio to Streamable HTTP, implement session resumability, add progress notifications, and use the harness as a measurement rig. The eval dataset you built this week will be rerun in every subsequent phase as a regression guard. Treat it well.
