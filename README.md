# Aleatoric Hypercore TypeScript SDK

The Aleatoric Hypercore TypeScript SDK provides read-only access to Hyperliquid market data and infrastructure exposed through Aleatoric Systems. It is designed for customer-facing integrations that need a typed Node.js client, CLI tooling, and an MCP server for operator workflows.

## Features

- JSON-RPC access for chain and relay methods
- WebSocket pricing helpers
- Unified stream access for stats, events, SSE, liquidations, cascades, all-mids, L2 book, and asset contexts
- gRPC diagnostics and bridge consumers
- Status API client
- Stdio MCP server built on the same SDK primitives
- CLI utilities for connection checks and latency benchmarking

This SDK is intentionally read-only. It does not include signing, custody, or order-placement flows.

## Requirements

- Node.js 20 or later
- npm 10 or later

## Installation

Install from source:

```bash
npm install
npm run build
```

Install as a package:

```bash
npm install @aleatoric/hypercore-typescript-sdk
```

## Default Endpoints

- RPC: `https://rpc.aleatoric.systems/`
- Unified stream: `https://unified.grpc.aleatoric.systems`
- gRPC target: `hl.grpc.aleatoric.systems:443`

## Authentication

The SDK supports a general `HYPER_API_KEY`, but scoped keys are preferred:

- `UNIFIED_STREAM_KEY` for unified stream and disk-sync interfaces
- `ALEATORIC_GRPC_KEY` for gRPC bridge access
- `HYPER_STATUS_TOKEN` for private status endpoints

## Quickstart

### Library connection

```ts
import { HyperCoreAPI, UnifiedStreamClient, loadConfig } from "@aleatoric/hypercore-typescript-sdk";

const config = loadConfig();

const api = new HyperCoreAPI(config);
const btcMid = await api.coinMid("BTC");
console.log({ btcMid });

const stream = new UnifiedStreamClient({
  ...config,
  apiKey: process.env.UNIFIED_STREAM_KEY,
});

const stats = await stream.stats();
console.log(stats);
```

### CLI connection checks

```bash
npx hypercore-ts-sdk rpc call --method eth_blockNumber --api-key "$HYPER_API_KEY"
npx hypercore-ts-sdk price ws --coin BTC --subscription allMids
npx hypercore-ts-sdk stream stats --api-key "$UNIFIED_STREAM_KEY"
npx hypercore-ts-sdk grpc health --target hl.grpc.aleatoric.systems:443
```

### MCP server

```bash
export HYPER_GRPC_TARGET="hl.grpc.aleatoric.systems:443"
export ALEATORIC_GRPC_KEY="<grpc-key>"
export HYPER_UNIFIED_STREAM_URL="https://unified.grpc.aleatoric.systems"
export UNIFIED_STREAM_KEY="<unified-key>"
export HYPER_RPC_URL="https://rpc.aleatoric.systems/"
export HYPER_API_KEY="<rpc-key>"

npx hypercore-ts-mcp
```

The MCP server exposes:

- `catalog_interfaces`
- `grpc_get_mid_price`
- `grpc_stream_mids_sample`
- `grpc_get_block_number`
- `grpc_stream_liquidations_sample`
- `unified_get_stats`
- `unified_get_events`
- `unified_get_liquidation_cascades`
- `unified_get_consensus_pulse`
- `unified_get_all_mids`
- `unified_get_l2_book`
- `unified_get_asset_contexts`
- `status_get_public`
- `status_get_private`
- `rpc_call`

## Examples

- [examples/README.md](examples/README.md)
- [examples/basic-connection.mjs](examples/basic-connection.mjs)
- [examples/unified-stream-events.mjs](examples/unified-stream-events.mjs)

Run an example:

```bash
node examples/basic-connection.mjs
```

## Development

```bash
npm install
npm run build
npm test
npm run validate:mcp:inspector
npm run release:check
```

## Release Process

- CI runs on pushes and pull requests.
- Tags matching `v*` produce release artifacts and a GitHub Release.
- `npm pack --dry-run` is used during release validation to confirm package contents.

## Support

- Email: [github@aleatoric.systems](mailto:github@aleatoric.systems)
- Discord: contact the Aleatoric Systems team for the active customer support server and onboarding channel

## Documentation

- [CHANGELOG.md](CHANGELOG.md)
- [CONTRIBUTING.md](CONTRIBUTING.md)
- [API_INTERFACE.md](API_INTERFACE.md)
- [LICENSE](LICENSE)
