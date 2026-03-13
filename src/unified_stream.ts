import { SDKConfig } from "./config.js";
import {
  UnifiedAllMidsSnapshot,
  UnifiedAssetContextsSnapshot,
  UnifiedConsensusPulseResponse,
  UnifiedEventEnvelope,
  UnifiedEventsQuery,
  UnifiedEventsResponse,
  UnifiedL2BookSnapshot,
  UnifiedLiquidationCascadeEvent,
  UnifiedLiquidationWarningEvent,
  UnifiedStatsResponse,
} from "./service_types.js";

export const UNIFIED_LIQUIDATION_EVENT_TYPE = "liquidation_warning";
export const UNIFIED_LIQUIDATION_CASCADE_EVENT_TYPE = "liquidation_cascade";
export type UnifiedEvent = UnifiedEventEnvelope;
export type UnifiedPayload = Record<string, unknown>;
export type { UnifiedEventsQuery };

export class UnifiedStreamClient {
  constructor(private readonly cfg: SDKConfig) {}

  private authHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      accept: "application/json",
    };
    const key = this.cfg.unifiedStreamApiKey ?? this.cfg.apiKey;
    if (key) {
      headers["x-api-key"] = key;
    }
    return headers;
  }

  private endpoint(path: string): string {
    return `${this.cfg.unifiedStreamUrl.replace(/\/+$/, "")}${path}`;
  }

  private buildEventsUrl(path: string, query: UnifiedEventsQuery = {}): URL {
    const url = new URL(this.endpoint(path));
    if (query.limit !== undefined) {
      url.searchParams.set("limit", String(Math.max(1, Math.trunc(query.limit))));
    }
    if (query.eventType) {
      url.searchParams.set("event_type", query.eventType);
    }
    if (query.stream) {
      url.searchParams.set("stream", query.stream);
    }
    return url;
  }

  private buildDataUrl(
    path: string,
    query: Record<string, string | number | boolean | undefined> = {},
  ): URL {
    const url = new URL(this.endpoint(path));
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === "") {
        continue;
      }
      url.searchParams.set(key, String(value));
    }
    return url;
  }

  private async getJson<T>(url: string | URL, label: string): Promise<T> {
    const response = await fetch(url, {
      method: "GET",
      headers: this.authHeaders(),
      signal: AbortSignal.timeout(this.cfg.timeoutMs),
    });

    if (!response.ok) {
      throw new Error(`${label} failed: ${response.status} ${response.statusText}`);
    }

    const payload = (await response.json()) as unknown;
    if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
      throw new Error(`Unexpected ${label} payload: ${JSON.stringify(payload)}`);
    }
    return payload as T;
  }

  async stats(): Promise<UnifiedStatsResponse> {
    return this.getJson<UnifiedStatsResponse>(this.endpoint("/api/v1/unified/stats"), "Unified stream stats");
  }

  async events(query: number | UnifiedEventsQuery = 200): Promise<UnifiedEventsResponse> {
    const options = typeof query === "number" ? { limit: query } : query;
    const url = this.buildEventsUrl("/api/v1/unified/events", options);
    return this.getJson<UnifiedEventsResponse>(url, "Unified stream events");
  }

  async liquidations(limit = 200): Promise<UnifiedEventsResponse<UnifiedLiquidationWarningEvent>> {
    return (await this.events({ limit, eventType: UNIFIED_LIQUIDATION_EVENT_TYPE })) as UnifiedEventsResponse<UnifiedLiquidationWarningEvent>;
  }

  async liquidationCascades(limit = 200): Promise<UnifiedEventsResponse<UnifiedLiquidationCascadeEvent>> {
    return (await this.events({ limit, eventType: UNIFIED_LIQUIDATION_CASCADE_EVENT_TYPE })) as UnifiedEventsResponse<UnifiedLiquidationCascadeEvent>;
  }

  async consensusPulse(): Promise<UnifiedConsensusPulseResponse> {
    return this.getJson<UnifiedConsensusPulseResponse>(this.endpoint("/api/v1/unified/consensus-pulse"), "Unified consensus pulse");
  }

  async allMids(dex?: string): Promise<UnifiedAllMidsSnapshot> {
    return this.getJson<UnifiedAllMidsSnapshot>(
      this.buildDataUrl("/api/v1/unified/all-mids", { dex }),
      "Unified allMids",
    );
  }

  async getL2Book(coin: string, options: { dex?: string; depth?: number } = {}): Promise<UnifiedL2BookSnapshot> {
    return this.getJson<UnifiedL2BookSnapshot>(
      this.buildDataUrl("/api/v1/unified/l2-book", { coin, dex: options.dex, depth: options.depth }),
      "Unified l2-book",
    );
  }

  async getAssetContexts(options: { dex?: string; coin?: string } = {}): Promise<UnifiedAssetContextsSnapshot> {
    return this.getJson<UnifiedAssetContextsSnapshot>(
      this.buildDataUrl("/api/v1/unified/asset-contexts", { dex: options.dex, coin: options.coin }),
      "Unified asset-contexts",
    );
  }

  async *allMidsStream(options: { dex?: string; maxEvents?: number } = {}): AsyncGenerator<UnifiedAllMidsSnapshot, void, unknown> {
    yield* this.sseDataStream<UnifiedAllMidsSnapshot>("/api/v1/unified/all-mids/stream", options);
  }

  async *streamL2Book(
    coin: string,
    options: { dex?: string; depth?: number; maxEvents?: number } = {},
  ): AsyncGenerator<UnifiedL2BookSnapshot, void, unknown> {
    yield* this.sseDataStream<UnifiedL2BookSnapshot>("/api/v1/unified/l2-book/stream", { coin, ...options });
  }

  async *streamAssetContexts(
    options: { dex?: string; coin?: string; maxEvents?: number } = {},
  ): AsyncGenerator<UnifiedAssetContextsSnapshot, void, unknown> {
    yield* this.sseDataStream<UnifiedAssetContextsSnapshot>("/api/v1/unified/asset-contexts/stream", options);
  }

  private async *sseDataStream<T extends Record<string, unknown>>(
    path: string,
    query: Record<string, string | number | boolean | undefined>,
  ): AsyncGenerator<T, void, unknown> {
    const target = Math.max(1, Math.trunc(Number(query.maxEvents ?? 20)));
    const response = await fetch(this.buildDataUrl(path, query), {
      method: "GET",
      headers: this.authHeaders(),
      signal: AbortSignal.timeout(this.cfg.timeoutMs),
    });

    if (!response.ok) {
      throw new Error(`Unified SSE failed: ${response.status} ${response.statusText}`);
    }
    if (!response.body) {
      throw new Error("Unified SSE response has no body.");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let emitted = 0;

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          break;
        }
        buffer += decoder.decode(value, { stream: true });

        let breakAt = buffer.indexOf("\n");
        while (breakAt >= 0) {
          const rawLine = buffer.slice(0, breakAt).replace(/\r$/, "");
          buffer = buffer.slice(breakAt + 1);
          breakAt = buffer.indexOf("\n");
          const line = rawLine.trim();
          if (!line || !line.startsWith("data:")) {
            continue;
          }
          const body = line.slice(5).trim();
          if (!body) {
            continue;
          }
          let parsed: unknown;
          try {
            parsed = JSON.parse(body);
          } catch {
            continue;
          }
          if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
            yield parsed as T;
            emitted += 1;
            if (emitted >= target) {
              return;
            }
          }
        }
      }
    } finally {
      await reader.cancel();
    }
  }

  async *sseEvents(
    options: number | (UnifiedEventsQuery & { maxEvents?: number }) = 20,
  ): AsyncGenerator<UnifiedEvent, void, unknown> {
    const normalized = typeof options === "number" ? { maxEvents: options } : options;
    const target = Math.max(1, Math.trunc(normalized.maxEvents ?? 20));
    const response = await fetch(this.buildEventsUrl("/api/v1/unified/stream", normalized), {
      method: "GET",
      headers: this.authHeaders(),
      signal: AbortSignal.timeout(this.cfg.timeoutMs),
    });

    if (!response.ok) {
      throw new Error(`Unified stream SSE failed: ${response.status} ${response.statusText}`);
    }
    if (!response.body) {
      throw new Error("Unified stream SSE response has no body.");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let emitted = 0;

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          break;
        }
        buffer += decoder.decode(value, { stream: true });

        let breakAt = buffer.indexOf("\n");
        while (breakAt >= 0) {
          const rawLine = buffer.slice(0, breakAt).replace(/\r$/, "");
          buffer = buffer.slice(breakAt + 1);
          breakAt = buffer.indexOf("\n");

          const line = rawLine.trim();
          if (!line || !line.startsWith("data:")) {
            continue;
          }

          const body = line.slice(5).trim();
          if (!body) {
            continue;
          }

          let parsed: unknown;
          try {
            parsed = JSON.parse(body);
          } catch {
            continue;
          }

          if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
            yield parsed as UnifiedEvent;
            emitted += 1;
            if (emitted >= target) {
              return;
            }
          }
        }
      }
    } finally {
      await reader.cancel();
    }
  }
}
