# WorldMonitor Sebuf Integration

## What This Is

A full-stack migration of WorldMonitor's 80+ API integrations from ad-hoc fetch-based service modules to sebuf-powered, proto-defined domain services. The existing scattered service layer (RSS feeds, market data, military tracking, geopolitical intel, cyber threats, etc.) gets reorganized into clearly bounded domains with `.proto` service definitions, generated type-safe TypeScript clients, and eventually generated server handlers — all while maintaining dual-mode compatibility so existing HTTP calls work alongside the new sebuf layer until migration is verified complete.

## Core Value

Every API integration in WorldMonitor is defined in a `.proto` file with clear domain ownership, and the app uses generated sebuf clients to call them — eliminating hand-written fetch boilerplate, enforcing type safety, and making the entire API surface self-documenting.

## Requirements

### Validated

- 80+ external API integrations working across news, markets, military, geopolitical, environmental, cyber, and research domains — existing
- RSS feed aggregation with 50+ sources across news, defense, AI, government, think tanks — existing
- Market data from Finnhub, Yahoo Finance, CoinGecko, Polymarket — existing
- Military/transport tracking via OpenSky, AIS, Wingbits, FAA, ADS-B — existing
- Geopolitical data from ACLED, UCDP, GDELT, EONET, HAPI, UNHCR — existing
- Cyber threat intel from URLhaus, ThreatFox, AlienVault OTX, AbuseIPDB — existing
- Economic data from FRED, USA Spending, World Bank, EIA — existing
- Natural hazard monitoring from USGS, NASA FIRMS, GDACS — existing
- Feature flag system controlling API availability at runtime — existing
- Circuit breaker pattern for API failure handling — existing
- Persistent caching layer (IndexedDB + localStorage + Tauri file system) — existing
- WebSocket relay infrastructure for AIS, OpenSky, World Bank — existing

### Active

- [ ] Domain taxonomy: organize all API integrations into bounded domain services (News, Markets, Military, Geopolitical, Environmental, Cyber, Economic, Research/Tech, Infrastructure)
- [ ] Proto file definitions for each domain service with sebuf HTTP annotations
- [ ] Generated TypeScript sebuf clients for all domain services
- [ ] Dual-mode architecture: existing HTTP fetch calls work alongside new sebuf clients
- [ ] Server handler interfaces generated from proto definitions (sebuf TS server)
- [ ] Server implementations proxying to upstream external APIs
- [ ] Service layer cleanup: consolidate scattered service files into domain-aligned modules
- [ ] Feature parity verification between legacy and sebuf paths
- [ ] Legacy code removal after verified parity

### Out of Scope

- Changing external API contracts — we wrap what exists, we don't change upstream APIs
- Adding new data sources — this is about reorganization, not new integrations
- UI/component changes — the presentation layer stays untouched, only the data-fetching layer changes
- Changing the caching strategy — existing cache layer remains, sebuf layer sits above it
- gRPC/binary protobuf transport — sebuf generates HTTP/JSON, no binary transport needed
- Authentication system changes — API key management stays as-is

## Context

- WorldMonitor is a vanilla TypeScript SPA (no framework) with 80+ service modules in `src/services/`
- sebuf (github.com/sebastienmelki/sebuf) is the maintainer's own proto-to-HTTP toolkit — TS client gen is done, TS server gen is in progress
- sebuf generates zero-dependency TypeScript clients from `.proto` files with HTTP annotations
- sebuf is fully backwards compatible with any HTTP API format — annotations control path, method, query params, headers, encoding
- The server side generates handler interfaces + route descriptors from protos — implementation fills in the business logic (here: proxying to upstream APIs)
- Proto files can be written now even though TS server codegen isn't finished — the `.proto` definitions are the contract
- Current services are ad-hoc: each `src/services/*.ts` file manually constructs fetch calls, parses responses, handles errors independently
- Some services share patterns (circuit breakers, caching), others don't — inconsistent error handling across the board
- WebSocket-based services (AIS, OpenSky relay) need special consideration — sebuf is HTTP-focused
- Two build variants (full geopolitical, tech/startup) share the same service layer
- Desktop (Tauri) and web (Vercel) deployments have different proxy strategies (sidecar vs edge functions vs Railway relay)

## Constraints

- **Sebuf TS server not finished**: Proto files and client integration can start now; server implementation waits for sebuf TS server codegen to be ready
- **Backwards compatible**: Dual-mode operation required — never break the existing app during migration
- **Zero new runtime deps for clients**: sebuf clients use only Fetch API — matches existing approach
- **Proto definitions must match existing API shapes**: Use sebuf annotations (unwrap, flatten, encoding controls) to match current JSON response shapes exactly
- **WebSocket services out of sebuf scope**: AIS stream, OpenSky WebSocket relay stay as-is — sebuf handles HTTP only
- **Both variants must work**: Full geopolitical and tech/startup builds both need the migrated service layer

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Group by data type, not UI panel | APIs serve multiple panels; data-type domains are the natural boundary | -- Pending |
| Dual-mode during migration | Allows incremental migration with feature parity testing before legacy removal | -- Pending |
| Proto files first, server later | Proto definitions are the contract; client codegen works now; server codegen arrives when ready | -- Pending |
| Keep WebSocket services outside sebuf | sebuf is HTTP-focused; WS services (AIS, OpenSky) stay as custom implementations | -- Pending |
| Server lives in this repo | Generated server code will proxy to upstream APIs — it's WorldMonitor-specific | -- Pending |

---
*Last updated: 2026-02-18 after initialization*
