import { stdin, stdout } from "node:process";
import { HyperCoreAPI } from "./api.js";
import { loadConfig, SDKConfig } from "./config.js";
import { GrpcClient } from "./grpc.js";
import { StatusClient } from "./status.js";
import { UnifiedStreamClient } from "./unified_stream.js";

type JsonRpcId = string | number | null;

type JsonRpcRequest = {
  jsonrpc: "2.0";
  id?: JsonRpcId;
  method: string;
  params?: Record<string, unknown>;
};

type JsonRpcResponse = {
  jsonrpc: "2.0";
  id: JsonRpcId;
  result?: unknown;
  error?: {
    code: number;
    message: string;
  };
};

type ToolSpec = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

type ServiceClients = {
  api: HyperCoreAPI;
  grpc: GrpcClient;
  unified: UnifiedStreamClient;
  status: StatusClient;
};

const DEFAULT_PROTOCOL_VERSION = "2024-11-05";

function toJsonResponse(id: JsonRpcId, result: unknown): JsonRpcResponse {
  return { jsonrpc: "2.0", id, result };
}

function toJsonError(id: JsonRpcId, code: number, message: string): JsonRpcResponse {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

function textContent(payload: unknown): { content: Array<{ type: "text"; text: string }> } {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(payload, null, 2),
      },
    ],
  };
}

export class HypernodeMCPServer {
  private readonly clients: ServiceClients;
  readonly tools: ToolSpec[];

  constructor(private readonly cfg: SDKConfig = loadConfig()) {
    this.clients = {
      api: new HyperCoreAPI(cfg),
      grpc: new GrpcClient({
        target: cfg.grpcTarget,
        timeoutMs: cfg.timeoutMs,
        useTls: cfg.grpcTls,
        serverName: cfg.grpcServerName,
        apiKey: cfg.grpcApiKey ?? cfg.apiKey,
        caCertPath: cfg.grpcCaCertPath,
      }),
      unified: new UnifiedStreamClient(cfg),
      status: new StatusClient(cfg),
    };

    this.tools = [
      {
        name: "catalog_interfaces",
        description: "Return the Hypernode service catalog, local coverage, and recommended low-latency paths.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
      },
      {
        name: "grpc_get_mid_price",
        description: "Get a single cached-or-live mid price from the gRPC bridge.",
        inputSchema: {
          type: "object",
          properties: {
            coin: { type: "string", description: "Asset symbol, for example BTC." },
          },
          required: ["coin"],
          additionalProperties: false,
        },
      },
      {
        name: "grpc_stream_mids_sample",
        description: "Read a bounded sample from the gRPC market-data stream for allMids, trades, or l2Book.",
        inputSchema: {
          type: "object",
          properties: {
            coin: { type: "string" },
            subscription: { type: "string", enum: ["allMids", "trades", "l2Book"] },
            maxMessages: { type: "integer", minimum: 1, maximum: 100, default: 5 },
            heartbeatS: { type: "integer", minimum: 1, maximum: 60, default: 5 },
          },
          required: ["coin", "subscription"],
          additionalProperties: false,
        },
      },
      {
        name: "grpc_get_block_number",
        description: "Get the current block number from the gRPC bridge.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
      },
      {
        name: "grpc_stream_liquidations_sample",
        description: "Read a bounded sample from the filtered liquidation stream.",
        inputSchema: {
          type: "object",
          properties: {
            coin: { type: "string" },
            maxMessages: { type: "integer", minimum: 1, maximum: 100, default: 5 },
            heartbeatS: { type: "integer", minimum: 1, maximum: 60, default: 1 },
          },
          additionalProperties: false,
        },
      },
      {
        name: "unified_get_stats",
        description: "Fetch unified stream aggregate statistics, latency summaries, and microstructure metrics.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
      },
      {
        name: "unified_get_events",
        description: "Fetch recent unified events with optional event_type and stream filters.",
        inputSchema: {
          type: "object",
          properties: {
            limit: { type: "integer", minimum: 1, maximum: 2000, default: 50 },
            eventType: { type: "string" },
            stream: { type: "string" },
          },
          additionalProperties: false,
        },
      },
      {
        name: "unified_get_liquidation_cascades",
        description: "Fetch recent derived liquidation cascade events from the unified sidecar.",
        inputSchema: {
          type: "object",
          properties: {
            limit: { type: "integer", minimum: 1, maximum: 2000, default: 50 },
          },
          additionalProperties: false,
        },
      },
      {
        name: "unified_get_consensus_pulse",
        description: "Fetch consensus pulse metrics, including block-height and Tokyo probe status.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
      },
      {
        name: "unified_get_all_mids",
        description: "Fetch browser-safe allMids snapshot from the unified sidecar.",
        inputSchema: {
          type: "object",
          properties: {
            dex: { type: "string" },
          },
          additionalProperties: false,
        },
      },
      {
        name: "unified_get_l2_book",
        description: "Fetch browser-safe canonical L2 book snapshot from the unified sidecar.",
        inputSchema: {
          type: "object",
          properties: {
            coin: { type: "string" },
            dex: { type: "string" },
            depth: { type: "integer", minimum: 1 },
          },
          required: ["coin"],
          additionalProperties: false,
        },
      },
      {
        name: "unified_get_asset_contexts",
        description: "Fetch browser-safe asset contexts including funding, OI, and 24h notional volume.",
        inputSchema: {
          type: "object",
          properties: {
            coin: { type: "string" },
            dex: { type: "string" },
          },
          additionalProperties: false,
        },
      },
      {
        name: "status_get_public",
        description: "Fetch the public delayed status snapshot.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
      },
      {
        name: "status_get_private",
        description: "Fetch the private delayed status snapshot using the configured status token.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
      },
      {
        name: "rpc_call",
        description: "Call a JSON-RPC method on the HyperCore node gateway.",
        inputSchema: {
          type: "object",
          properties: {
            method: { type: "string" },
            params: { type: "array", default: [] },
          },
          required: ["method"],
          additionalProperties: false,
        },
      },
    ];
  }

  private async callTool(name: string, argumentsPayload: Record<string, unknown> = {}): Promise<unknown> {
    switch (name) {
      case "catalog_interfaces":
        return {
          service_catalog: {
            grpc_bridge: {
              target: this.cfg.grpcTarget,
              methods: ["GetMidPrice", "StreamMids", "GetBlockNumber", "StreamLiquidations"],
            },
            unified_stream: {
              base_url: this.cfg.unifiedStreamUrl,
              endpoints: [
                "/healthz",
                "/api/v1/unified/stats",
                "/api/v1/unified/events",
                "/api/v1/unified/stream",
                "/api/v1/unified/consensus-pulse",
                "/api/v1/unified/all-mids",
                "/api/v1/unified/l2-book",
                "/api/v1/unified/asset-contexts",
              ],
            },
            status_api: {
              base_url: this.cfg.statusUrl,
              endpoints: ["/healthz", "/api/v1/public/status", "/api/v1/status", "/api/v1/admin/tokens"],
            },
            rpc_gateway: {
              url: this.cfg.rpcUrl,
              common_methods: ["eth_blockNumber", "eth_getLogs", "eth_getBlockByNumber"],
            },
          },
          indexed_locally: [
            "allMids",
            "trades",
            "l2Book top-of-book fields",
            "full browser-safe l2Book snapshots",
            "asset contexts from metaAndAssetCtxs",
            "derived l4_delta",
            "filtered liquidation_warning",
            "derived liquidation_cascade",
            "block_metrics",
            "consensus_pulse",
            "replica_cmd",
          ],
          recommended_paths: {
            mid_price: "grpc_get_mid_price or unified_get_all_mids",
            trades: "grpc_stream_mids_sample(subscription=trades) or unified_get_events(stream=trades)",
            l2_book: "unified_get_l2_book for browser-safe canonical snapshots; grpc_stream_mids_sample(subscription=l2Book) for top-of-book",
            l4_orderflow: "unified_get_stats and unified_get_events(stream=l4_delta)",
            funding_oi_volume: "unified_get_asset_contexts",
            liquidations: "grpc_stream_liquidations_sample first, unified_get_events(eventType=liquidation_warning) second, unified_get_liquidation_cascades for derived clusters",
            block_metrics: "unified_get_stats or unified_get_events(eventType=block_metrics)",
          },
        };
      case "grpc_get_mid_price":
        return this.clients.grpc.getMidPrice(String(argumentsPayload.coin ?? "BTC"));
      case "grpc_stream_mids_sample":
        return {
          messages: await this.clients.grpc.streamMids({
            coin: String(argumentsPayload.coin ?? "BTC"),
            subscription: String(argumentsPayload.subscription ?? "allMids") as "allMids" | "trades" | "l2Book",
            heartbeatS: Number(argumentsPayload.heartbeatS ?? 5),
            maxMessages: Number(argumentsPayload.maxMessages ?? 5),
          }),
        };
      case "grpc_get_block_number":
        return this.clients.grpc.getBlockNumber();
      case "grpc_stream_liquidations_sample":
        return {
          messages: await this.clients.grpc.streamLiquidations({
            coin: String(argumentsPayload.coin ?? "BTC"),
            heartbeatS: Number(argumentsPayload.heartbeatS ?? 1),
            maxMessages: Number(argumentsPayload.maxMessages ?? 5),
          }),
        };
      case "unified_get_stats":
        return this.clients.unified.stats();
      case "unified_get_events":
        return this.clients.unified.events({
          limit: Number(argumentsPayload.limit ?? 50),
          eventType: typeof argumentsPayload.eventType === "string" ? argumentsPayload.eventType : undefined,
          stream: typeof argumentsPayload.stream === "string" ? argumentsPayload.stream : undefined,
        });
      case "unified_get_liquidation_cascades":
        return this.clients.unified.liquidationCascades(Number(argumentsPayload.limit ?? 50));
      case "unified_get_consensus_pulse":
        return this.clients.unified.consensusPulse();
      case "unified_get_all_mids":
        return this.clients.unified.allMids(typeof argumentsPayload.dex === "string" ? argumentsPayload.dex : undefined);
      case "unified_get_l2_book":
        return this.clients.unified.getL2Book(String(argumentsPayload.coin ?? "BTC"), {
          dex: typeof argumentsPayload.dex === "string" ? argumentsPayload.dex : undefined,
          depth: argumentsPayload.depth === undefined ? undefined : Number(argumentsPayload.depth),
        });
      case "unified_get_asset_contexts":
        return this.clients.unified.getAssetContexts({
          coin: typeof argumentsPayload.coin === "string" ? argumentsPayload.coin : undefined,
          dex: typeof argumentsPayload.dex === "string" ? argumentsPayload.dex : undefined,
        });
      case "status_get_public":
        return this.clients.status.publicStatus();
      case "status_get_private":
        return this.clients.status.privateStatus();
      case "rpc_call": {
        const method = String(argumentsPayload.method ?? "");
        const params = Array.isArray(argumentsPayload.params) ? argumentsPayload.params : [];
        return {
          method,
          result: await this.clients.api.rpcCall(method, params),
        };
      }
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  async handleRequest(message: JsonRpcRequest): Promise<JsonRpcResponse | null> {
    const params = message.params ?? {};
    const id = message.id ?? null;

    if (message.method === "notifications/initialized") {
      return null;
    }

    if (message.method === "initialize") {
      const protocolVersion = typeof params.protocolVersion === "string" ? params.protocolVersion : DEFAULT_PROTOCOL_VERSION;
      return toJsonResponse(id, {
        protocolVersion,
        capabilities: { tools: {} },
        serverInfo: {
          name: "hypercore-ts-mcp",
          version: "0.1.0",
        },
      });
    }

    if (message.method === "ping") {
      return toJsonResponse(id, {});
    }

    if (message.method === "tools/list") {
      return toJsonResponse(id, { tools: this.tools });
    }

    if (message.method === "tools/call") {
      const name = typeof params.name === "string" ? params.name : "";
      const argumentsPayload =
        params.arguments && typeof params.arguments === "object" && !Array.isArray(params.arguments)
          ? (params.arguments as Record<string, unknown>)
          : {};
      try {
        const result = await this.callTool(name, argumentsPayload);
        return toJsonResponse(id, textContent(result));
      } catch (error) {
        const messageText = error instanceof Error ? error.message : String(error);
        return toJsonError(id, -32000, messageText);
      }
    }

    return toJsonError(id, -32601, `Unknown method: ${message.method}`);
  }
}

function parseHeaderBlock(block: string): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const line of block.split("\r\n")) {
    if (!line) {
      continue;
    }
    const idx = line.indexOf(":");
    if (idx < 0) {
      continue;
    }
    headers[line.slice(0, idx).trim().toLowerCase()] = line.slice(idx + 1).trim();
  }
  return headers;
}

async function writeMessage(payload: JsonRpcResponse): Promise<void> {
  const body = Buffer.from(JSON.stringify(payload), "utf8");
  stdout.write(`Content-Length: ${body.length}\r\n\r\n`);
  stdout.write(body);
}

export async function runMCPServer(server = new HypernodeMCPServer()): Promise<void> {
  let buffer = Buffer.alloc(0);

  for await (const chunk of stdin) {
    buffer = Buffer.concat([buffer, chunk as Buffer]);

    while (true) {
      const boundary = buffer.indexOf("\r\n\r\n");
      if (boundary < 0) {
        break;
      }

      const headerBlock = buffer.slice(0, boundary).toString("utf8");
      const headers = parseHeaderBlock(headerBlock);
      const contentLength = Number(headers["content-length"] ?? "0");
      const messageEnd = boundary + 4 + contentLength;
      if (!Number.isFinite(contentLength) || contentLength <= 0 || buffer.length < messageEnd) {
        break;
      }

      const body = buffer.slice(boundary + 4, messageEnd).toString("utf8");
      buffer = buffer.slice(messageEnd);

      const request = JSON.parse(body) as JsonRpcRequest;
      const response = await server.handleRequest(request);
      if (response) {
        await writeMessage(response);
      }
    }
  }
}
