import { SDKConfig } from "./config.js";
import { StatusAdminTokens, StatusHealth, StatusSnapshotEnvelope } from "./service_types.js";

export class StatusClient {
  constructor(private readonly cfg: SDKConfig) {}

  private endpoint(path: string): string {
    return `${this.cfg.statusUrl.replace(/\/+$/, "")}${path}`;
  }

  private authHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      accept: "application/json",
    };
    const token = this.cfg.statusToken;
    if (token) {
      headers.authorization = `Bearer ${token}`;
      headers["x-status-token"] = token;
    }
    return headers;
  }

  async health(): Promise<StatusHealth> {
    const response = await fetch(this.endpoint("/healthz"), {
      method: "GET",
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(this.cfg.timeoutMs),
    });
    if (!response.ok) {
      throw new Error(`Status health failed: ${response.status} ${response.statusText}`);
    }
    return (await response.json()) as StatusHealth;
  }

  async publicStatus(): Promise<StatusSnapshotEnvelope> {
    const response = await fetch(this.endpoint("/api/v1/public/status"), {
      method: "GET",
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(this.cfg.timeoutMs),
    });
    if (!response.ok) {
      throw new Error(`Public status failed: ${response.status} ${response.statusText}`);
    }
    return (await response.json()) as StatusSnapshotEnvelope;
  }

  async privateStatus(): Promise<StatusSnapshotEnvelope> {
    const response = await fetch(this.endpoint("/api/v1/status"), {
      method: "GET",
      headers: this.authHeaders(),
      signal: AbortSignal.timeout(this.cfg.timeoutMs),
    });
    if (!response.ok) {
      throw new Error(`Private status failed: ${response.status} ${response.statusText}`);
    }
    return (await response.json()) as StatusSnapshotEnvelope;
  }

  async adminTokens(): Promise<StatusAdminTokens> {
    const response = await fetch(this.endpoint("/api/v1/admin/tokens"), {
      method: "GET",
      headers: this.authHeaders(),
      signal: AbortSignal.timeout(this.cfg.timeoutMs),
    });
    if (!response.ok) {
      throw new Error(`Status admin tokens failed: ${response.status} ${response.statusText}`);
    }
    return (await response.json()) as StatusAdminTokens;
  }
}
