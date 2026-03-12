#!/usr/bin/env node
import { runMCPServer } from "./mcp.js";

runMCPServer().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`hypercore-ts-mcp error: ${message}\n`);
  process.exit(2);
});
