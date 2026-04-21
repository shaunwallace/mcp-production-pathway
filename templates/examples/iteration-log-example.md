---
title: Iteration log example
---

# Week 3 iteration log (worked example)

Two fully-worked entries. Real logs may have three or four. Notice the structure: each entry opens with one focused change, quotes the before/after pass rate, and names the residual failure class. That's the whole form.

Use this to calibrate shape, not content. Your own log will have different tool names, different prompts, and different failure modes.

> **Note on the backend:** this example uses tool names shaped for a pages/databases/comments backend (e.g., Notion). It's one of several defensible choices from the Week 0 menu. If you picked GitHub, your tool names will read `search_issues`, `read_issue`, `list_pull_requests`, etc. If you picked Linear, Trello, or Todoist, they'll look different again. The *kind* of tool-selection failure the model makes — confusing adjacent tools, being misled by overloaded words — is the same regardless of backend.

---

## Iteration 1 — 2026-05-18

**Change:** Renamed `query` → `search_pages`. Also sharpened the description from:

> "Search the Notion workspace."

to:

> "Full-text search across all accessible pages. Use when the user is looking for a page by topic, title, or content but doesn't have the page ID. Do not use when the user has named a specific database; use `list_database_entries` for that."

**Eval pass rate:** 8/12 → 11/12 (66.7% → 91.7%)

**Failure analysis:**

- The change fixed four out of four prior failures where the model invoked `query` on prompts like "what's in the engineering OKRs database" — the description now steers it toward `list_database_entries`.
- The remaining miss is `ts-009` ("find the sales deck"). The model invoked `list_database_entries` instead of `search_pages`. Root cause: the word "deck" appears in the description of a database named "Sales Decks", which biases the model's tool selection. Not fixing this week — the right fix is probably restructuring the underlying workspace, which is out of scope.

**Commit:** `feat(tools): rename query→search_pages, sharpen description (evals 8/12→11/12)`

---

## Iteration 2 — 2026-05-19

**Change:** Split `create_page` into `create_page_in_parent` and `create_database_entry`. The original was a single tool with a polymorphic `parent` argument that the model routinely got wrong. Two-line change to the registry, two new tool definitions, deprecated the old one.

**Eval pass rate:** 11/12 → 12/12 (91.7% → 100%)

**Failure analysis:**

- The `ts-009` miss from Iteration 1 actually resolved itself. Root cause turned out to be interaction: `create_page`'s polymorphic description was polluting the model's understanding of the whole tool surface. Once it was gone, `ts-009` started picking `search_pages` correctly. Worth noting: the failure I thought was structural was an artefact of a different tool's ambiguity.
- Pass rate of 12/12 on this dataset is suspicious. The dataset is 12 cases; I need to extend it before trusting this number. Added to Week 4 prep: grow the eval set to 20-30 cases covering edge cases I haven't written yet.

**Commit:** `feat(tools): split create_page into parent-specific variants (evals 11/12→12/12)`

**Lesson from this iteration:** tool interactions matter as much as individual tool design. A failure in one tool's selection can be caused by ambiguity in a neighbouring tool. The debugging instinct — treating each failure as local — is wrong.

---

## Closing note for the memo

Two iterations, four hours total, pass rate 66.7% → 100%. The narrative for the Phase 1 memo: the model is more sensitive to the structure of the tool *surface* than to any individual tool's description. Renaming helps; sharpening descriptions helps more; redesigning the boundary between tools helps most. Most production MCP teams stop at renaming. The delta between "renamed" and "redesigned" is where the real reliability lives.
