/**
 * MCP Pathway — server bootstrap
 *
 * This file wires up an MCP server over stdio and registers tools.
 * For Week 2, the only tool is a hello-world example. Your work is to
 * replace it with 4-6 real tools against your chosen backend.
 *
 * See server/README.md for the brief.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerTools } from "./tools/index.js";
import { logger } from "./instrumentation.js";

const server = new Server(
  {
    name: "mcp-pathway-server",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
      // TODO(week-2): consider whether to advertise resources or prompts
    },
  }
);

// TODO(week-2): register your 4-6 tools here
registerTools(server);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info({ event: "server_started", transport: "stdio" });
}

main().catch((err) => {
  logger.error({ event: "server_crashed", err: err.message });
  process.exit(1);
});
