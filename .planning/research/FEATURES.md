# Feature Landscape

**Domain:** Protobuf-driven HTTP API migration layer for WorldMonitor (sebuf integration)
**Researched:** 2026-02-18
**Confidence:** HIGH (based on direct codebase analysis of 80+ services, sebuf SDK reference, and existing generated code patterns)

## Table Stakes

Features the migration layer must have or the project fails. Missing any of these means the migration cannot ship.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Proto file definitions for all 9 domains | This IS the migration -- no proto files, no project | High | ~40-50 proto files covering News, Markets, Military, Geopolitical, Environmental, Cyber, Economic, Research/Tech, Infrastructure |
| Generated TypeScript client types | Replaces the hand-written interfaces currently scattered across 80+ service files | Low | sebuf + protoc-gen-ts_proto already handle this; the work is writing correct protos |
| Query parameter mapping via `sebuf.http.query` | Most existing APIs use query params (Finnhub symbols, FRED series_id, HN type/limit, arXiv category, etc.) | Medium | Every GET endpoint needs query annotations; ~60% of services use query params |
| Path variable support | APIs like Finnhub, Yahoo Finance, CoinGecko use parameterized paths | Low | sebuf already supports `{id}` syntax in `sebuf.http.config.path` |
| Service base path configuration | Each domain service needs a base path prefix (e.g., `/api/markets`, `/api/cyber`) | Low | Use `sebuf.http.service_config.base_path` option on each service |
| HTTP method annotations (GET/POST) | All proxy endpoints are GET; some upstream APIs use POST (cyber threats batch, ACLED) | Low | Default is POST; most WorldMonitor endpoints need explicit `HTTP_METHOD_GET` |
| Dual-mode client adapter | Existing fetch calls MUST continue working during migration; new sebuf clients used for migrated services | High | Core risk of the project -- needs a switchover mechanism per service |
| Response shape matching via proto messages | Proto response messages must produce JSON that matches existing response shapes exactly | High | Requires careful field naming, optional vs required, nested message structures |
| Circuit breaker integration | Every current service uses `createCircuitBreaker()` -- generated clients must plug into this | Medium | Wrap sebuf client calls in existing CircuitBreaker.execute() pattern |
| Feature flag compatibility | `isFeatureAvailable()` gates currently control 14 API integrations -- must still work | Low | Feature flags are checked before calling services, not inside them; layer above generated clients |
| Error handling parity | Current services return empty arrays/defaults on failure; generated clients must do the same | Medium | Need error mapping from HTTP status codes to fallback values per service |
| Persistent cache compatibility | IndexedDB/localStorage cache layer (`getPersistentCache`/`setPersistentCache`) must work with generated types | Medium | Serialization format must match; proto-generated types must be JSON-serializable |
| Multi-proxy URL resolution | Services use different proxy strategies: direct `/api/X`, Railway relay, Tauri sidecar, production fallback | High | Polymarket alone has 4 fetch strategies; proxy resolution must be configurable per service |

## Differentiators

Features that make this migration worth doing beyond "same thing with different syntax." These justify the effort.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Domain-organized proto file structure | Currently 80+ flat files in `src/services/`; protos group by domain (`worldmonitor/markets/v1/`, `worldmonitor/cyber/v1/`, etc.) | Medium | This is the primary organizational win -- bounded domain services instead of ad-hoc files |
| Self-documenting API surface | Proto files with comments and field annotations become the single source of truth for every external API integration | Low | The proto files themselves serve as living documentation; eliminates stale README.md API lists |
| Consistent error types across domains | Currently each service has its own error handling pattern (some use `.error`, some `.success`, some throw, some return empty) | Medium | Define `worldmonitor.core.v1.Error` and `worldmonitor.core.v1.ApiStatus` messages shared across all services |
| Generated server handler interfaces | When sebuf TS server codegen lands, server handlers are auto-generated from the same protos | Medium | The `/api/*.js` Vercel edge functions become implementations of generated handler interfaces; eliminates handler/client drift |
| Request validation via `buf.validate` | No validation exists today on client requests; query params are manually clamped (see `clampInt` in cyber-threats.ts) | Medium | Add `buf.validate` annotations for things like `min_len`, `int32` ranges, enum constraints |
| OpenAPI documentation generation | `protoc-gen-openapiv3` generates OpenAPI specs from the same proto files | Low | Free documentation for all 80+ API endpoints; useful for debugging and onboarding |
| Batch request coalescing | Multiple calls to same service (e.g., `fetchSeriesData` called 7x for FRED) could be a single batch RPC | Medium | Define `BatchGetSeries` RPCs; reduces HTTP round trips from 7 to 1 for FRED |
| Type-safe response unwrapping | Currently manual `.json()` casts like `await response.json() as FinnhubResponse` -- unsafe at runtime | Medium | sebuf-generated types guarantee shape; unwrap annotations flatten nested responses |
| Enum standardization | Types like `CyberThreatSeverity`, `FlightDelaySeverity`, `ProtestSeverity` are string unions today; protos make them proper enums | Low | Proto enums with `string_enums=true` produce the same runtime values but with proto-backed validation |
| Shared message reuse across services | Types like `GeoCoordinates { lat, lon }`, `TimeRange { start, end }`, `PaginationParams` are duplicated across services | Low | Define once in `worldmonitor/core/v1/`, import everywhere |
| API parity test generation | Proto definitions can drive automated comparison tests: call legacy fetch, call sebuf client, diff results | High | The killer feature for safe migration -- proves each service produces identical output |
| Domain service health dashboard | With standardized service interfaces, can auto-generate a health status page from proto service registry | Low | Replaces the manual `getCircuitBreakerStatus()` registry with proto-driven discovery |

## Anti-Features

Features to explicitly NOT build. These look tempting but would derail the migration.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Binary protobuf transport | sebuf is HTTP/JSON; binary encoding adds complexity for zero benefit in a browser SPA | Keep JSON transport. The value is type safety and organization, not wire format. |
| gRPC-Web integration | gRPC-Web requires a proxy, complicates Vercel edge deployment, and adds runtime deps | Use sebuf HTTP annotations. The existing REST-style endpoints are fine. |
| WebSocket service migration | AIS, OpenSky relay are WebSocket-based; sebuf is HTTP-only | Explicitly exclude WebSocket services from proto migration. They stay as-is in `src/services/ais.ts` and friends. |
| New data source integration | Tempting to add new APIs during migration | Freeze the API surface. Only wrap what exists today. New sources come after migration completes. |
| UI component changes | Tempting to "improve the UI while we're in there" | The presentation layer stays untouched. Only the data-fetching layer changes. |
| Custom protobuf runtime | Building a bespoke protobuf parser/serializer for the browser | Use `protoc-gen-ts_proto` with `onlyTypes=true` and `stringEnums=true`. Zero runtime deps. |
| Server-side caching layer in proto | Defining cache TTLs as proto options or annotations | Keep existing cache layer (IndexedDB + localStorage + Tauri FS) untouched. Sebuf layer sits above it. |
| Auth/API key management in proto | Tempting to model API key handling as proto service headers | API keys are managed by Vercel env vars and Tauri keyring. The client never sees API keys directly. Keep this separation. |
| Monolithic "WorldMonitorService" | One giant proto service with 80+ RPCs | Split into 9+ domain services. A monolith defeats the organizational purpose. |
| Automated legacy code deletion | Auto-removing old service files after migration | Manual deletion after verified parity tests pass. Automated deletion is too risky for a brownfield migration. |

## Feature Dependencies

```
Proto file structure (core/v1)
  -> Domain proto definitions (markets/v1, cyber/v1, etc.)
    -> Generated TS client types
      -> Dual-mode adapter
        -> Service-by-service migration
          -> Parity tests
            -> Legacy removal

Shared messages (core/v1: GeoCoordinates, TimeRange, Error)
  -> All domain protos import core/v1

buf.validate annotations
  -> Requires proto definitions first
  -> Server handler generation (when sebuf TS server lands)
    -> Automated validation on incoming requests

OpenAPI generation
  -> Requires all proto files written
  -> Runs as a CI step (not runtime)

Batch request coalescing
  -> Requires individual RPCs working first
  -> Is an optimization, not a migration requirement
```

## Detailed Feature Specifications

### 1. Proto Domain Organization

The 80+ services map to 9 proto domain packages. Each domain gets its own directory under a `worldmonitor/` namespace.

| Domain | Package | Proto Services | Key RPCs | Current Files |
|--------|---------|---------------|----------|---------------|
| **Core** | `worldmonitor.core.v1` | (shared types only) | N/A -- shared messages | `src/types/index.ts` (partial) |
| **News/RSS** | `worldmonitor.news.v1` | `NewsFeedService` | `FetchFeed`, `FetchCategoryFeeds`, `ClassifyThreat` | `rss.ts`, `live-news.ts`, `threat-classifier.ts` |
| **Markets** | `worldmonitor.markets.v1` | `MarketDataService`, `CryptoService`, `PredictionService` | `GetStockQuotes`, `GetCryptoMarkets`, `GetPredictions` | `markets.ts`, `polymarket.ts` |
| **Military** | `worldmonitor.military.v1` | `FlightTrackingService`, `VesselTrackingService` | `GetMilitaryFlights`, `GetVesselPositions`, `GetFlightDelays` | `military-flights.ts`, `military-vessels.ts`, `flights.ts`, `wingbits.ts` |
| **Geopolitical** | `worldmonitor.geopolitical.v1` | `ConflictService`, `DisplacementService`, `EventService` | `GetConflicts`, `GetProtests`, `GetDisplacement`, `GetGdeltTensions` | `conflicts.ts`, `protests.ts`, `ucdp.ts`, `ucdp-events.ts`, `unhcr.ts`, `gdelt-intel.ts`, `hapi.ts` |
| **Environmental** | `worldmonitor.environmental.v1` | `NaturalHazardService`, `ClimateService` | `GetEarthquakes`, `GetFires`, `GetDisasters`, `GetClimateAnomalies` | `earthquakes.ts`, `firms-satellite.ts`, `gdacs.ts`, `eonet.ts`, `climate.ts`, `weather.ts` |
| **Cyber** | `worldmonitor.cyber.v1` | `ThreatIntelService` | `GetCyberThreats`, `GetThreatMeta` | `cyber-threats.ts` |
| **Economic** | `worldmonitor.economic.v1` | `EconomicDataService`, `EnergyService` | `GetFredSeries`, `GetSpending`, `GetWorldBankIndicators`, `GetOilAnalytics` | `fred.ts`, `usa-spending.ts`, `worldbank.ts`, `oil-analytics.ts` |
| **Research** | `worldmonitor.research.v1` | `ResearchService`, `TechActivityService` | `GetArxivPapers`, `GetGithubTrending`, `GetHackerNews` | `arxiv.ts`, `github-trending.ts`, `hackernews.ts` |
| **Infrastructure** | `worldmonitor.infrastructure.v1` | `OutageService`, `IntelService` | `GetOutages`, `GetPizzInt`, `GetNgaWarnings` | `outages.ts`, `pizzint.ts` |

### 2. Dual-Mode Client Adapter

The critical migration enabler. This is not generated by sebuf -- it is custom glue code.

**Pattern:**
```typescript
// src/services/adapters/dual-mode.ts
type FetchStrategy = 'legacy' | 'sebuf';

interface DualModeConfig {
  service: string;
  strategy: FetchStrategy;  // controlled by feature flag or runtime config
}

// Each migrated service exports both:
// - legacy function (existing fetch-based implementation)
// - sebuf client call (generated from proto)
// The adapter routes to the active strategy
```

**Per-service switchover:** Each service independently flips from legacy to sebuf. This allows incremental migration with rollback capability.

**Rollback safety:** If a sebuf client produces different results than legacy, flip back to legacy immediately. Parity tests catch this before production.

### 3. Response Shape Matching

The hardest technical challenge. Current services define response interfaces inline:

```typescript
// Current: src/services/markets.ts
interface FinnhubResponse {
  quotes: FinnhubQuote[];
  error?: string;
  skipped?: boolean;
  reason?: string;
}
```

The proto message must produce identical JSON:

```protobuf
// Target: worldmonitor/markets/v1/finnhub.proto
message FinnhubResponse {
  repeated FinnhubQuote quotes = 1;
  optional string error = 2;
  optional bool skipped = 3;
  optional string reason = 4;
}
```

**Known complications:**
- `Date` objects in TypeScript (e.g., `Earthquake.time`, `NewsItem.pubDate`) become `google.protobuf.Timestamp` or ISO strings in proto
- `Map<string, T>` patterns (e.g., `feedCache`, `lastCallbackTimestampByMmsi`) need `map<string, T>` in proto
- `null | number` patterns (e.g., `MarketData.price`, `FredSeries.value`) need `optional` or wrapper types
- Inline union types (`'low' | 'medium' | 'high'`) become proto enums with `stringEnums=true`

### 4. Multi-Proxy URL Resolution

Current proxy strategies across services:

| Strategy | Used By | Pattern |
|----------|---------|---------|
| Vite dev proxy / Vercel edge | Most services | `/api/earthquakes` |
| Railway relay | Polymarket, OpenSky, AIS, World Bank | `VITE_WS_RELAY_URL` prefix + path |
| Tauri sidecar | Desktop runtime | `http://127.0.0.1:46123/api/...` |
| Direct external API | Earthquakes (USGS), some fallbacks | Full upstream URL |
| Multi-strategy cascade | Polymarket (browser direct -> Tauri -> Railway -> Vercel -> production fallback) | 4-layer fallback chain |

The sebuf client layer must support configurable base URLs per service, with the existing `proxyUrl()` and `fetchWithProxy()` utilities integrated.

### 5. Parity Testing Strategy

For each migrated service, automated tests must verify:

1. **Request equivalence:** sebuf client sends the same HTTP request as legacy fetch
2. **Response parsing equivalence:** sebuf-generated types parse the same as manual `response.json() as T`
3. **Error handling equivalence:** failures produce the same fallback behavior
4. **Cache key compatibility:** if a service writes to persistent cache, the key/format must match

**Test approach:** Snapshot-based. Capture real API responses, run through both legacy and sebuf paths, assert identical output.

### 6. Services Out of Scope (WebSocket + Analysis)

These services are NOT part of the proto migration:

| Service | Reason |
|---------|--------|
| `ais.ts` | WebSocket-based polling; sebuf is HTTP-only |
| `analysis-core.ts` | Client-side analysis; no external API |
| `analysis-worker.ts` | Web Worker orchestration; no external API |
| `clustering.ts` | Client-side algorithm; no external API |
| `signal-aggregator.ts` | Client-side aggregation; no external API |
| `country-instability.ts` | Client-side composite scoring; no external API |
| `cross-module-integration.ts` | Client-side event coordination; no external API |
| `geo-convergence.ts` | Client-side spatial analysis; no external API |
| `focal-point-detector.ts` | Client-side intelligence synthesis; no external API |
| `entity-extraction.ts` | Client-side NLP; no external API |
| `ml-worker.ts` | Client-side ML inference; no external API |
| `trending-keywords.ts` | Client-side keyword extraction; no external API |
| `storage.ts` | IndexedDB operations; no external API |
| `persistent-cache.ts` | Cache layer; no external API |
| `runtime-config.ts` | Feature flag management; no external API |
| `i18n.ts` | Internationalization; no external API |
| `data-freshness.ts` | Staleness tracking; no external API |

This leaves approximately **30-35 services** that make external HTTP API calls and are in scope for proto migration.

## MVP Recommendation

Prioritize:

1. **Core shared messages** (`worldmonitor/core/v1/`) -- GeoCoordinates, TimeRange, Error, ApiStatus, PaginationParams. Every domain depends on these.

2. **One simple domain end-to-end** -- Start with Environmental (earthquakes, fires). Simplest APIs, no auth, no proxy complexity. Proves the full pipeline: proto -> generated types -> dual-mode adapter -> parity test -> legacy removal.

3. **One complex domain end-to-end** -- Then Markets (Finnhub + Yahoo + CoinGecko + Polymarket). Multi-provider, multi-proxy, auth required. If this works, everything works.

4. **Dual-mode adapter framework** -- Build early, use for every subsequent migration.

5. **Parity test harness** -- Build alongside the first domain migration. Reuse for all domains.

Defer:
- **Server handler generation:** Wait until sebuf TS server codegen is ready. Proto files and client migration can proceed independently.
- **Batch request coalescing:** Optimization phase after migration is complete.
- **OpenAPI documentation:** Runs automatically once protos exist; not a blocker.
- **Request validation (`buf.validate`):** Can be added incrementally after protos are defined.

## Sources

- Direct codebase analysis: `src/services/` (80+ files, ~19,500 lines total)
- Direct codebase analysis: `api/` (50+ Vercel edge function files)
- Direct codebase analysis: `src/types/index.ts` (1,294 lines of domain types)
- Direct codebase analysis: `src/config/variants/base.ts` (API_URLS configuration)
- Direct codebase analysis: `src/utils/circuit-breaker.ts`, `src/utils/proxy.ts`
- sebuf SDK reference: `/kompani/sdk.nosync/` (Anghami SDK using sebuf patterns)
- sebuf proto annotations: `sebuf/http/annotations.proto`, `sebuf/http/headers.proto`
- sebuf buf module: [buf.build/sebmelki/sebuf](https://buf.build/sebmelki/sebuf)
- [sebuf GitHub repository](https://github.com/SebastienMelki/sebuf)
- Project planning: `.planning/PROJECT.md` and `.planning/codebase/INTEGRATIONS.md` from `feat/sebuf-integration` branch
