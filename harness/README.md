# Agent harness scaffold

The harness is the piece of infrastructure that exercises your MCP server through a real LLM loop. Inspector is fine for eyeballing shapes; only the harness tells you what actually happens when an LLM picks tools, composes arguments, handles errors, and multi-turns.

You'll extend this every phase. Start minimal.

## What's in here

```
harness/
├── package.json
├── tsconfig.json
├── src/
│   └── index.ts     # minimal CLI skeleton with TODOs
└── prompts/
    └── README.md    # where your example prompts go
```

## What you're building in Week 2

A CLI that:

1. Starts your MCP server as a subprocess over stdio
2. Connects an MCP client to it
3. Accepts a user prompt (CLI arg or stdin)
4. Runs an Anthropic tool-use loop, feeding tool results back to the model
5. Prints the final assistant message
6. Prints a trace of which tools were selected, with what arguments, and what they returned

Keep under 300 lines. This is not an agent framework; it's a test bench.

## What you're extending in Week 3

Add an eval mode:

- `--eval <path-to-jsonl>` flag loads cases from a JSONL file
- Each case has a prompt and expected tool
- Harness runs the agent loop against each case
- Prints a pass/fail summary and a failure list

## What's coming in later phases

- **Phase 2:** support HTTP transport in addition to stdio; measure latency across transports
- **Phase 3:** handle OAuth as a client (discovery, PKCE, token refresh)
- **Phase 4:** concurrent mode for load testing; emit OpenTelemetry spans
- **Phase 5:** eval mode becomes the regression guard; emit cost attribution
- **Phase 6:** adversarial prompts mode for security testing

Structure your code so each of these is a natural extension, not a rewrite.

## Getting started

```bash
cd harness
npm install
export ANTHROPIC_API_KEY=sk-ant-...
npm run dev -- "Say hello to Shaun"
```

If your server's `hello` tool is still in place, the harness should invoke it and print a greeting.

## TODOs you'll work through

Search for `TODO(week-2)` and `TODO(week-3)` in `src/index.ts`. High-level:

- [ ] **Week 2:** spawn the server subprocess, wire up the MCP client
- [ ] **Week 2:** implement the Anthropic tool-use loop
- [ ] **Week 2:** print tool call traces
- [ ] **Week 3:** add `--eval` mode with pass/fail reporting
- [ ] **Week 3:** support multi-turn cases in eval mode
