import { UnifiedStreamClient, loadConfig } from "../dist/index.js";

async function main() {
  const config = loadConfig();
  const client = new UnifiedStreamClient({
    ...config,
    apiKey: process.env.UNIFIED_STREAM_KEY ?? config.apiKey,
  });

  const events = await client.events({ limit: 5 });
  console.log(JSON.stringify(events, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
