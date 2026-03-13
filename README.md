# Hypercore TypeScript SDK

![MCP Inspector Validated](https://img.shields.io/badge/MCP%20Inspector-validated-2ea043)

TypeScript mirror of the Python SDK for:
- JSON-RPC access
- WebSocket price access
- dedicated unified stream access (stats, filtered events, liquidation feed, browser-safe allMids/L2/asset-context snapshots, SSE, consensus pulse)
- typed status API access
- gRPC health/price/stream/liquidations/block access
- stdio MCP server built on top of the SDK clients
- speed tests
- gRPC gateway template output

This SDK is read-only/data-plane only. Signing and order placement are intentionally excluded.

## Install

```bash
cd typescript-sdk
npm install
npm run build
npm test
npm run validate:mcp:inspector
```

## Defaults

- RPC URL: `https://rpc.aleatoric.systems/`
- Unified stream URL: `https://unified.grpc.aleatoric.systems`
- gRPC target: `hl.grpc.aleatoric.systems:443`
- TLS-first by default

## Key Requirements

- Unified API/SSE requires a `unified_stream` key with scope `stream:read`.
- Disk-Sync WS uses the same unified-stream key class.
- gRPC relay uses the gateway key class (`ALEATORIC_GRPC_KEY` preferred, `HYPER_GRPC_API_KEY` fallback).
- The SDK also supports a generic `HYPER_API_KEY`, but surface-specific keys are preferred:
  - `UNIFIED_STREAM_KEY`
  - `ALEATORIC_GRPC_KEY`

## Examples

```bash
node dist/cli.js rpc call --method eth_blockNumber --api-key "<API_KEY>"
node dist/cli.js price ws --coin BTC --subscription allMids
node dist/cli.js stream stats --stream-url https://unified.grpc.aleatoric.systems --api-key "<UNIFIED_STREAM_KEY>"
node dist/cli.js stream events --limit 100 --event-type liquidation_warning --api-key "<UNIFIED_STREAM_KEY>"
node dist/cli.js stream liquidations --limit 50 --api-key "<UNIFIED_STREAM_KEY>"
node dist/cli.js stream sse --max-events 10 --event-type liquidation_warning --api-key "<UNIFIED_STREAM_KEY>"
node dist/cli.js stream consensus-pulse --api-key "<UNIFIED_STREAM_KEY>"
node dist/cli.js grpc health --target hl.grpc.aleatoric.systems:443
node dist/cli.js grpc price --target hl.grpc.aleatoric.systems:443 --api-key "<ALEATORIC_GRPC_KEY>" --coin BTC
node dist/cli.js grpc liquidations --target hl.grpc.aleatoric.systems:443 --api-key "<ALEATORIC_GRPC_KEY>" --coin BTC --max-messages 20
node dist/cli.js speed grpc-health --target hl.grpc.aleatoric.systems:443 --count 20
hypercore-ts-mcp
```

## Unified Browser-Safe Market Data

The unified client now exposes the browser-safe surfaces added to the hypernode:

- `allMids()` and `allMidsStream()`
- `getL2Book()` and `streamL2Book()`
- `getAssetContexts()` and `streamAssetContexts()`

These endpoints are intended for browser or edge runtimes that cannot use `@grpc/grpc-js` directly but still need low-latency canonical market data.

## TypeScript MCP

The SDK now ships a stdio MCP server built on top of the SDK clients instead of a separate transport stack.

Binary:

- `hypercore-ts-mcp`

Key env vars:

- `HYPER_GRPC_TARGET`
- `ALEATORIC_GRPC_KEY`
- `HYPER_UNIFIED_STREAM_URL`
- `UNIFIED_STREAM_KEY`
- `HYPER_RPC_URL`
- `HYPER_API_KEY`
- `HYPER_STATUS_URL`
- `HYPER_STATUS_TOKEN`

### Startup

Build the SDK first:

```bash
cd /Users/jaws/research/dev/aleatoric/public/hypercore-typescript-sdk
npm install
npm run build
```

Run the MCP server directly:

```bash
cd /Users/jaws/research/dev/aleatoric/public/hypercore-typescript-sdk
HYPER_GRPC_TARGET="hl.grpc.aleatoric.systems:443" \
ALEATORIC_GRPC_KEY="<GRPC_KEY>" \
HYPER_UNIFIED_STREAM_URL="https://unified.grpc.aleatoric.systems" \
UNIFIED_STREAM_KEY="<UNIFIED_KEY>" \
HYPER_RPC_URL="https://rpc.aleatoric.systems/" \
HYPER_API_KEY="<RPC_KEY>" \
HYPER_STATUS_URL="http://127.0.0.1:8090" \
HYPER_STATUS_TOKEN="<STATUS_TOKEN>" \
node dist/mcp_cli.js
```

Or, if installed globally or linked locally:

```bash
hypercore-ts-mcp
```

The MCP server exposes these tools:

- `catalog_interfaces`
- `grpc_get_mid_price`
- `grpc_stream_mids_sample`
- `grpc_get_block_number`
- `grpc_stream_liquidations_sample`
- `unified_get_stats`
- `unified_get_events`
- `unified_get_consensus_pulse`
- `status_get_public`
- `status_get_private`
- `rpc_call`

Validation commands:

```bash
npm test
npm run validate:mcp:inspector
```

### Claude Desktop

Claude Code documents stdio MCP servers with a `mcpServers` JSON object and `command`/`args` entries, and notes that Claude Desktop uses `claude_desktop_config.json`.

Add this server entry:

```json
{
  "mcpServers": {
    "hypercore-ts-mcp": {
      "type": "stdio",
      "command": "node",
      "args": [
        "/Users/jaws/research/dev/aleatoric/public/hypercore-typescript-sdk/dist/mcp_cli.js"
      ],
      "env": {
        "HYPER_GRPC_TARGET": "hl.grpc.aleatoric.systems:443",
        "ALEATORIC_GRPC_KEY": "<GRPC_KEY>",
        "HYPER_UNIFIED_STREAM_URL": "https://unified.grpc.aleatoric.systems",
        "UNIFIED_STREAM_KEY": "<UNIFIED_KEY>",
        "HYPER_RPC_URL": "https://rpc.aleatoric.systems/",
        "HYPER_API_KEY": "<RPC_KEY>",
        "HYPER_STATUS_URL": "http://127.0.0.1:8090",
        "HYPER_STATUS_TOKEN": "<STATUS_TOKEN>"
      }
    }
  }
}
```

How to use:

1. Build the SDK.
2. Open Claude Desktop config and add the JSON above.
3. Restart Claude Desktop.
4. Ask Claude to use tools like `grpc_get_mid_price` or `unified_get_events`.

### Cursor

Cursor documents MCP servers through `mcp.json`, with project config in `.cursor/mcp.json` and global config in `~/.cursor/mcp.json`.

Project-local config:

```json
{
  "mcpServers": {
    "hypercore-ts-mcp": {
      "command": "node",
      "args": [
        "/Users/jaws/research/dev/aleatoric/public/hypercore-typescript-sdk/dist/mcp_cli.js"
      ],
      "env": {
        "HYPER_GRPC_TARGET": "hl.grpc.aleatoric.systems:443",
        "ALEATORIC_GRPC_KEY": "<GRPC_KEY>",
        "HYPER_UNIFIED_STREAM_URL": "https://unified.grpc.aleatoric.systems",
        "UNIFIED_STREAM_KEY": "<UNIFIED_KEY>",
        "HYPER_RPC_URL": "https://rpc.aleatoric.systems/",
        "HYPER_API_KEY": "<RPC_KEY>",
        "HYPER_STATUS_URL": "http://127.0.0.1:8090",
        "HYPER_STATUS_TOKEN": "<STATUS_TOKEN>"
      }
    }
  }
}
```

How to use:

1. Save the file as `.cursor/mcp.json` in your workspace or `~/.cursor/mcp.json` globally.
2. Reload Cursor.
3. Confirm the MCP server appears in Cursor tools.
4. Use Composer/Agent normally; Cursor can invoke the tools when relevant.

### Windsurf

Windsurf documents MCP config in `~/.codeium/mcp_config.json` and supports stdio servers via `command`, `args`, and `env`.

Config:

```json
{
  "mcpServers": {
    "hypercore-ts-mcp": {
      "command": "node",
      "args": [
        "/Users/jaws/research/dev/aleatoric/public/hypercore-typescript-sdk/dist/mcp_cli.js"
      ],
      "env": {
        "HYPER_GRPC_TARGET": "hl.grpc.aleatoric.systems:443",
        "ALEATORIC_GRPC_KEY": "<GRPC_KEY>",
        "HYPER_UNIFIED_STREAM_URL": "https://unified.grpc.aleatoric.systems",
        "UNIFIED_STREAM_KEY": "<UNIFIED_KEY>",
        "HYPER_RPC_URL": "https://rpc.aleatoric.systems/",
        "HYPER_API_KEY": "<RPC_KEY>",
        "HYPER_STATUS_URL": "http://127.0.0.1:8090",
        "HYPER_STATUS_TOKEN": "<STATUS_TOKEN>"
      }
    }
  }
}
```

How to use:

1. Open Windsurf `Settings` > `Tools` > `Windsurf Settings` > `Add Server`, or edit `~/.codeium/mcp_config.json`.
2. Add the config above.
3. Refresh MCP plugins.
4. Expose the server to Cascade and use the tools from chat.

### Codex

On this machine, the Codex CLI exposes MCP management through `codex mcp add`, `codex mcp list`, and related commands.

Add the server:

```bash
codex mcp add hypercore-ts-mcp \
  --env HYPER_GRPC_TARGET=hl.grpc.aleatoric.systems:443 \
  --env ALEATORIC_GRPC_KEY=<GRPC_KEY> \
  --env HYPER_UNIFIED_STREAM_URL=https://unified.grpc.aleatoric.systems \
  --env UNIFIED_STREAM_KEY=<UNIFIED_KEY> \
  --env HYPER_RPC_URL=https://rpc.aleatoric.systems/ \
  --env HYPER_API_KEY=<RPC_KEY> \
  --env HYPER_STATUS_URL=http://127.0.0.1:8090 \
  --env HYPER_STATUS_TOKEN=<STATUS_TOKEN> \
  -- node /Users/jaws/research/dev/aleatoric/public/hypercore-typescript-sdk/dist/mcp_cli.js
```

Verify:

```bash
codex mcp list
```

How to use:

1. Build the SDK.
2. Run the `codex mcp add` command above.
3. Confirm it appears in `codex mcp list`.
4. Restart Codex if needed so the new server is loaded.

### VS Code

VS Code documents MCP config in `mcp.json`, with workspace config in `.vscode/mcp.json`, user config in the MCP user profile, and CLI installation via `code --add-mcp`.

Workspace config:

```json
{
  "servers": {
    "hypercore-ts-mcp": {
      "type": "stdio",
      "command": "node",
      "args": [
        "/Users/jaws/research/dev/aleatoric/public/hypercore-typescript-sdk/dist/mcp_cli.js"
      ],
      "env": {
        "HYPER_GRPC_TARGET": "hl.grpc.aleatoric.systems:443",
        "ALEATORIC_GRPC_KEY": "<GRPC_KEY>",
        "HYPER_UNIFIED_STREAM_URL": "https://unified.grpc.aleatoric.systems",
        "UNIFIED_STREAM_KEY": "<UNIFIED_KEY>",
        "HYPER_RPC_URL": "https://rpc.aleatoric.systems/",
        "HYPER_API_KEY": "<RPC_KEY>",
        "HYPER_STATUS_URL": "http://127.0.0.1:8090",
        "HYPER_STATUS_TOKEN": "<STATUS_TOKEN>"
      }
    }
  }
}
```

CLI alternative:

```bash
code --add-mcp "{\"name\":\"hypercore-ts-mcp\",\"command\":\"node\",\"args\":[\"/Users/jaws/research/dev/aleatoric/public/hypercore-typescript-sdk/dist/mcp_cli.js\"]}"
```

How to use:

1. Save the JSON above as `.vscode/mcp.json`, or use `code --add-mcp`.
2. Open VS Code chat/agent mode.
3. Trust and start the server when prompted.
4. Use MCP tools from chat or via MCP server management commands.

Current production feed setup notes:

- `hypercore-grpc-bridge` exposes liquidation topics and the bridge-side `StreamLiquidations` path.
- The unified sidecar is configured with `UNIFIED_LIQUIDATION_TOPICS=0x8c7f585fb295f7eb1e6aeb8fba61b23a4fe60beda405f0045073b185c74412e3`.
- Hyperliquid node runtime includes `--write-misc-events`, so unified `event_type=liquidation_warning` filters can be derived from node data.

Lab-only plaintext fallback:

```bash
node dist/cli.js grpc health --target 10.0.0.4:50051 --plaintext
```
