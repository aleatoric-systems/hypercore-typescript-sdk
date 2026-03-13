# Changelog

## Unreleased

- added unified `liquidationCascades()` client helper and `unified_get_liquidation_cascades` MCP tool for derived liquidation clusters
- added typed unified client support for browser-safe `allMids`, canonical `l2Book`, and `metaAndAssetCtxs`-backed asset-context endpoints
- added unified stream SDK tests covering the new snapshot and SSE interfaces
- added a TypeScript stdio MCP server built on top of the SDK clients
- added typed service models for gRPC bridge, unified stream, liquidation feed, liquidation_cascade, block metrics, and status APIs
- added a typed status client and richer unified stream typing
- added SDK tests for MCP, status, and unified stream behavior including liquidation_cascade helpers
- added MCP Inspector validation and documentation for Claude Desktop, Cursor, Windsurf, Codex, and VS Code
