import test from "node:test";
import assert from "node:assert/strict";
import { HypernodeMCPServer } from "../dist/index.js";

test("mcp initialize, tool listing, and catalog work", async () => {
  const server = new HypernodeMCPServer();

  const init = await server.handleRequest({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: { protocolVersion: "2024-11-05" },
  });
  assert.equal(init.result.serverInfo.name, "hypercore-ts-mcp");

  const tools = await server.handleRequest({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/list",
    params: {},
  });
  assert.ok(Array.isArray(tools.result.tools));
  assert.ok(tools.result.tools.some((tool) => tool.name === "catalog_interfaces"));
  assert.ok(tools.result.tools.some((tool) => tool.name === "grpc_stream_liquidations_sample"));
  assert.ok(tools.result.tools.some((tool) => tool.name === "unified_get_liquidation_cascades"));

  const catalog = await server.handleRequest({
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: { name: "catalog_interfaces", arguments: {} },
  });
  assert.match(catalog.result.content[0].text, /service_catalog/);
  assert.match(catalog.result.content[0].text, /recommended_paths/);
  assert.match(catalog.result.content[0].text, /liquidation_cascade/);
});

test("mcp returns error for unknown tool", async () => {
  const server = new HypernodeMCPServer();
  const response = await server.handleRequest({
    jsonrpc: "2.0",
    id: 9,
    method: "tools/call",
    params: { name: "does_not_exist", arguments: {} },
  });
  assert.equal(response.error.code, -32000);
  assert.match(response.error.message, /Unknown tool/);
});
