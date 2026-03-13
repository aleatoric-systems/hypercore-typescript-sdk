# Examples

## Prerequisites

Set the environment variables required by the interface you want to test:

```bash
export HYPER_API_KEY="<rpc-key>"
export UNIFIED_STREAM_KEY="<unified-key>"
export ALEATORIC_GRPC_KEY="<grpc-key>"
```

## Available Examples

- `basic-connection.mjs`: verifies RPC and unified stream access
- `unified-stream-events.mjs`: fetches recent unified events

Run an example:

```bash
node examples/basic-connection.mjs
```
