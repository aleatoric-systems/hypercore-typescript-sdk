import WebSocket from "ws";

export type WSPriceResult = {
  coin: string;
  price: number;
  channel: string;
  latencyMs: number;
  message: unknown;
};

function extractPrice(channel: string, payload: any, coin: string): number | null {
  const data = payload?.data;

  if (channel === "allMids" && data && typeof data === "object") {
    const mids = data.mids;
    if (mids && typeof mids === "object" && mids[coin] !== undefined) {
      return Number(mids[coin]);
    }
  }

  if (channel === "trades" && Array.isArray(data) && data.length > 0) {
    const first = data[0];
    if (first?.coin === coin && first?.px !== undefined) {
      return Number(first.px);
    }
  }

  if (channel === "l2Book" && data && typeof data === "object") {
    if (data.coin !== coin) {
      return null;
    }
    const levels = data.levels;
    if (Array.isArray(levels) && levels.length >= 2 && Array.isArray(levels[0]) && Array.isArray(levels[1]) && levels[0].length > 0 && levels[1].length > 0) {
      const bestBid = Number(levels[0][0]?.px);
      const bestAsk = Number(levels[1][0]?.px);
      if (Number.isFinite(bestBid) && Number.isFinite(bestAsk)) {
        return (bestBid + bestAsk) / 2;
      }
    }
  }

  return null;
}

export async function getPriceFromWS(options: {
  wsUrl: string;
  coin?: string;
  subscriptionType?: "allMids" | "trades" | "l2Book";
  timeoutMs?: number;
  apiKey?: string;
}): Promise<WSPriceResult> {
  const {
    wsUrl,
    coin = "BTC",
    subscriptionType = "allMids",
    timeoutMs = 10_000,
    apiKey,
  } = options;

  const headers: Record<string, string> = {};
  if (apiKey) {
    headers["x-api-key"] = apiKey;
  }

  const subscription: Record<string, string> = { type: subscriptionType };
  if (subscriptionType === "trades" || subscriptionType === "l2Book") {
    subscription.coin = coin;
  }

  const started = performance.now();

  return new Promise<WSPriceResult>((resolve, reject) => {
    const ws = new WebSocket(wsUrl, { headers });

    const timer = setTimeout(() => {
      ws.close();
      reject(new Error(`WebSocket timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    ws.on("open", () => {
      ws.send(JSON.stringify({ method: "subscribe", subscription }));
    });

    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        const channel = msg?.channel;
        if (channel === "subscriptionResponse" || channel === "pong") {
          return;
        }

        const price = extractPrice(channel, msg, coin);
        if (price === null) {
          return;
        }

        clearTimeout(timer);
        ws.close();

        resolve({
          coin,
          price,
          channel,
          latencyMs: Number((performance.now() - started).toFixed(3)),
          message: msg,
        });
      } catch (err) {
        clearTimeout(timer);
        ws.close();
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });

    ws.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });

    ws.on("close", () => {
      clearTimeout(timer);
    });
  });
}
