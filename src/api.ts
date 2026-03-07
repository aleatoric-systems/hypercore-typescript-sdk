import { SDKConfig } from "./config.js";

export class HyperCoreAPI {
  constructor(private readonly cfg: SDKConfig) {}

  async rpcCall(method: string, params: unknown[] = [], requestId = 1): Promise<unknown> {
    const body = {
      jsonrpc: "2.0",
      method,
      params,
      id: requestId,
    };

    const headers: Record<string, string> = {
      "content-type": "application/json",
    };
    if (this.cfg.apiKey) {
      headers["x-api-key"] = this.cfg.apiKey;
    }

    const response = await fetch(this.cfg.rpcUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.cfg.timeoutMs),
    });

    if (!response.ok) {
      throw new Error(`RPC request failed: ${response.status} ${response.statusText}`);
    }

    const payload = (await response.json()) as { result?: unknown; error?: unknown };
    if (payload.error !== undefined) {
      throw new Error(`RPC error: ${JSON.stringify(payload.error)}`);
    }
    return payload.result;
  }

  async blockNumber(): Promise<number> {
    const result = await this.rpcCall("eth_blockNumber", []);
    if (typeof result !== "string" || !result.startsWith("0x")) {
      throw new Error(`Unexpected blockNumber payload: ${JSON.stringify(result)}`);
    }
    return Number.parseInt(result, 16);
  }

  async allMids(): Promise<Record<string, string>> {
    const response = await fetch(this.cfg.infoUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "allMids" }),
      signal: AbortSignal.timeout(this.cfg.timeoutMs),
    });

    if (!response.ok) {
      throw new Error(`Info request failed: ${response.status} ${response.statusText}`);
    }

    const payload = (await response.json()) as unknown;
    if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
      throw new Error(`Unexpected allMids payload: ${JSON.stringify(payload)}`);
    }

    const output: Record<string, string> = {};
    for (const [k, v] of Object.entries(payload as Record<string, unknown>)) {
      output[String(k)] = String(v);
    }
    return output;
  }

  async coinMid(coin: string): Promise<number> {
    const mids = await this.allMids();
    const raw = mids[coin];
    if (raw === undefined) {
      throw new Error(`Coin ${coin} not present in allMids response`);
    }
    return Number.parseFloat(raw);
  }
}
