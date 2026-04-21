---
title: Repo architecture
description: The textbook-workbook split and git conventions.
---

# Repo architecture

This document explains how the public learning pathway relates to your private workbook, and the git conventions that hold them together. Read this once before Week 1.

## The textbook-and-workbook split

Two repos, two roles.

**This repo (public, `mcp-production-pathway`): the textbook.** Curriculum, reading lists, exercise briefs, ADR and memo templates, empty code scaffolds with TODOs, checkpoint criteria. Configured as a GitHub template repository. Stays pristine. Others fork or template-instantiate it to follow along.

**Your private repo (the workbook, named however you like): your work.** Template-instantiated from this repo. Contains your actual server code, your harness, your filled-in memos, your decision log, your progress journal, your evals. Private by default. You choose later whether to make any part of it public.

The mental model: textbook is what the author teaches, workbook is how the learner responds. The two diverge deliberately. When the textbook updates, the learner pulls the curriculum delta manually.

## Why template repo rather than fork

GitHub has two ways to copy someone else's repo. Fork preserves an upstream link and history, which is right for contributing back. Template creates a fresh repo with clean history, which is right for starting your own project. The workbook is your own project. Use template.

Setup, once:

1. In the public pathway repo on GitHub, Settings → General → check "Template repository"
2. Click "Use this template" → "Create a new repository"
3. Name it something personal (e.g. `mcp-workbook`), set private
4. Clone locally and start working

If you later want the reader to be able to do the same thing, the template flag is already set. They get the same clean experience you did.

## What's in each repo

**Public pathway repo:**

```
mcp-production-pathway/
├── README.md                # entry point for new readers
├── REPO-ARCHITECTURE.md     # this file
├── PATHWAY.md               # 12-week artefact-dependency map
├── CLAUDE.md                # guidance for Claude Code instances
├── docs/
│   └── model-ids.md         # pinned Claude model IDs
├── scripts/
│   └── check-line-count.sh  # enforces the harness 300-line ceiling
├── weeks/                   # curriculum, one file per week
│   ├── week-00-setup.md     # prerequisites walkthrough
│   ├── week-01.md
│   ├── week-02.md
│   └── week-03.md
├── templates/               # templates for workbook artefacts
│   ├── memo.md
│   ├── adr.md
│   ├── progress-entry.md
│   └── examples/            # worked examples of each artefact
│       ├── README.md
│       ├── memo-example-a.md
│       ├── memo-example-b.md
│       ├── adr-example.md
│       ├── iteration-log-example.md
│       └── harness-trace-example.md
├── server/                  # MCP server scaffold with TODOs
└── harness/                 # agent harness scaffold with TODOs
```

**Your private workbook:**

```
mcp-workbook/
├── README.md                # same, or replaced with your own
├── weeks/                   # read-only reference — do not edit
├── templates/               # read-only reference — do not edit
├── progress.md              # your weekly log, append-only
├── notes/                   # your working notes per week
│   ├── week-01.md
│   ├── week-02-tool-design.md
│   └── week-03-iterations.md
├── memos/                   # your filled-in memos
│   ├── 00-why-mcp.md
│   ├── 01-tool-design.md
│   └── ...
├── decisions/               # your ADRs
│   ├── 0001-sdk-and-backend-choice.md
│   └── ...
├── server/                  # your server code (scaffold filled in)
├── harness/                 # your harness code (scaffold filled in)
├── evals/                   # your eval datasets and results
└── runbooks/                # Phase 6 artefacts
```

Note: `weeks/` and `templates/` stay as read-only reference in your workbook. Your working notes live in `notes/`, so pulling a curriculum update from the public pathway later never conflicts with your writing.

## Git conventions that make the workbook valuable later

Your workbook is a learning artefact. If you treat git well, it becomes a story you can review six months from now or show to a future employer. Three conventions.

**Commit messages are narrative, not just descriptive.** First person, past tense, specific. "Renamed `query` to `search_documents` after harness showed 4/12 tool-selection failures on ambiguous prompts" is a commit message worth writing. "update tool names" is not.

**Checkpoint tags.** At the end of each week, tag the commit: `week-1-complete`, `week-2-complete`, etc. At phase boundaries, tag again: `phase-1-complete`. Later, when you want to prove progress to yourself or others, the tags are the proof.

**ADR-first for anything architectural.** Before you port from stdio to HTTP, write the ADR. Before you pick Honeycomb over Datadog, write the ADR. The commit that introduces the change references the ADR. This habit is the cheapest way to build architectural fluency, and the log becomes a defensible record of decision-making at VP/CPTO level.

## How to start your workbook

Three steps, should take under 15 minutes:

1. Ensure this repo is on GitHub and marked as a template (see above)
2. From the GitHub UI, use this template to create your private workbook repo
3. Clone the workbook locally, then run the scaffold script below from inside it

```bash
# Run from inside your workbook repo, once
touch progress.md
mkdir -p notes memos decisions evals runbooks
git add .
git commit -m "Initialise workbook from pathway template"
git tag week-0-start
```

From here, open `weeks/week-00-setup.md` for the 30-60 minute prerequisites walkthrough. Week 1 begins after that.

## A note on publishing your workbook later

Don't decide now. The workbook is private by default, which is the right setting while you're learning. After Phase 3 or 4, when you have real artefacts you're proud of, you can evaluate whether to make it public. If you do, the narrative commit messages and checkpoint tags will be the thing that makes it valuable rather than embarrassing.
