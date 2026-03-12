export type SDKConfig = {
  rpcUrl: string;
  wsUrl: string;
  infoUrl: string;
  unifiedStreamUrl: string;
  statusUrl: string;
  grpcTarget: string;
  apiKey?: string;
  unifiedStreamApiKey?: string;
  grpcApiKey?: string;
  statusToken?: string;
  timeoutMs: number;
  verifyTls: boolean;
  grpcTls: boolean;
  grpcServerName?: string;
  grpcCaCertPath?: string;
};

function envBool(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined) {
    return fallback;
  }
  return ["1", "true", "yes", "on"].includes(raw.trim().toLowerCase());
}

export function loadConfig(): SDKConfig {
  return {
    rpcUrl: process.env.HYPER_RPC_URL ?? "https://rpc.aleatoric.systems/",
    wsUrl: process.env.HYPER_WS_URL ?? "wss://api.hyperliquid.xyz/ws",
    infoUrl: process.env.HYPER_INFO_URL ?? "https://api.hyperliquid.xyz/info",
    unifiedStreamUrl: process.env.HYPER_UNIFIED_STREAM_URL ?? "https://unified.grpc.aleatoric.systems",
    statusUrl: process.env.HYPER_STATUS_URL ?? "http://127.0.0.1:8090",
    grpcTarget: process.env.HYPER_GRPC_TARGET ?? "hl.grpc.aleatoric.systems:443",
    apiKey: process.env.HYPER_API_KEY,
    unifiedStreamApiKey: process.env.UNIFIED_STREAM_KEY ?? process.env.HYPER_UNIFIED_STREAM_API_KEY,
    grpcApiKey: process.env.ALEATORIC_GRPC_KEY ?? process.env.HYPER_GRPC_API_KEY,
    statusToken: process.env.HYPER_STATUS_TOKEN,
    timeoutMs: Number.parseInt(process.env.HYPER_TIMEOUT_MS ?? "10000", 10),
    verifyTls: envBool("HYPER_VERIFY_TLS", true),
    grpcTls: envBool("HYPER_GRPC_TLS", true),
    grpcServerName: process.env.HYPER_GRPC_SERVER_NAME,
    grpcCaCertPath: process.env.HYPER_GRPC_CA_CERT,
  };
}
