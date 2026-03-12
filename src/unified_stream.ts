import { SDKConfig } from "./config.js";
import {
  UnifiedConsensusPulseResponse,
  UnifiedEventEnvelope,
  UnifiedEventsQuery,
  UnifiedEventsResponse,
  UnifiedLiquidationWarningEvent,
  UnifiedStatsResponse,
} from "./service_types.js";

export const UNIFIED_LIQUIDATION_EVENT_TYPE = "liquidation_warning";
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

  async stats(): Promise<UnifiedStatsResponse> {
    const response = await fetch(this.endpoint("/api/v1/unified/stats"), {
      method: "GET",
      headers: this.authHeaders(),
      signal: AbortSignal.timeout(this.cfg.timeoutMs),
    });

    if (!response.ok) {
      throw new Error(`Unified stream stats failed: ${response.status} ${response.statusText}`);
    }

    const payload = (await response.json()) as unknown;
    if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
      throw new Error(`Unexpected unified stream stats payload: ${JSON.stringify(payload)}`);
    }
    return payload as UnifiedStatsResponse;
  }

  async events(query: number | UnifiedEventsQuery = 200): Promise<UnifiedEventsResponse> {
    const options = typeof query === "number" ? { limit: query } : query;
    const url = this.buildEventsUrl("/api/v1/unified/events", options);
    const response = await fetch(url, {
      method: "GET",
      headers: this.authHeaders(),
      signal: AbortSignal.timeout(this.cfg.timeoutMs),
    });

    if (!response.ok) {
      throw new Error(`Unified stream events failed: ${response.status} ${response.statusText}`);
    }

    const payload = (await response.json()) as unknown;
    if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
      throw new Error(`Unexpected unified stream events payload: ${JSON.stringify(payload)}`);
    }
    return payload as UnifiedEventsResponse;
  }

  async liquidations(limit = 200): Promise<UnifiedEventsResponse<UnifiedLiquidationWarningEvent>> {
    return (await this.events({ limit, eventType: UNIFIED_LIQUIDATION_EVENT_TYPE })) as UnifiedEventsResponse<UnifiedLiquidationWarningEvent>;
  }

  async consensusPulse(): Promise<UnifiedConsensusPulseResponse> {
    const response = await fetch(this.endpoint("/api/v1/unified/consensus-pulse"), {
      method: "GET",
      headers: this.authHeaders(),
      signal: AbortSignal.timeout(this.cfg.timeoutMs),
    });

    if (!response.ok) {
      throw new Error(`Unified consensus pulse failed: ${response.status} ${response.statusText}`);
    }

    const payload = (await response.json()) as unknown;
    if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
      throw new Error(`Unexpected unified consensus pulse payload: ${JSON.stringify(payload)}`);
    }
    return payload as UnifiedConsensusPulseResponse;
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
