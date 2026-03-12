import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { UnifiedStreamClient } from "../dist/index.js";

function withServer(routes) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => routes(req, res));
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("failed to bind test server"));
        return;
      }
      resolve({
        url: `http://127.0.0.1:${address.port}`,
        close: () => new Promise((done) => server.close(() => done())),
      });
    });
  });
}

test("unified stream client uses dedicated key and parses typed responses", async () => {
  const seen = [];
  const server = await withServer((req, res) => {
    seen.push({ url: req.url, key: req.headers["x-api-key"] });
    res.setHeader("content-type", "application/json");
    if (req.url === "/api/v1/unified/stats") {
      res.end(JSON.stringify({
        stats: {
          started_at: "2026-03-12T00:00:00Z",
          uptime_s: 10,
          events_total: 1,
          events_by_source: {},
          events_by_category: {},
          api_requests_total: 1,
          api_requests_unauthorized: 0,
          api_requests_rate_limited: 0,
          connected_stream_clients: 0,
          connected_disk_sync_clients: 0,
          latest_seq: 1,
          latency_us: {
            target_us: 500,
            processing: { count: 1, target_us: 500, target_hit_rate: 1, last_us: 1, avg_us: 1, p50_us: 1, p95_us: 1, min_us: 1, max_us: 1 },
            source_to_ingest: { count: 1, target_us: 500, target_hit_rate: 1, last_us: 1, avg_us: 1, p50_us: 1, p95_us: 1, min_us: 1, max_us: 1 },
            processing_by_stream: {},
            source_to_ingest_by_stream: {},
          },
          microstructure: {
            best_bid: null, best_ask: null, mid_px: null, spread: null,
            book_depths: { bid_levels: 0, ask_levels: 0, l2_bid_notional: 0, l2_ask_notional: 0, l4_bid_notional: 0, l4_ask_notional: 0 },
            l2: { snapshots_total: 0 },
            l4: { events_total: 0, upserts_total: 0, deletes_total: 0, cancellations_proxy_total: 0 },
            trades: { events_total: 0, volume_base_total: 0, notional_usd_total: 0, last_price: null, last_side: "" },
            blocks: { events_total: 0, last_block: null, last_size_bytes: 0, last_tx_count: 0, sample_count: 0, avg_size_bytes: 0, p95_size_bytes: 0, max_size_bytes: 0, avg_tx_count: 0, p95_tx_count: 0, max_tx_count: 0 }
          },
          disk_sync: { messages_total: 0, last_seq: 0, last_message_at: null },
          consensus_pulse: { captured_at: null, current_block_height: null, small_block_base_fee_gwei: 0, large_block_base_fee_gwei: 0, gas_delta_gwei: 0, tokyo_p2p_latency_ms: 0, error: "" }
        },
        time: "2026-03-12T00:00:00Z"
      }));
      return;
    }
    if (req.url?.startsWith("/api/v1/unified/events")) {
      res.end(JSON.stringify({
        events: [{
          source: "hypercore_ws",
          category: "trade",
          stream: "trades",
          event_type: "trade",
          symbol: "BTC",
          ts_ms: 1,
          ts_us: 1000,
          ingest_ts_ms: 2,
          ingest_ts_us: 2000,
          payload: { coin: "BTC", price: 1, size: 2, notional: 2, side: "b", trade_id: "1" }
        }],
        count: 1,
        time: "2026-03-12T00:00:00Z"
      }));
      return;
    }
    if (req.url === "/api/v1/unified/consensus-pulse") {
      res.end(JSON.stringify({
        consensus_pulse: {
          captured_at: "2026-03-12T00:00:00Z",
          current_block_height: 123,
          small_block_base_fee_gwei: 1,
          large_block_base_fee_gwei: 2,
          gas_delta_gwei: 1,
          tokyo_p2p_latency_ms: 10,
          error: ""
        },
        time: "2026-03-12T00:00:00Z"
      }));
      return;
    }
    res.statusCode = 404;
    res.end(JSON.stringify({ error: "not_found" }));
  });

  try {
    const client = new UnifiedStreamClient({
      rpcUrl: "http://unused",
      wsUrl: "ws://unused",
      infoUrl: "http://unused",
      unifiedStreamUrl: server.url,
      statusUrl: "http://unused",
      grpcTarget: "unused:443",
      timeoutMs: 2000,
      verifyTls: true,
      grpcTls: true,
      unifiedStreamApiKey: "unified-key",
    });

    const stats = await client.stats();
    const events = await client.events({ limit: 1, stream: "trades" });
    const pulse = await client.consensusPulse();

    assert.equal(stats.stats.latest_seq, 1);
    assert.equal(events.count, 1);
    assert.equal(events.events[0].event_type, "trade");
    assert.equal(pulse.consensus_pulse.current_block_height, 123);
    assert.ok(seen.every((item) => item.key === "unified-key"));
  } finally {
    await server.close();
  }
});
