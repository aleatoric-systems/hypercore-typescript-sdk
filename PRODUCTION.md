# Production Documentation

## Service Identity

- Publisher: Aleatoric Systems
- Surface: public customer SDK and MCP client
- Compliance target: Aleatoric Engine API `v0.5.10`
- MCP protocol target: `2024-11-05`
- Transport envelope: JSON-RPC 2.0

## Production Endpoints

- RPC: `https://rpc.aleatoric.systems/`
- Unified stream: `https://unified.grpc.aleatoric.systems`
- gRPC target: `hl.grpc.aleatoric.systems:443`

## Authentication

- `HYPER_API_KEY`: generic fallback key
- `UNIFIED_STREAM_KEY`: preferred unified stream key
- `ALEATORIC_GRPC_KEY`: preferred gRPC key
- `HYPER_STATUS_TOKEN`: private status token

## Operational Expectations

- Read-only integration surface
- No signing or order placement
- TLS-first transport defaults
- MCP contract tested in CI

## Release Validation

```bash
npm install
npm run build
npm test
npm run validate:mcp:inspector
npm run release:check
```

## Support

- Email: [github@aleatoric.systems](mailto:github@aleatoric.systems)
- Discord: contact the Aleatoric Systems team for the current production support workspace
