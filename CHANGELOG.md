# Changelog

All notable changes to this project are documented in this file.

## [0.3.0] - 2026-03-13

### Added

- Public package metadata for npm distribution, including exports, package contents, license, repository, and support fields.
- Customer-facing documentation, contribution guide, and runnable connection examples.
- A published TypeScript API interface reference.
- Branded GitHub-facing README assets, discoverability keywords, and production documentation.
- GitHub Actions workflows for CI and tagged releases.
- Release validation script using `npm pack --dry-run`.
- Typed helpers for unified liquidations, liquidation cascades, status APIs, and browser-safe market data surfaces.
- A stdio MCP server built directly on top of the SDK clients.
- MCP parity for browser-safe unified all-mids, L2 book, and asset-context tools.

### Changed

- Reframed the repository as a public Aleatoric Systems SDK for external customers.
- Standardized the README around installation, authentication, examples, release flow, and support.
- Expanded MCP test coverage from smoke checks to a tool-matrix contract.
- Improved package hygiene for publishable artifacts.

## [0.2.2] - 2026-03-12

### Added

- MCP Inspector validation and documentation for major MCP client environments.
- Typed service models for gRPC bridge, unified stream, liquidation feed, block metrics, and status APIs.
- Tests covering MCP, status, and unified stream behavior.
