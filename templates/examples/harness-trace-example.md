# Harness output — worked examples

What healthy trace output looks like, for single-prompt mode and for eval mode. Use this to calibrate your own harness formatting in Weeks 2 and 3. If your output is noisier or less scannable than this, tighten it — the trace is a debugging tool, not a log dump.

> **Note on the backend:** the examples below use pages/databases/comments tool names (one possible Week 2 backend). If you picked GitHub, substitute `search_issues` / `read_issue` / `list_pull_requests` / `create_issue` / `comment_on_issue`. If you picked Linear, Trello, Todoist, or something else, the shape of the trace is identical — only the nouns change.

---

## Single-prompt mode (Week 2)

Command:

```
$ harness "find the Q3 planning doc and summarise the top three risks"
```

Output:

```
[trace]
  tool=search_pages          args={query:"Q3 planning"}                    → 2 hits              (312ms)
  tool=read_page             args={page_id:"abc123..."}                    → 4.2KB, 18 blocks    (187ms)

---
The Q3 planning doc flags three top risks:

1. Capacity on the data-platform team — two senior engineers are allocated
   to the billing refactor through mid-quarter, leaving platform work thin.
2. Vendor delivery for the auth migration — the partner's latest ETA is
   three weeks behind the plan of record.
3. Dependency on the billing refactor — two downstream workstreams are
   blocked until billing lands, which makes this the critical-path risk.

The billing one is the most material because of the downstream blocking.
---
2 tool calls, 499ms total, finish_reason=end_turn
```

Things this output does well:

- **The trace is one line per tool call.** Tool name, arg summary, result shape, latency. No raw JSON dumps — the args and result are summarised.
- **The trace comes first, the answer second.** You can scan whether tool selection was sensible before reading the answer.
- **Latencies are visible.** 187ms is fine; 3000ms would be flagged immediately.
- **A footer summarises volume.** Two tool calls, 499ms. If it said "8 tool calls, 14s", something was wrong.

Things this output avoids:

- No stack traces on success. No ANSI colour codes in piped output. No emoji unless you're already in a team that uses them.
- No raw JSON for args — a model-generated `query` of 600 characters would ruin the trace. Truncate or summarise.

---

## Eval mode (Week 3)

Command:

```
$ harness --eval evals/phase-1-tool-selection.jsonl
```

Output:

```
Loaded 12 cases from evals/phase-1-tool-selection.jsonl

id      prompt (truncated)                                  expected                actual                  pass   lat(ms)
------  --------------------------------------------------  ----------------------  ----------------------  -----  -------
ts-001  find the meeting notes from last Tuesday's sync     search_pages            search_pages            ✓      284
ts-002  what does the engineering OKRs database have fo...  list_database_entries   list_database_entries   ✓      412
ts-003  add a comment to the project plan page saying w...  comment_on_page         append_to_page          ✗      301
ts-004  delete last week's standup notes                    (none)                  (none)                  ✓      —
ts-005  create a new project page in the Q3 parent         create_page              create_page             ✓      388
ts-006  what pages did I create last week                   search_pages            search_pages            ✓      256
ts-007  find the sales deck                                 search_pages            list_database_entries   ✗      394
ts-008  who is assigned to the billing refactor in Linear  (none)                   (none)                  ✓      —
ts-009  show me the engineering roadmap page                read_page               search_pages            ✗      299
ts-010  append "blocked on auth" to the billing epic       append_to_page          append_to_page          ✓      421
ts-011  comment "nice work" on the auth migration doc      comment_on_page         comment_on_page         ✓      318
ts-012  list everything in the customer-facing roadmap db  list_database_entries   list_database_entries   ✓      402

---
9/12 pass (75.0%)
Median latency (first tool call): 310ms. p95: 421ms.

Failures:
  ts-003  expected=comment_on_page         actual=append_to_page
          → model read "add a comment" as "append text". Candidate fix:
            sharpen append_to_page description to exclude comment-like intent.
  ts-007  expected=search_pages            actual=list_database_entries
          → "deck" appears in a database name ("Sales Decks"). Structural;
            not a one-line fix.
  ts-009  expected=read_page               actual=search_pages
          → prompt assumes the model knows the page ID from context; it
            doesn't. This case is arguably mis-specified. Consider revising.

Results written to evals/results/2026-05-18-1422.json
```

Things this output does well:

- **One table, one pass-rate summary, one failure list.** No pagination, no nesting.
- **Failures have analysis, not just labels.** The reader shouldn't have to open the results JSON to understand why something failed.
- **Latency reported as median + p95**, not average. Averages hide tail latency; p95 is what you tune against.
- **Results written to disk.** The JSON has the full trace per case; the stdout summary is just navigation.

Things the output is honest about:

- **`ts-009` calls the eval case itself into question.** If a prompt is mis-specified, the answer is to fix the prompt, not to torture the tool surface until it guesses right.

---

## How you'll use this

In Week 2, match the single-prompt format or a close variant. In Week 3, match the eval-mode format. Don't copy verbatim — the value is understanding the shape, not the text. If your own output diverges meaningfully, ask whether the divergence helps or just adds noise.
