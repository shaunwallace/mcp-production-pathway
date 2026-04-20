/**
 * Structured logging for every tool call.
 *
 * Shape of each log line:
 * {
 *   ts:          ISO-8601 timestamp
 *   session_id:  session identifier (stubbed in Week 2, real in Week 4)
 *   tool:        tool name
 *   args_hash:   SHA-256 hash of arguments (avoid logging raw args - privacy)
 *   duration_ms: how long the tool call took
 *   outcome:     "ok" | "error"
 *   error_class: the error class if outcome is "error", else null
 * }
 *
 * This is the scaffolding that Phase 4 (Week 8) upgrades to OpenTelemetry spans.
 * Get the shape right now and the upgrade is mechanical later.
 */

import pino from "pino";
import { createHash } from "node:crypto";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  formatters: {
    level: (label) => ({ level: label }),
  },
});

export function hashArgs(args: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(args ?? {}))
    .digest("hex")
    .slice(0, 16);
}

/**
 * Wrap a tool handler with instrumentation.
 * TODO(week-2): make sure every registered tool uses this wrapper.
 */
export function instrument<TArgs, TResult>(
  toolName: string,
  handler: (args: TArgs) => Promise<TResult>
): (args: TArgs) => Promise<TResult> {
  return async (args: TArgs) => {
    const start = Date.now();
    const argsHash = hashArgs(args);
    try {
      const result = await handler(args);
      logger.info({
        event: "tool_call",
        tool: toolName,
        args_hash: argsHash,
        duration_ms: Date.now() - start,
        outcome: "ok",
      });
      return result;
    } catch (err) {
      logger.warn({
        event: "tool_call",
        tool: toolName,
        args_hash: argsHash,
        duration_ms: Date.now() - start,
        outcome: "error",
        error_class: err instanceof Error ? err.constructor.name : "unknown",
      });
      throw err;
    }
  };
}
