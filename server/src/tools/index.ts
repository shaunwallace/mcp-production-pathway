/**
 * Tool registry.
 *
 * TODO(week-2): replace the hello tool with your 4-6 real tools.
 * Suggested file layout: one file per tool in this directory.
 * Register each from here.
 */

import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { helloTool } from "./hello.js";

// TODO(week-2): import your tools here as you build them
const tools = [helloTool];

export function registerTools(server: Server) {
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const tool = tools.find((t) => t.name === request.params.name);
    if (!tool) {
      throw new Error(`Unknown tool: ${request.params.name}`);
    }
    return await tool.handler(request.params.arguments ?? {});
  });
}
