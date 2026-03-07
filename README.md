# Hypercore TypeScript SDK

TypeScript mirror of the Python SDK for:
- JSON-RPC access
- WebSocket price access
- gRPC health/price/stream/block access
- speed tests
- gRPC gateway template output

## Install

```bash
cd typescript-sdk
npm install
npm run build
```

## Defaults

- RPC URL: `https://rpc.aleatoric.systems/`
- gRPC target: `hl.grpc.aleatoric.systems:443`
- TLS-first by default

## Examples

```bash
node dist/cli.js rpc call --method eth_blockNumber --api-key "<API_KEY>"
node dist/cli.js price ws --coin BTC --subscription allMids
node dist/cli.js grpc health --target hl.grpc.aleatoric.systems:443
node dist/cli.js grpc price --target hl.grpc.aleatoric.systems:443 --api-key "<API_KEY>" --coin BTC
node dist/cli.js speed grpc-health --target hl.grpc.aleatoric.systems:443 --count 20
```

Lab-only plaintext fallback:

```bash
node dist/cli.js grpc health --target 10.0.0.4:50051 --plaintext
```
