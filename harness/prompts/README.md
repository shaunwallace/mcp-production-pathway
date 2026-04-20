# Prompts

Example prompts and eval datasets live here.

## Single-prompt testing

Just pass a prompt string directly on the CLI during Week 2:

```bash
npm run dev -- "Find the engineering OKRs page"
```

No need to save these unless one is particularly useful as a regression check, in which case promote it to an eval case.

## Eval datasets (Week 3 onward)

Eval datasets are JSONL. One case per line. See `weeks/week-03.md` for the shape and coverage guidance.

File naming convention: `<phase>-<topic>.jsonl`, e.g.:

- `phase-1-tool-selection.jsonl`
- `phase-3-auth-errors.jsonl`
- `phase-6-adversarial.jsonl`

Each phase adds one eval dataset. Earlier datasets keep running in later phases as regression guards.
