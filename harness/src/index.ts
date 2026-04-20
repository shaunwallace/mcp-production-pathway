/**
 * MCP Pathway — agent harness
 *
 * A test bench for exercising the MCP server through a real LLM loop.
 * Week 2: single-prompt mode.
 * Week 3: eval mode.
 *
 * Deliberately structural. The TODOs tell you what each function does;
 * your job is to implement them. Resist the temptation to import a larger
 * framework. This stays small by design.
 */

import Anthropic from "@anthropic-ai/sdk";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

// ---------- Types ----------

interface HarnessOptions {
  mode: "single" | "eval";
  prompt?: string;
  evalFile?: string;
  serverCommand: string;
  serverArgs: string[];
}

interface ToolCallTrace {
  tool: string;
  args: Record<string, unknown>;
  result: unknown;
  durationMs: number;
  error?: string;
}

interface EvalCase {
  id: string;
  prompt: string;
  expected_tool: string | null;
  expected_args_shape?: Record<string, string>;
}

interface EvalResult {
  case: EvalCase;
  actualTool: string | null;
  pass: boolean;
  reason?: string;
  trace: ToolCallTrace[];
}

// ---------- CLI ----------

function parseArgs(argv: string[]): HarnessOptions {
  // TODO(week-2): parse the minimum viable CLI
  //   usage: harness [--eval <path>] [prompt...]
  //   default server command: `npm --prefix ../server run dev`
  //   default mode: "single" with the prompt joined from positional args
  //   keep this simple; no yargs, no commander, just argv parsing
  throw new Error("TODO(week-2): implement parseArgs");
}

// ---------- Server connection ----------

async function connectToServer(opts: HarnessOptions): Promise<Client> {
  // TODO(week-2):
  //   1. create a StdioClientTransport that spawns the server subprocess
  //      using opts.serverCommand and opts.serverArgs
  //   2. create an MCP Client with a reasonable name/version
  //   3. client.connect(transport)
  //   4. return the connected client
  throw new Error("TODO(week-2): implement connectToServer");
}

async function listTools(client: Client): Promise<Anthropic.Tool[]> {
  // TODO(week-2):
  //   1. call client.listTools()
  //   2. map each MCP tool to Anthropic's Tool shape
  //      (name, description, input_schema)
  //   3. return the list
  throw new Error("TODO(week-2): implement listTools");
}

// ---------- Agent loop ----------

async function runAgentLoop(
  client: Client,
  anthropic: Anthropic,
  prompt: string,
  tools: Anthropic.Tool[]
): Promise<{ finalMessage: string; trace: ToolCallTrace[] }> {
  // TODO(week-2): implement the Anthropic tool-use loop.
  //
  // Shape of the loop:
  //   messages = [{ role: "user", content: prompt }]
  //   while true:
  //     response = await anthropic.messages.create({
  //       model: "claude-opus-4-5" or similar,
  //       max_tokens: ...,
  //       tools,
  //       messages,
  //     })
  //     append response.content to messages as an "assistant" message
  //     if response.stop_reason === "end_turn", break
  //     if response.stop_reason === "tool_use":
  //       for each tool_use block:
  //         call client.callTool({ name, arguments })
  //         capture trace (tool, args, result, duration, error)
  //         append tool_result to messages as a "user" message
  //     else: unexpected stop_reason, break with warning
  //
  // Collect traces along the way. Return final assistant text + trace array.
  //
  // Bound the loop (say, 10 iterations) to prevent runaway.
  throw new Error("TODO(week-2): implement runAgentLoop");
}

// ---------- Single-prompt mode ----------

async function runSingle(opts: HarnessOptions) {
  if (!opts.prompt) {
    throw new Error("No prompt provided. Usage: harness <prompt>");
  }

  const anthropic = new Anthropic();
  const client = await connectToServer(opts);

  try {
    const tools = await listTools(client);
    const { finalMessage, trace } = await runAgentLoop(
      client,
      anthropic,
      opts.prompt,
      tools
    );

    // TODO(week-2): pretty-print the trace and final message.
    //   Trace format: one line per tool call showing tool, args summary, latency.
    //   Final message printed after the trace, clearly delimited.
    console.log("---");
    console.log(finalMessage);
    console.log("---");
    console.log(`${trace.length} tool calls`);
  } finally {
    await client.close();
  }
}

// ---------- Eval mode ----------

async function runEval(opts: HarnessOptions) {
  // TODO(week-3):
  //   1. read JSONL file at opts.evalFile; parse each line as EvalCase
  //   2. for each case, run the agent loop, capture which tool was picked first
  //      (from the trace - first entry is the model's first tool choice)
  //   3. compare actualTool to expected_tool
  //      - match if expected_tool === actualTool
  //      - also "pass" if expected_tool === null and actualTool === null
  //        (the model correctly declined to call a tool)
  //   4. build an EvalResult for each case
  //   5. print a summary table: ID, prompt (truncated to 60 chars), expected,
  //      actual, pass/fail, latency of first tool call
  //   6. print an aggregate pass rate
  //
  // Bonus: write the full results to evals/results/<timestamp>.json for later diffing.
  throw new Error("TODO(week-3): implement runEval");
}

// ---------- Main ----------

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.mode === "eval") {
    await runEval(opts);
  } else {
    await runSingle(opts);
  }
}

main().catch((err) => {
  console.error("Harness failed:", err);
  process.exit(1);
});
