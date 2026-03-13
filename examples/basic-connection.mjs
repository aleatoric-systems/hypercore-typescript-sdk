import { HyperCoreAPI, UnifiedStreamClient, loadConfig } from "../dist/index.js";

async function main() {
  const config = loadConfig();
  const api = new HyperCoreAPI(config);
  const btcMid = await api.coinMid("BTC");

  const stream = new UnifiedStreamClient({
    ...config,
    apiKey: process.env.UNIFIED_STREAM_KEY ?? config.apiKey,
  });
  const stats = await stream.stats();

  console.log(JSON.stringify({ btcMid, streamVersion: stats.version ?? null }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
