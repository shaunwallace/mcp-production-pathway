/**
 * Hello-world tool.
 *
 * This exists so the scaffold boots with something to call.
 * REPLACE with your real tools in Week 2.
 *
 * Study its shape: name, description, inputSchema, handler wrapped with instrument().
 * All your tools should follow this pattern.
 */

import { z } from "zod";
import { instrument } from "../instrumentation.js";

const InputSchema = z.object({
  name: z.string().describe("Name to greet"),
});

type Input = z.infer<typeof InputSchema>;

export const helloTool = {
  name: "hello",
  description: "Greets a person by name. Use only as a smoke test; replace with real tools.",
  inputSchema: {
    type: "object",
    properties: {
      name: { type: "string", description: "Name to greet" },
    },
    required: ["name"],
  },
  handler: instrument<Input, { content: Array<{ type: "text"; text: string }> }>("hello", async (args) => {
    const parsed = InputSchema.parse(args);
    return {
      content: [{ type: "text" as const, text: `Hello, ${parsed.name}!` }],
    };
  }),
};
