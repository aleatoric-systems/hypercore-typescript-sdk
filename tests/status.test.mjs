import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { StatusClient } from "../dist/index.js";

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

test("status client fetches health, public, private, and admin payloads", async () => {
  const seen = [];
  const server = await withServer((req, res) => {
    seen.push({ url: req.url, auth: req.headers.authorization, token: req.headers["x-status-token"] });
    res.setHeader("content-type", "application/json");
    if (req.url === "/healthz") {
      res.end(JSON.stringify({ status: "ok", time: "2026-03-12T00:00:00Z" }));
      return;
    }
    if (req.url === "/api/v1/public/status") {
      res.end(JSON.stringify({ published_at: "t", delayed: true, delay_s: 120, snapshot: { captured_at: "t", captured_at_epoch: 1, service: { name: "status", uptime_s: 1, publish_delay_s: 120, day_utc: "2026-03-12" }, latency_ms: { private_rpc: { count: 1, last_ms: 1, avg_ms: 1, p50_ms: 1, p95_ms: 1, min_ms: 1, max_ms: 1 }, public_rpc: { count: 1, last_ms: 2, avg_ms: 2, p50_ms: 2, p95_ms: 2, min_ms: 2, max_ms: 2 } } } }));
      return;
    }
    if (req.url === "/api/v1/status") {
      res.end(JSON.stringify({ published_at: "t", delayed: true, delay_s: 120, snapshot: { captured_at: "t", captured_at_epoch: 1, service: { name: "status", uptime_s: 1, publish_delay_s: 120, day_utc: "2026-03-12" }, latency_ms: { private_rpc: { count: 1, last_ms: 1, avg_ms: 1, p50_ms: 1, p95_ms: 1, min_ms: 1, max_ms: 1 }, public_rpc: { count: 1, last_ms: 2, avg_ms: 2, p50_ms: 2, p95_ms: 2, min_ms: 2, max_ms: 2 } } } }));
      return;
    }
    if (req.url === "/api/v1/admin/tokens") {
      res.end(JSON.stringify({ published_at: "t", tokens: [], requests_by_category: {}, requests_by_service_type: {}, requests_by_key_status: {} }));
      return;
    }
    res.statusCode = 404;
    res.end(JSON.stringify({ error: "not_found" }));
  });

  try {
    const client = new StatusClient({
      rpcUrl: "http://unused",
      wsUrl: "ws://unused",
      infoUrl: "http://unused",
      unifiedStreamUrl: "http://unused",
      statusUrl: server.url,
      grpcTarget: "unused:443",
      timeoutMs: 2000,
      verifyTls: true,
      grpcTls: true,
      statusToken: "secret-token",
    });

    assert.equal((await client.health()).status, "ok");
    assert.equal((await client.publicStatus()).delayed, true);
    assert.equal((await client.privateStatus()).snapshot.service.name, "status");
    assert.deepEqual((await client.adminTokens()).tokens, []);

    const privateCall = seen.find((item) => item.url === "/api/v1/status");
    assert.equal(privateCall.auth, "Bearer secret-token");
    assert.equal(privateCall.token, "secret-token");
  } finally {
    await server.close();
  }
});
