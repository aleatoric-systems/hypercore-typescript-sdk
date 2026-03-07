import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import { summarizeLatencies } from "./stats.js";

export type GrpcConnectionConfig = {
  target: string;
  timeoutMs?: number;
  useTls?: boolean;
  serverName?: string;
  apiKey?: string;
  caCertPath?: string;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROTO_DIR = path.resolve(__dirname, "../proto");

const LOADER_OPTS: protoLoader.Options = {
  keepCase: false,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
};

const BRIDGE_DEF = protoLoader.loadSync(path.join(PROTO_DIR, "hypercore_bridge.proto"), LOADER_OPTS);
const BRIDGE_PKG = grpc.loadPackageDefinition(BRIDGE_DEF) as any;
const PRICE_SERVICE_CTOR = BRIDGE_PKG.hypercore.bridge.v1.PriceService;

const HEALTH_DEF = protoLoader.loadSync(path.join(PROTO_DIR, "health.proto"), LOADER_OPTS);
const HEALTH_PKG = grpc.loadPackageDefinition(HEALTH_DEF) as any;
const HEALTH_SERVICE_CTOR = HEALTH_PKG.grpc.health.v1.Health;

function buildMetadata(apiKey?: string): grpc.Metadata {
  const md = new grpc.Metadata();
  if (apiKey) {
    md.set("x-api-key", apiKey);
  }
  return md;
}

function buildChannelOptions(serverName?: string): grpc.ChannelOptions {
  if (!serverName) {
    return {};
  }
  return {
    "grpc.ssl_target_name_override": serverName,
  };
}

function buildCredentials(cfg: GrpcConnectionConfig): grpc.ChannelCredentials {
  if (cfg.useTls === false) {
    return grpc.credentials.createInsecure();
  }
  let caCert: Buffer | undefined;
  if (cfg.caCertPath) {
    caCert = fs.readFileSync(cfg.caCertPath);
  }
  return grpc.credentials.createSsl(caCert);
}

function deadline(timeoutMs: number): grpc.CallOptions {
  return { deadline: Date.now() + timeoutMs };
}

export class GrpcClient {
  private readonly timeoutMs: number;
  private readonly md: grpc.Metadata;
  private readonly callOptions: grpc.CallOptions;
  private readonly healthClient: any;
  private readonly priceClient: any;
  private readonly cfg: GrpcConnectionConfig;

  constructor(cfg: GrpcConnectionConfig) {
    this.cfg = cfg;
    this.timeoutMs = cfg.timeoutMs ?? 5000;
    this.md = buildMetadata(cfg.apiKey);
    this.callOptions = deadline(this.timeoutMs);

    const creds = buildCredentials(cfg);
    const options = buildChannelOptions(cfg.serverName);

    this.healthClient = new HEALTH_SERVICE_CTOR(cfg.target, creds, options);
    this.priceClient = new PRICE_SERVICE_CTOR(cfg.target, creds, options);
  }

  private unary<TReq, TResp>(client: any, method: string, req: TReq): Promise<TResp> {
    return new Promise<TResp>((resolve, reject) => {
      client[method](req, this.md, this.callOptions, (err: grpc.ServiceError | null, resp: TResp) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(resp);
      });
    });
  }

  async healthCheck(service = ""): Promise<{ status: string; latency_ms: number }> {
    const started = performance.now();
    const response = await this.unary<{ service: string }, { status: string }>(this.healthClient, "Check", { service });
    return {
      status: response.status,
      latency_ms: Number((performance.now() - started).toFixed(3)),
    };
  }

  async listServicesViaGrpcurl(): Promise<string[]> {
    const result = this.grpcurlInvoke({
      method: "list",
      requestJson: "{}",
      specialListMode: true,
    });
    if (result.returncode !== 0) {
      throw new Error(result.stderr || "grpcurl list failed");
    }
    return result.stdout
      .split(/\r?\n/)
      .map((x) => x.trim())
      .filter((x) => x.length > 0);
  }

  async getMidPrice(coin = "BTC"): Promise<{
    coin: string;
    price: number;
    ts_ms: string;
    source: string;
    channel: string;
    latency_ms: number;
  }> {
    const started = performance.now();
    const response = await this.unary<{ coin: string }, any>(this.priceClient, "GetMidPrice", { coin });
    return {
      coin: response.coin,
      price: Number(response.price),
      ts_ms: String(response.tsMs ?? response.ts_ms),
      source: response.source,
      channel: response.channel,
      latency_ms: Number((performance.now() - started).toFixed(3)),
    };
  }

  async getBlockNumber(): Promise<{ hex: string; number: string; ts_ms: string; latency_ms: number }> {
    const started = performance.now();
    const response = await this.unary<Record<string, never>, any>(this.priceClient, "GetBlockNumber", {});
    return {
      hex: response.hex,
      number: String(response.number),
      ts_ms: String(response.tsMs ?? response.ts_ms),
      latency_ms: Number((performance.now() - started).toFixed(3)),
    };
  }

  async streamMids(options: {
    coin?: string;
    subscription?: "allMids" | "trades" | "l2Book";
    heartbeatS?: number;
    maxMessages?: number;
  } = {}): Promise<Array<{ coin: string; price: number; ts_ms: string; source: string; channel: string }>> {
    const {
      coin = "BTC",
      subscription = "allMids",
      heartbeatS = 10,
      maxMessages = 5,
    } = options;

    const req = { coin, subscription, heartbeatS };

    return new Promise((resolve, reject) => {
      const out: Array<{ coin: string; price: number; ts_ms: string; source: string; channel: string }> = [];
      const stream = this.priceClient.StreamMids(req, this.md, {
        deadline: Date.now() + Math.max(this.timeoutMs, heartbeatS * maxMessages * 1000 + 2_000),
      });

      stream.on("data", (item: any) => {
        out.push({
          coin: item.coin,
          price: Number(item.price),
          ts_ms: String(item.tsMs ?? item.ts_ms),
          source: item.source,
          channel: item.channel,
        });
        if (out.length >= maxMessages) {
          stream.cancel();
          resolve(out);
        }
      });

      stream.on("end", () => {
        resolve(out);
      });

      stream.on("error", (err: Error) => {
        if (out.length > 0) {
          resolve(out);
          return;
        }
        reject(err);
      });
    });
  }

  async healthSpeedTest(count = 20, service = ""): Promise<{
    stats: ReturnType<typeof summarizeLatencies>;
    ok: number;
    failed: number;
    errors: string[];
  }> {
    const latencies: number[] = [];
    const errors: string[] = [];

    for (let i = 0; i < count; i += 1) {
      try {
        const res = await this.healthCheck(service);
        latencies.push(res.latency_ms);
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

  grpcurlInvoke(options: {
    method: string;
    requestJson?: string;
    proto?: string;
    importPath?: string;
    insecureTls?: boolean;
    specialListMode?: boolean;
  }): { command: string[]; returncode: number; stdout: string; stderr: string } {
    const {
      method,
      requestJson = "{}",
      proto,
      importPath,
      insecureTls = false,
      specialListMode = false,
    } = options;

    const cmd: string[] = ["grpcurl", "-max-time", String(Math.ceil(this.timeoutMs / 1000))];

    if (this.cfg.useTls === false) {
      cmd.push("-plaintext");
    } else if (insecureTls) {
      cmd.push("-insecure");
    } else if (this.cfg.caCertPath) {
      cmd.push("-cacert", this.cfg.caCertPath);
    }

    if (this.cfg.serverName) {
      cmd.push("-authority", this.cfg.serverName);
    }

    if (this.cfg.apiKey) {
      cmd.push("-H", `x-api-key: ${this.cfg.apiKey}`);
    }

    if (proto) {
      cmd.push("-proto", proto);
    }

    if (importPath) {
      cmd.push("-import-path", importPath);
    }

    if (specialListMode) {
      cmd.push(this.cfg.target, method);
    } else {
      cmd.push("-d", requestJson, this.cfg.target, method);
    }

    const proc = spawnSync(cmd[0], cmd.slice(1), { encoding: "utf8" });
    return {
      command: cmd,
      returncode: proc.status ?? 1,
      stdout: proc.stdout?.trim() ?? "",
      stderr: proc.stderr?.trim() ?? "",
    };
  }
}
