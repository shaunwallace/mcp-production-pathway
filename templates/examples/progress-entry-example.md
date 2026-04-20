# Progress log entries (worked example)

Two entries showing the "Did / Saw / Next / Stuck on" shape in practice. The progress log is the artefact you write most often — one entry per working session — so getting the shape right matters more here than in any other template.

Use this as a calibration, not a template to fill in. Notice how short each entry is: the log is for your future self, not for anyone else, and anything longer than this becomes a chore you'll skip.

---

## 2026-05-18 — Phase 1, Week 2, session 1 (2h)

**Did:** drafted tool definitions for the GitHub backend — `search_issues`, `read_issue`, `list_pull_requests`, `create_issue`, `comment_on_issue`, `close_issue`. Wrote JSON schemas for each. No implementation yet.

**Saw:** writing the descriptions first (before schemas) forced me to confront what each tool is actually *for*. `list_pull_requests` was originally `list_prs`; felt clever, read terribly in the harness. Renamed. Also noticed I almost wrote a generic `update_issue` tool — caught myself because the spec's descriptions-over-schemas guidance was fresh. Split into `comment_on_issue` and `close_issue`.

**Next:** implement the six tools against the GitHub REST API. Start with `search_issues` since it's the highest-risk (pagination, rate limits).

**Stuck on:** nothing yet. Flagging for later: do I need to return issue labels in `read_issue`, or is that too much context for the model? Come back to this after seeing the first harness run.

---

## 2026-05-19 — Phase 1, Week 2, session 2 (3h)

**Did:** implemented four of six tools. `search_issues` and `read_issue` work cleanly. `list_pull_requests` has a pagination bug — returns only first page. `create_issue` works but I'm not sure my error handling is right yet.

**Saw:** the GitHub API's 422 "validation failed" response has a useful `errors[]` array that tells you exactly which field was wrong. My first `create_issue` attempt was throwing a raw error; realised I should catch and reformat as a structured MCP error with the field name. Did that. Now when the model passes a bad title, it gets back something actionable. This is the "errors as recovery path" point from Week 1 made concrete.

**Next:** fix pagination in `list_pull_requests` (follow `Link` header). Then `comment_on_issue` and `close_issue`. Aim to finish implementation today and hit the Inspector tomorrow.

**Stuck on:** genuinely stuck on how to handle GitHub's secondary rate limit (the one that kicks in on concurrent requests). Not a Week 2 problem for me yet — the harness is single-threaded — but noting it for Week 11 (load testing).
