---
title: Model IDs
description: Pinned Claude model IDs and rotation policy.
---

# Model IDs

Single source of truth for which Claude model the harness targets. The scaffolds and week briefs reference this file rather than hard-coding an ID, so rotating to a newer model is a one-file change.

**Last updated:** 2026-04-20.

## Current pins

| Role | Model ID | Why |
|------|----------|-----|
| **Default (harness)** | `claude-sonnet-4-6` | Good tool-use quality at reasonable cost. This is what the Week 2-3 harness examples assume. |
| Budget runs (eval CI, smoke tests) | `claude-haiku-4-5-20251001` | Cheaper and faster for repeated eval runs in Week 3 and beyond. Lower tool-selection accuracy — don't trust eval-pass-rate numbers from Haiku as final. |
| Ceiling runs (hard-case evals, comparisons) | `claude-opus-4-7` | For when you're testing whether a failure is a tool-design problem or a model-capability problem. Roughly 3× Sonnet cost. |

## Why this file exists

Claude models rotate on the order of months. A pathway written against `claude-opus-4-6` would already be referencing a non-current model. Hard-coding the ID in a week brief, in the harness, and in a memo creates three places to update and two places to miss. This file centralises it.

## How to update

When Anthropic ships a new generation:

1. Update the pin table above. Note the date.
2. Update `harness/src/index.ts` (the model is read from this file's pin, either as a constant or via env var — whichever the harness implementation chose).
3. Do not retroactively edit past ADRs or memos. Those are point-in-time artefacts. The decision log's value is that it reflects what was true when you decided.
4. Rerun the Phase 1 eval on the new model and note the delta in `progress.md`. Models change tool-selection behaviour; your eval pass rate is a cheap early-warning signal for whether the pathway's tool-design advice still lands.

## Model documentation

- Anthropic model overview: <https://docs.anthropic.com/en/docs/about-claude/models>
- API reference: <https://docs.anthropic.com/en/api/>
- Pricing: <https://www.anthropic.com/pricing#api>

Verify IDs against the Anthropic docs before updating — marketing names (Opus, Sonnet, Haiku) are stable, but the full IDs carry version suffixes that do change.
