import test from "node:test";
import assert from "node:assert/strict";
import { HypernodeMCPServer } from "../dist/index.js";

function payload(response) {
  return JSON.parse(response.result.content[0].text);
}

function fakeServer() {
  const server = new HypernodeMCPServer();
  server.clients = {
    api: {
      rpcCall: async (method, params = []) => ({ method, params }),
    },
    grpc: {
      getMidPrice: async (coin = "BTC") => ({ coin, price: 100 }),
      streamMids: async ({ coin = "BTC", subscription = "allMids" } = {}) => [{ coin, subscription }],
      getBlockNumber: async () => ({ number: 42, hex: "0x2a" }),
      streamLiquidations: async ({ coin = "BTC" } = {}) => [{ symbol: coin, tx_hash: "0x1" }],
    },
    unified: {
      stats: async () => ({ stats: { latest_seq: 1 } }),
      events: async ({ limit = 50, eventType, stream } = {}) => ({ events: [{ limit, eventType, stream }] }),
      liquidationCascades: async (limit = 50) => ({ events: [{ limit, event_type: "liquidation_cascade" }] }),
      consensusPulse: async () => ({ consensus_pulse: { current_block_height: 123 } }),
      allMids: async (dex) => ({ dex: dex ?? "", snapshot: { BTC: "60000" } }),
      getL2Book: async (coin, { dex, depth } = {}) => ({ coin, dex: dex ?? "", depth }),
      getAssetContexts: async ({ coin, dex } = {}) => ({ coin, dex: dex ?? "", assets: [{ coin: coin ?? "BTC" }] }),
    },
    status: {
      publicStatus: async () => ({ snapshot: { service: { name: "public" } } }),
      privateStatus: async () => ({ snapshot: { service: { name: "private" } } }),
    },
  };
  return server;
}

test("mcp initialize, tool listing, and catalog work", async () => {
  const server = fakeServer();

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
  assert.ok(tools.result.tools.some((tool) => tool.name === "unified_get_all_mids"));
  assert.ok(tools.result.tools.some((tool) => tool.name === "unified_get_l2_book"));
  assert.ok(tools.result.tools.some((tool) => tool.name === "unified_get_asset_contexts"));

  const catalog = await server.handleRequest({
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: { name: "catalog_interfaces", arguments: {} },
  });
  assert.match(catalog.result.content[0].text, /service_catalog/);
  assert.match(catalog.result.content[0].text, /recommended_paths/);
  assert.match(catalog.result.content[0].text, /liquidation_cascade/);
  assert.match(catalog.result.content[0].text, /asset contexts/);
});

test("mcp covers tool matrix and request edge cases", async () => {
  const server = fakeServer();

  for (const [name, args, key] of [
    ["catalog_interfaces", {}, "service_catalog"],
    ["grpc_get_mid_price", { coin: "BTC" }, "coin"],
    ["grpc_stream_mids_sample", { coin: "BTC", subscription: "trades" }, "messages"],
    ["grpc_get_block_number", {}, "number"],
    ["grpc_stream_liquidations_sample", { coin: "BTC" }, "messages"],
    ["unified_get_stats", {}, "stats"],
    ["unified_get_events", { limit: 5, eventType: "trade", stream: "trades" }, "events"],
    ["unified_get_liquidation_cascades", { limit: 5 }, "events"],
    ["unified_get_consensus_pulse", {}, "consensus_pulse"],
    ["unified_get_all_mids", {}, "snapshot"],
    ["unified_get_l2_book", { coin: "BTC", depth: 5 }, "coin"],
    ["unified_get_asset_contexts", { coin: "BTC" }, "assets"],
    ["status_get_public", {}, "snapshot"],
    ["status_get_private", {}, "snapshot"],
    ["rpc_call", { method: "eth_blockNumber", params: [] }, "result"],
  ]) {
    const response = await server.handleRequest({
      jsonrpc: "2.0",
      id: String(name),
      method: "tools/call",
      params: { name, arguments: args },
    });
    assert.ok(response);
    assert.ok(key in payload(response));
  }

  const ping = await server.handleRequest({ jsonrpc: "2.0", id: 8, method: "ping", params: {} });
  assert.deepEqual(ping.result, {});

  const ignored = await server.handleRequest({ jsonrpc: "2.0", id: 9, method: "notifications/initialized", params: {} });
  assert.equal(ignored, null);

  const badMethod = await server.handleRequest({ jsonrpc: "2.0", id: 10, method: "unknown/method", params: {} });
  assert.equal(badMethod.error.code, -32601);
});

test("mcp returns error for unknown tool", async () => {
  const server = fakeServer();
  const response = await server.handleRequest({
    jsonrpc: "2.0",
    id: 11,
    method: "tools/call",
    params: { name: "does_not_exist", arguments: {} },
  });
  assert.equal(response.error.code, -32000);
  assert.match(response.error.message, /Unknown tool/);
});
