import { HyperCoreAPI } from "./api.js";
import { GrpcClient } from "./grpc.js";
import { summarizeLatencies } from "./stats.js";
import { getPriceFromWS } from "./ws.js";

export async function runRpcSpeedTest(api: HyperCoreAPI, count = 30) {
  const latencies: number[] = [];
  const errors: string[] = [];

  for (let i = 0; i < count; i += 1) {
    const start = performance.now();
    try {
      await api.blockNumber();
      latencies.push(performance.now() - start);
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }

  return {
    stats: summarizeLatencies(latencies),
    ok: latencies.length,
    failed: errors.length,
    errors: errors.slice(0, 5),
  };
}

export async function runWsSpeedTest(options: {
  wsUrl: string;
  coin?: string;
  subscriptionType?: "allMids" | "trades" | "l2Book";
  count?: number;
  timeoutMs?: number;
  apiKey?: string;
}) {
  const {
    wsUrl,
    coin = "BTC",
    subscriptionType = "allMids",
    count = 10,
    timeoutMs = 10_000,
    apiKey,
  } = options;

  const latencies: number[] = [];
  const errors: string[] = [];

  for (let i = 0; i < count; i += 1) {
    try {
      const result = await getPriceFromWS({ wsUrl, coin, subscriptionType, timeoutMs, apiKey });
      latencies.push(result.latencyMs);
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }

  return {
    stats: summarizeLatencies(latencies),
    ok: latencies.length,
    failed: errors.length,
    errors: errors.slice(0, 5),
  };
}

export async function runGrpcHealthSpeedTest(client: GrpcClient, count = 20, service = "") {
  return client.healthSpeedTest(count, service);
}
