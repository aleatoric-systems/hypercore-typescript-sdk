#!/usr/bin/env node
import { Command } from "commander";
import { HyperCoreAPI } from "./api.js";
import { loadConfig } from "./config.js";
import { GrpcClient } from "./grpc.js";
import { runGrpcHealthSpeedTest, runRpcSpeedTest, runWsSpeedTest } from "./speed.js";
import { renderNginxGrpcTemplate } from "./templates.js";
import { UnifiedStreamClient, UNIFIED_LIQUIDATION_CASCADE_EVENT_TYPE, UNIFIED_LIQUIDATION_EVENT_TYPE } from "./unified_stream.js";
import { getPriceFromWS } from "./ws.js";

type CommonNetOptions = {
  apiKey?: string;
  verifyTls?: boolean;
  timeout?: number;
};

type CommonGrpcOptions = {
  target?: string;
  plaintext?: boolean;
  serverName?: string;
  caCert?: string;
  apiKey?: string;
  timeout?: number;
};

const defaults = loadConfig();
const program = new Command();

function printJson(data: unknown): void {
  process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
}

function sdkApiFromOptions(opts: CommonNetOptions & { rpcUrl?: string; infoUrl?: string; wsUrl?: string }): HyperCoreAPI {
  return new HyperCoreAPI({
    ...defaults,
    rpcUrl: opts.rpcUrl ?? defaults.rpcUrl,
    infoUrl: opts.infoUrl ?? defaults.infoUrl,
    wsUrl: opts.wsUrl ?? defaults.wsUrl,
    apiKey: opts.apiKey ?? defaults.apiKey,
    timeoutMs: Math.round((opts.timeout ?? defaults.timeoutMs / 1000) * 1000),
    verifyTls: opts.verifyTls ?? defaults.verifyTls,
  });
}

function grpcClientFromOptions(opts: CommonGrpcOptions): GrpcClient {
  return new GrpcClient({
    target: opts.target ?? defaults.grpcTarget,
    timeoutMs: Math.round((opts.timeout ?? defaults.timeoutMs / 1000) * 1000),
    useTls: !opts.plaintext,
    serverName: opts.serverName ?? defaults.grpcServerName,
    apiKey: opts.apiKey ?? defaults.grpcApiKey ?? defaults.apiKey,
    caCertPath: opts.caCert ?? defaults.grpcCaCertPath,
  });
}

function unifiedStreamClientFromOptions(
  opts: CommonNetOptions & { streamUrl?: string },
): UnifiedStreamClient {
  return new UnifiedStreamClient({
    ...defaults,
    unifiedStreamUrl: opts.streamUrl ?? defaults.unifiedStreamUrl,
    apiKey: opts.apiKey ?? defaults.unifiedStreamApiKey ?? defaults.apiKey,
    timeoutMs: Math.round((opts.timeout ?? defaults.timeoutMs / 1000) * 1000),
    verifyTls: opts.verifyTls ?? defaults.verifyTls,
  });
}

function addCommonNetOptions(cmd: Command): void {
  cmd
    .option("--api-key <key>")
    .option("--no-verify-tls", "Disable TLS certificate verification")
    .option("--timeout <seconds>", "Timeout in seconds", (v) => Number(v), defaults.timeoutMs / 1000);
}

function addCommonGrpcOptions(cmd: Command, timeoutS: number): void {
  cmd
    .option("--target <host:port>", "gRPC host:port", defaults.grpcTarget)
    .option("--plaintext", "Disable TLS (lab-only)", false)
    .option("--server-name <name>", "TLS server name/SNI override")
    .option("--ca-cert <path>", "CA cert path for private PKI")
    .option("--api-key <key>")
    .option("--timeout <seconds>", "Timeout in seconds", (v) => Number(v), timeoutS);
}

program.name("hypercore-ts-sdk").description("TypeScript SDK CLI for Hypercore relay operations");

const price = program.command("price").description("Price access helpers");

addCommonNetOptions(
  price
    .command("ws")
    .description("Get price from WebSocket stream")
    .option("--ws-url <url>", "WS URL", defaults.wsUrl)
    .option("--coin <symbol>", "Coin symbol", "BTC")
    .option("--subscription <type>", "allMids|trades|l2Book", "allMids")
    .option("--raw-message", "Print full message", false)
    .action(async (opts) => {
      const result = await getPriceFromWS({
        wsUrl: opts.wsUrl,
        coin: opts.coin,
        subscriptionType: opts.subscription,
        timeoutMs: Math.round(opts.timeout * 1000),
        apiKey: opts.apiKey,
      });

      if (opts.rawMessage) {
        printJson(result);
        return;
      }

      printJson({
        coin: result.coin,
        price: result.price,
        channel: result.channel,
        latency_ms: result.latencyMs,
      });
    }),
);

addCommonNetOptions(
  price
    .command("info")
    .description("Get coin mid from allMids info API")
    .option("--info-url <url>", "Info URL", defaults.infoUrl)
    .option("--coin <symbol>", "Coin symbol", "BTC")
    .action(async (opts) => {
      const api = sdkApiFromOptions(opts);
      const priceValue = await api.coinMid(opts.coin);
      printJson({ coin: opts.coin, price: priceValue, source: "info/allMids" });
    }),
);

const rpc = program.command("rpc").description("JSON-RPC API access");
addCommonNetOptions(
  rpc
    .command("call")
    .description("Run a JSON-RPC method")
    .requiredOption("--method <name>", "JSON-RPC method")
    .option("--rpc-url <url>", "RPC URL", defaults.rpcUrl)
    .option("--params <json-array>", "JSON array params", "[]")
    .action(async (opts) => {
      const api = sdkApiFromOptions(opts);
      const params = JSON.parse(opts.params);
      if (!Array.isArray(params)) {
        throw new Error("--params must be a JSON array");
      }
      const result = await api.rpcCall(opts.method, params);
      printJson({ method: opts.method, result });
    }),
);

const stream = program.command("stream").description("Dedicated unified stream API");

addCommonNetOptions(
  stream
    .command("stats")
    .description("Get unified stream aggregate statistics")
    .option("--stream-url <url>", "Unified stream base URL", defaults.unifiedStreamUrl)
    .action(async (opts) => {
      const client = unifiedStreamClientFromOptions(opts);
      printJson(await client.stats());
    }),
);

addCommonNetOptions(
  stream
    .command("events")
    .description("Get unified stream pre-decoded events")
    .option("--stream-url <url>", "Unified stream base URL", defaults.unifiedStreamUrl)
    .option("--limit <n>", "Maximum events", (v) => Number(v), 200)
    .option("--event-type <type>", "Filter by event_type")
    .option("--stream <name>", "Filter by source stream name")
    .action(async (opts) => {
      const client = unifiedStreamClientFromOptions(opts);
      printJson(await client.events({ limit: opts.limit, eventType: opts.eventType, stream: opts.stream }));
    }),
);

addCommonNetOptions(
  stream
    .command("liquidations")
    .description("Get unified stream liquidation_warning events")
    .option("--stream-url <url>", "Unified stream base URL", defaults.unifiedStreamUrl)
    .option("--limit <n>", "Maximum events", (v) => Number(v), 200)
    .action(async (opts) => {
      const client = unifiedStreamClientFromOptions(opts);
      printJson(await client.liquidations(opts.limit));
    }),
);

addCommonNetOptions(
  stream
    .command("cascades")
    .description("Get unified stream liquidation_cascade events")
    .option("--stream-url <url>", "Unified stream base URL", defaults.unifiedStreamUrl)
    .option("--limit <n>", "Maximum events", (v) => Number(v), 200)
    .action(async (opts) => {
      const client = unifiedStreamClientFromOptions(opts);
      printJson(await client.liquidationCascades(opts.limit));
    }),
);

addCommonNetOptions(
  stream
    .command("consensus-pulse")
    .description("Get unified consensus pulse snapshot")
    .option("--stream-url <url>", "Unified stream base URL", defaults.unifiedStreamUrl)
    .action(async (opts) => {
      const client = unifiedStreamClientFromOptions(opts);
      printJson(await client.consensusPulse());
    }),
);

addCommonNetOptions(
  stream
    .command("sse")
    .description("Read a bounded number of SSE events")
    .option("--stream-url <url>", "Unified stream base URL", defaults.unifiedStreamUrl)
    .option("--max-events <n>", "Maximum events", (v) => Number(v), 20)
    .option("--event-type <type>", "Filter by event_type")
    .option("--stream <name>", "Filter by source stream name")
    .action(async (opts) => {
      const client = unifiedStreamClientFromOptions(opts);
      const events: Array<Record<string, unknown>> = [];
      for await (const event of client.sseEvents({
        maxEvents: opts.maxEvents,
        eventType: opts.eventType,
        stream: opts.stream,
      })) {
        events.push(event);
      }
      printJson({ events });
    }),
);

const grpcCmd = program.command("grpc").description("gRPC diagnostics and bridge access");

addCommonGrpcOptions(
  grpcCmd
    .command("health")
    .description("Run gRPC health check")
    .option("--service <name>", "Health service name", "")
    .action(async (opts) => {
      const client = grpcClientFromOptions(opts);
      printJson(await client.healthCheck(opts.service));
    }),
  5,
);

addCommonGrpcOptions(
  grpcCmd
    .command("list-services")
    .description("List services via grpcurl")
    .action(async (opts) => {
      const client = grpcClientFromOptions(opts);
      const services = await client.listServicesViaGrpcurl();
      printJson({ services });
    }),
  5,
);

addCommonGrpcOptions(
  grpcCmd
    .command("invoke")
    .description("Invoke arbitrary method using grpcurl")
    .requiredOption("--method <name>", "Fully qualified method name")
    .option("--request-json <json>", "Request JSON", "{}")
    .option("--insecure", "Skip TLS verification in grpcurl", false)
    .option("--proto <path>")
    .option("--import-path <path>")
    .action(async (opts) => {
      const client = grpcClientFromOptions(opts);
      const result = client.grpcurlInvoke({
        method: opts.method,
        requestJson: opts.requestJson,
        proto: opts.proto,
        importPath: opts.importPath,
        insecureTls: opts.insecure,
      });
      printJson(result);
      process.exitCode = result.returncode === 0 ? 0 : 2;
    }),
  8,
);

grpcCmd
  .command("setup-template")
  .description("Print Nginx gRPC gateway template")
  .requiredOption("--server-name <name>")
  .option("--upstream <host:port>", "Upstream gRPC service", "127.0.0.1:50051")
  .action((opts) => {
    process.stdout.write(renderNginxGrpcTemplate(opts.serverName, opts.upstream));
  });

addCommonGrpcOptions(
  grpcCmd
    .command("price")
    .description("Get mid price via bridge gRPC")
    .option("--coin <symbol>", "Coin symbol", "BTC")
    .action(async (opts) => {
      const client = grpcClientFromOptions(opts);
      printJson(await client.getMidPrice(opts.coin));
    }),
  5,
);

addCommonGrpcOptions(
  grpcCmd
    .command("stream")
    .description("Stream mid prices via bridge gRPC")
    .option("--coin <symbol>", "Coin symbol", "BTC")
    .option("--subscription <type>", "allMids|trades|l2Book", "allMids")
    .option("--heartbeat-s <seconds>", "Heartbeat seconds", (v) => Number(v), 10)
    .option("--max-messages <n>", "Max messages", (v) => Number(v), 5)
    .action(async (opts) => {
      const client = grpcClientFromOptions(opts);
      const messages = await client.streamMids({
        coin: opts.coin,
        subscription: opts.subscription,
        heartbeatS: opts.heartbeatS,
        maxMessages: opts.maxMessages,
      });
      printJson({ messages });
    }),
  30,
);

addCommonGrpcOptions(
  grpcCmd
    .command("liquidations")
    .description("Stream liquidation events via bridge gRPC")
    .option("--coin <symbol>", "Coin symbol", "BTC")
    .option("--heartbeat-s <seconds>", "Heartbeat seconds", (v) => Number(v), 1)
    .option("--max-messages <n>", "Max messages", (v) => Number(v), 20)
    .action(async (opts) => {
      const client = grpcClientFromOptions(opts);
      printJson({
        event_type: UNIFIED_LIQUIDATION_EVENT_TYPE,
        messages: await client.streamLiquidations({
          coin: opts.coin,
          heartbeatS: opts.heartbeatS,
          maxMessages: opts.maxMessages,
        }),
      });
    }),
  30,
);

addCommonGrpcOptions(
  grpcCmd
    .command("block-number")
    .description("Get block number via bridge gRPC")
    .action(async (opts) => {
      const client = grpcClientFromOptions(opts);
      printJson(await client.getBlockNumber());
    }),
  5,
);

const speed = program.command("speed").description("Latency and speed tests");

addCommonNetOptions(
  speed
    .command("rpc")
    .description("JSON-RPC latency test")
    .option("--rpc-url <url>", "RPC URL", defaults.rpcUrl)
    .option("--count <n>", "Number of calls", (v) => Number(v), 30)
    .action(async (opts) => {
      const api = sdkApiFromOptions(opts);
      printJson(await runRpcSpeedTest(api, opts.count));
    }),
);

addCommonNetOptions(
  speed
    .command("ws")
    .description("WS connect+first-price latency test")
    .option("--ws-url <url>", "WS URL", defaults.wsUrl)
    .option("--coin <symbol>", "Coin symbol", "BTC")
    .option("--subscription <type>", "allMids|trades|l2Book", "allMids")
    .option("--count <n>", "Number of runs", (v) => Number(v), 10)
    .action(async (opts) => {
      printJson(
        await runWsSpeedTest({
          wsUrl: opts.wsUrl,
          coin: opts.coin,
          subscriptionType: opts.subscription,
          count: opts.count,
          timeoutMs: Math.round(opts.timeout * 1000),
          apiKey: opts.apiKey,
        }),
      );
    }),
);

addCommonGrpcOptions(
  speed
    .command("grpc-health")
    .description("gRPC health-check latency test")
    .option("--service <name>", "Health service name", "")
    .option("--count <n>", "Number of probes", (v) => Number(v), 20)
    .action(async (opts) => {
      const client = grpcClientFromOptions(opts);
      printJson(await runGrpcHealthSpeedTest(client, opts.count, opts.service));
    }),
  5,
);

program
  .parseAsync(process.argv)
  .catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`error: ${message}\n`);
    process.exit(2);
  });
