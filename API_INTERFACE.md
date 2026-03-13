# Hypercore TypeScript SDK API Interface Reference

This document is the public interface contract for the TypeScript SDK in this repository.

Scope:

- npm package: `@aleatoric/hypercore-typescript-sdk`
- Runtime surfaces: JSON-RPC, Hyperliquid `/info`, WebSocket, gRPC, unified REST/SSE, status API
- Stdio MCP server built on top of the SDK clients

As-of validation (March 13, 2026):

- `npm test`: passed
- `npm pack --dry-run`: passed

## Core Exports

File: `src/index.ts`

- `HyperCoreAPI`
- `loadConfig`
- `GrpcClient`
- `StatusClient`
- `UnifiedStreamClient`
- `HypernodeMCPServer`
- `runMCPServer`
- `runGrpcHealthSpeedTest`
- `runRpcSpeedTest`
- `runWsSpeedTest`
- `renderNginxGrpcTemplate`

## Default Configuration

File: `src/config.ts`

- `rpcUrl`: `https://rpc.aleatoric.systems/`
- `infoUrl`: `https://api.hyperliquid.xyz/info`
- `wsUrl`: `wss://disk.grpc.aleatoric.systems/`
- `unifiedStreamUrl`: `https://unified.grpc.aleatoric.systems`
- `grpcTarget`: `hl.grpc.aleatoric.systems:443`
- `statusUrl`: `http://127.0.0.1:8090`

Auth precedence:

- Unified stream prefers `UNIFIED_STREAM_KEY`
- gRPC prefers `ALEATORIC_GRPC_KEY`
- Generic fallback is `HYPER_API_KEY`

## HyperCoreAPI

File: `src/api.ts`

- `rpcCall(method, params = [], requestId = 1)`
- `blockNumber()`
- `allMids()`
- `coinMid(coin)`

## UnifiedStreamClient

File: `src/unified_stream.ts`

- `stats()`
- `events({ limit, eventType, stream })`
- `liquidations(limit)`
- `liquidationCascades(limit)`
- `consensusPulse()`
- `allMids(dex?)`
- `getL2Book(coin, { dex?, depth? })`
- `getAssetContexts({ coin?, dex? })`
- `sseEvents({ maxEvents, eventType, stream })`
- `allMidsStream({ dex?, maxEvents? })`
- `streamL2Book(coin, { dex?, depth?, maxEvents? })`
- `streamAssetContexts({ coin?, dex?, maxEvents? })`

## StatusClient

File: `src/status.ts`

- `health()`
- `publicStatus()`
- `privateStatus()`
- `adminTokens()`

## MCP Tools

File: `src/mcp.ts`

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
