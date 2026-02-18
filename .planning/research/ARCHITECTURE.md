# Architecture Patterns

**Domain:** Proto-driven HTTP API migration (sebuf) for multi-source intelligence dashboard
**Researched:** 2026-02-18
**Confidence:** HIGH (based on direct inspection of both codebases)

## Executive Summary

WorldMonitor's migration from ad-hoc fetch-based services to sebuf proto-defined domain services is architecturally a three-layer transformation: (1) define domain contracts in `.proto` files, (2) generate type-safe TS clients that replace hand-written fetch calls, and (3) generate TS server handlers that replace the current 60+ Vercel edge functions and Vite dev proxies with a unified server layer that proxies to upstream APIs. The architecture must support three deployment targets (Vercel edge, Tauri sidecar, Vite dev server) from a single generated codebase, and it must allow incremental migration through a dual-mode adapter so existing services continue working alongside new sebuf clients.

## Recommended Architecture

### System Overview

```
                         .proto definitions
                              |
                     +--------+--------+
                     |                 |
              protoc-gen-ts-client  protoc-gen-ts-server
                     |                 |
                     v                 v
            src/generated/          server/generated/
            clients/*.ts            handlers/*.ts
                     |                 |
                     v                 v
            src/services/           server/handlers/
            domain adapters         implementations
            (dual-mode)             (upstream proxy)
                     |                 |
                     v                 v
              SPA (browser)         Server runtime
              App.ts consumes       (Vercel Edge / Tauri Sidecar / Vite middleware)
```

### Component Boundaries

| Component | Location | Responsibility | Communicates With |
|-----------|----------|---------------|-------------------|
| **Proto definitions** | `proto/` | Domain contracts, API shapes, HTTP annotations | Consumed by sebuf codegen |
| **Generated TS clients** | `src/generated/clients/` | Type-safe HTTP calls to domain endpoints | Called by domain adapters |
| **Generated TS server** | `server/generated/` | RouteDescriptor[] with handler interfaces, request parsing, validation | Implemented by handler implementations |
| **Handler implementations** | `server/handlers/` | Business logic: proxy to upstream APIs, inject API keys, transform responses | Uses generated server interfaces, calls upstream APIs |
| **Domain adapters** | `src/services/domains/` | Dual-mode bridge: delegates to sebuf client or legacy service based on feature flag | Called by App.ts; calls either generated client or legacy service |
| **Legacy services** | `src/services/*.ts` (existing) | Current ad-hoc fetch implementations | Called by domain adapters during migration; removed after parity |
| **Server runtime** | `server/runtime/` | Framework adapter: maps RouteDescriptor[] to Vercel Edge / Tauri sidecar / Vite middleware | Consumes generated routes, shared CORS/auth middleware |
| **Cross-cutting** | `src/utils/`, `server/shared/` | Circuit breaker, caching, error handling, logging | Used by both client-side adapters and server handlers |

### Proto File Directory Layout

```
proto/
  buf.yaml                          # Buf workspace config
  buf.gen.yaml                      # Code generation config
  buf.lock                          # Dependency lock
  sebuf/                            # sebuf annotations (imported from BSR)
    http/
      annotations.proto
      headers.proto
  worldmonitor/
    common/
      pagination.proto              # Shared pagination messages
      geo.proto                     # Shared lat/lng, bounding box
      temporal.proto                # Shared timestamp ranges
    news/
      v1/
        news_service.proto          # RSS feeds, live news, Hacker News, arXiv
        news_models.proto           # NewsItem, Feed, ClusteredEvent
    markets/
      v1/
        markets_service.proto       # Finnhub, Yahoo Finance, CoinGecko, Polymarket
        markets_models.proto        # MarketData, CryptoData, PredictionMarket
    military/
      v1/
        military_service.proto      # OpenSky, Wingbits, ADS-B, FAA
        military_models.proto       # MilitaryFlight, AircraftMetadata
    geopolitical/
      v1/
        geopolitical_service.proto  # ACLED, UCDP, GDELT, HAPI, UNHCR
        geopolitical_models.proto   # ConflictEvent, ProtestEvent, RefugeeData
    environmental/
      v1/
        environmental_service.proto # USGS, NASA FIRMS, GDACS, EONET, Climate
        environmental_models.proto  # Earthquake, Fire, Cyclone, NaturalEvent
    cyber/
      v1/
        cyber_service.proto         # URLhaus, ThreatFox, AlienVault, AbuseIPDB
        cyber_models.proto          # CyberThreat, IOC, MalwareURL
    economic/
      v1/
        economic_service.proto      # FRED, USA Spending, World Bank, EIA
        economic_models.proto       # EconomicIndicator, SpendingData, OilData
    research/
      v1/
        research_service.proto      # arXiv, GitHub Trending, Hacker News
        research_models.proto       # Paper, TrendingRepo
    infrastructure/
      v1/
        infrastructure_service.proto # Cloudflare Radar, NGA, PizzINT
        infrastructure_models.proto  # InternetOutage, MaritimeWarning
```

**Design rationale:**
- One proto package per data domain, matching the 9 identified domains
- Separate `_models.proto` from `_service.proto` to allow shared model reuse across services
- Version namespace (`v1/`) enables future API evolution without breaking existing clients
- `common/` package for cross-domain types (pagination, geo coordinates, time ranges) avoids duplication
- Each service maps to one generated client class and one server handler interface

### Data Flow

**Current flow (legacy):**
```
App.ts timer/event
  -> src/services/earthquakes.ts (fetchEarthquakes)
    -> fetch('/api/earthquake')
      -> Vite dev proxy (dev) / Vercel edge function (prod) / Tauri sidecar (desktop)
        -> upstream API (earthquake.usgs.gov)
    -> CircuitBreaker wraps call
    -> PersistentCache fallback
  -> App.ts stores result, updates UI
```

**Target flow (sebuf):**
```
App.ts timer/event
  -> src/services/domains/environmental.ts (adapter)
    -> checks feature flag: use sebuf or legacy?
    -> if sebuf:
      -> EnvironmentalServiceClient.getEarthquakes(req)
        -> fetch('/api/v1/environmental/earthquakes')
          -> Server runtime routes to handler
            -> server/handlers/environmental.ts (getEarthquakes impl)
              -> fetch('https://earthquake.usgs.gov/...')
              -> transform response to proto-shaped JSON
              -> return typed response
    -> if legacy:
      -> src/services/earthquakes.ts (existing)
    -> CircuitBreaker wraps whichever path
    -> PersistentCache fallback
  -> App.ts stores result, updates UI (unchanged)
```

**Key data flow principles:**
1. **Client-side code never calls upstream APIs directly** -- all upstream calls go through server handlers
2. **Server handlers are the single point of API key injection** -- keys never reach the browser
3. **Circuit breaker and caching operate at the adapter level** -- they wrap whichever path is active
4. **App.ts call sites remain unchanged** -- adapters expose the same function signatures

### Server Runtime Architecture

The sebuf TS server generates `RouteDescriptor[]` -- an array of `{ method, path, handler }` objects. These are framework-agnostic. WorldMonitor needs three runtime adapters:

**1. Vercel Edge Functions (production web)**
```typescript
// server/runtime/vercel.ts
import { createEnvironmentalServiceRoutes } from '../generated/environmental_service_server';
import { EnvironmentalHandler } from '../handlers/environmental';

const routes = [
  ...createEnvironmentalServiceRoutes(new EnvironmentalHandler()),
  ...createMarketsServiceRoutes(new MarketsHandler()),
  // ... all domain routes
];

// Single catch-all Vercel edge function
export default async function handler(req: Request) {
  const url = new URL(req.url);
  const route = routes.find(r =>
    r.method === req.method && matchPath(r.path, url.pathname)
  );
  if (!route) return new Response('Not Found', { status: 404 });
  return route.handler(req);
}
```

**2. Tauri Sidecar (desktop)**
```typescript
// server/runtime/sidecar.ts -- extends existing local-api-server.mjs
import { routes } from '../routes';

// Register sebuf routes alongside existing sidecar endpoints
for (const route of routes) {
  server.register(route.method, route.path, route.handler);
}
```

**3. Vite Dev Server (development)**
```typescript
// server/runtime/vite-plugin.ts
import { routes } from '../routes';

export function sebufDevPlugin(): Plugin {
  return {
    name: 'sebuf-dev-server',
    configureServer(server) {
      for (const route of routes) {
        server.middlewares.use(adaptRouteToConnect(route));
      }
    },
  };
}
```

**Critical design decision:** A single `server/routes.ts` barrel file that collects all RouteDescriptor[] from all domains. Each runtime adapter imports this one file and adapts it to its framework. This ensures all three runtimes serve identical API behavior.

### Dual-Mode Adapter Pattern

The adapter pattern is the key to incremental migration. Each domain gets an adapter module that exposes the same function signatures the existing App.ts expects:

```typescript
// src/services/domains/environmental.ts
import { EnvironmentalServiceClient } from '@/generated/clients/environmental_service_client';
import { fetchEarthquakes as legacyFetchEarthquakes } from '@/services/earthquakes';
import { isFeatureEnabled } from '@/services/runtime-config';
import { createCircuitBreaker } from '@/utils';

const client = new EnvironmentalServiceClient('/api/v1', {
  // Uses same fetch -- Vite proxy / Vercel / Tauri patch all intercept transparently
});

const breaker = createCircuitBreaker<Earthquake[]>({ name: 'Environmental:Earthquakes' });

export async function fetchEarthquakes(): Promise<Earthquake[]> {
  if (!isFeatureEnabled('sebufEnvironmental')) {
    return legacyFetchEarthquakes();
  }

  return breaker.execute(async () => {
    const response = await client.getEarthquakes({});
    return response.earthquakes.map(toClientEarthquake);
  }, []);
}
```

**This pattern:**
- Preserves the existing function signature (App.ts import stays the same)
- Feature-flag controlled: flip one flag to switch a domain to sebuf
- Falls back to legacy automatically
- Circuit breaker wraps both paths uniformly
- Enables per-domain migration (migrate markets before military, etc.)
- Allows A/B comparison during migration: run both paths, compare results

### Generated Code Organization

```
src/
  generated/                        # ALL generated code lives here (gitignored or committed)
    clients/
      worldmonitor/
        news/v1/
          news_service_client.ts
          news_models.ts            # Re-exported from client file
        markets/v1/
          markets_service_client.ts
        military/v1/
          military_service_client.ts
        geopolitical/v1/
          geopolitical_service_client.ts
        environmental/v1/
          environmental_service_client.ts
        cyber/v1/
          cyber_service_client.ts
        economic/v1/
          economic_service_client.ts
        research/v1/
          research_service_client.ts
        infrastructure/v1/
          infrastructure_service_client.ts

server/
  generated/                        # Generated server code
    worldmonitor/
      news/v1/
        news_service_server.ts
      markets/v1/
        markets_service_server.ts
      # ... mirrors client structure
  handlers/                         # Hand-written handler implementations
    news.ts                         # Implements NewsServiceHandler interface
    markets.ts                      # Implements MarketsServiceHandler interface
    military.ts
    geopolitical.ts
    environmental.ts
    cyber.ts
    economic.ts
    research.ts
    infrastructure.ts
  shared/
    cors.ts                         # Shared CORS logic (migrated from api/_cors.js)
    upstream-fetch.ts               # Shared upstream fetch with timeout, retry
    api-keys.ts                     # Centralized API key access (env vars)
    cache-headers.ts                # Cache-Control header factory
  runtime/
    vercel.ts                       # Vercel edge function adapter
    sidecar.ts                      # Tauri sidecar adapter
    vite-plugin.ts                  # Vite dev server plugin
    router.ts                       # Path matching utility for RouteDescriptor[]
  routes.ts                         # Barrel: collects all RouteDescriptor[]
```

**Commit generated code or not?** Commit it. Rationale:
- CI can verify generated code matches proto definitions (codegen check step)
- Developers without protoc/buf installed can still build the project
- Diff review catches unintended proto changes
- No build-time codegen dependency

## Patterns to Follow

### Pattern 1: Proto Service per Data Domain

**What:** Each of the 9 data domains gets exactly one proto service definition with RPCs mapping to its external API integrations.

**When:** Always. Every external API integration belongs to exactly one domain service.

**Example:**
```protobuf
// proto/worldmonitor/environmental/v1/environmental_service.proto
syntax = "proto3";
package worldmonitor.environmental.v1;

import "sebuf/http/annotations.proto";
import "proto/worldmonitor/environmental/v1/environmental_models.proto";

service EnvironmentalService {
  option (sebuf.http.service_config) = {
    base_path: "/api/v1/environmental"
  };

  rpc GetEarthquakes(GetEarthquakesRequest) returns (GetEarthquakesResponse) {
    option (sebuf.http.config) = {
      path: "/earthquakes"
      method: HTTP_METHOD_GET
    };
  }

  rpc GetActiveFires(GetActiveFiresRequest) returns (GetActiveFiresResponse) {
    option (sebuf.http.config) = {
      path: "/fires"
      method: HTTP_METHOD_GET
    };
  }

  rpc GetNaturalEvents(GetNaturalEventsRequest) returns (GetNaturalEventsResponse) {
    option (sebuf.http.config) = {
      path: "/events"
      method: HTTP_METHOD_GET
    };
  }
}
```

**Rationale:** One service per domain creates a clear ownership boundary. The handler implementation for that service owns all upstream API calls for that domain. This maps 1:1 to the existing domain taxonomy decision (group by data type, not UI panel).

### Pattern 2: Handler as Upstream Proxy

**What:** Server handler implementations proxy to upstream APIs rather than containing business logic.

**When:** Every handler method. The server is a proxy layer, not a data processing layer.

**Example:**
```typescript
// server/handlers/environmental.ts
import type { EnvironmentalServiceHandler, ServerContext } from '../generated/worldmonitor/environmental/v1/environmental_service_server';
import { fetchUpstream } from '../shared/upstream-fetch';
import { getApiKey } from '../shared/api-keys';

export class EnvironmentalHandler implements EnvironmentalServiceHandler {
  async getEarthquakes(
    ctx: ServerContext,
    req: GetEarthquakesRequest
  ): Promise<GetEarthquakesResponse> {
    const data = await fetchUpstream(
      'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson',
      { timeout: 15000 }
    );
    const usgs = await data.json();

    return {
      earthquakes: usgs.features.map((f: any) => ({
        id: f.id,
        place: f.properties.place || 'Unknown',
        magnitude: f.properties.mag,
        longitude: f.geometry.coordinates[0],
        latitude: f.geometry.coordinates[1],
        depth: f.geometry.coordinates[2],
        time: new Date(f.properties.time).toISOString(),
        url: f.properties.url,
      })),
    };
  }

  async getActiveFires(ctx: ServerContext, req: GetActiveFiresRequest): Promise<GetActiveFiresResponse> {
    const apiKey = getApiKey('NASA_FIRMS_API_KEY');
    // ... proxy to NASA FIRMS
  }
}
```

**Rationale:** Keeps the server layer thin. Business logic (clustering, analysis, scoring) stays client-side where it already works. The server's job is: (1) inject API keys, (2) bypass CORS, (3) transform upstream responses to proto shapes, (4) set cache headers.

### Pattern 3: Shared Router for All Runtimes

**What:** A single `matchRoute()` function that maps incoming requests to RouteDescriptor[], used identically by Vercel, Tauri, and Vite.

**When:** In every runtime adapter.

**Example:**
```typescript
// server/runtime/router.ts
import type { RouteDescriptor } from '../generated/worldmonitor/environmental/v1/environmental_service_server';

interface MatchResult {
  route: RouteDescriptor;
  pathParams: Record<string, string>;
}

export function matchRoute(
  routes: RouteDescriptor[],
  method: string,
  pathname: string
): MatchResult | null {
  for (const route of routes) {
    if (route.method !== method) continue;
    const params = matchPath(route.path, pathname);
    if (params !== null) {
      return { route, pathParams: params };
    }
  }
  return null;
}

function matchPath(pattern: string, pathname: string): Record<string, string> | null {
  const patternParts = pattern.split('/');
  const pathParts = pathname.split('/');
  if (patternParts.length !== pathParts.length) return null;

  const params: Record<string, string> = {};
  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith('{') && patternParts[i].endsWith('}')) {
      params[patternParts[i].slice(1, -1)] = decodeURIComponent(pathParts[i]);
    } else if (patternParts[i] !== pathParts[i]) {
      return null;
    }
  }
  return params;
}
```

### Pattern 4: Response Shape Matching via sebuf Annotations

**What:** Use sebuf's `unwrap`, `flatten`, `int64_encoding`, `enum_encoding`, and `nullable` annotations to make proto-defined JSON match existing upstream API shapes exactly -- avoiding double transformation.

**When:** Defining proto messages that model upstream API responses.

**Example:**
```protobuf
// Match USGS GeoJSON response shape
message USGSFeature {
  string id = 1;
  USGSProperties properties = 2;
  USGSGeometry geometry = 3;
}

message USGSGeometry {
  // USGS returns [lng, lat, depth] -- model as explicit fields
  repeated double coordinates = 1;
}

// If upstream returns numbers as strings, use appropriate encoding
message FREDObservation {
  string date = 1;
  string value = 2; // FRED returns numeric values as strings
  string realtime_start = 3;
  string realtime_end = 4;
}
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: One Mega-Service

**What:** Putting all 80+ API integrations into a single proto service.

**Why bad:** Generates a single massive client class and handler interface. Handler file becomes 5000+ lines. No domain isolation. Cannot migrate incrementally.

**Instead:** One service per domain (9 services). Each can be migrated independently.

### Anti-Pattern 2: Client-Side Proto-to-Legacy Type Mapping

**What:** Having the adapter layer manually map between generated proto types and existing `src/types/index.ts` types.

**Why bad:** Creates a maintenance burden of keeping two parallel type systems. Every type change requires updating both proto definitions and legacy types.

**Instead:** Gradually migrate `src/types/index.ts` to re-export from generated client types. During migration, the adapter does minimal mapping. After migration, generated types become the source of truth.

### Anti-Pattern 3: Server Handlers Containing Analysis Logic

**What:** Moving clustering, scoring, or analysis logic into server handlers.

**Why bad:** WorldMonitor's analysis layer runs client-side intentionally (works offline in Tauri, reduces server load, enables real-time recalculation). Moving it server-side would require WebSocket for real-time updates and break the existing architecture.

**Instead:** Server handlers only proxy upstream APIs. Analysis stays in `src/services/analysis-core.ts` et al.

### Anti-Pattern 4: Per-Endpoint Vercel Functions

**What:** Generating individual Vercel edge functions for each RPC (like the current api/*.js pattern).

**Why bad:** Vercel has file-based routing with function size limits. 80+ individual functions means 80+ cold starts, 80+ deployments, and the same handler boilerplate duplicated everywhere.

**Instead:** One catch-all Vercel edge function (api/v1/[...path].ts) that uses the shared router to dispatch to the correct handler. This is what the RouteDescriptor[] pattern enables.

### Anti-Pattern 5: Breaking the Fetch Patch

**What:** Having generated sebuf clients use a different base URL or fetch strategy than the existing `proxyUrl()` / `installRuntimeFetchPatch()` system.

**Why bad:** The existing Tauri desktop runtime patches `window.fetch` to intercept `/api/*` calls and route them to the local sidecar with cloud fallback. sebuf clients must use this same mechanism.

**Instead:** Configure generated clients with `baseURL: ''` (empty string, using relative paths) so they go through the same fetch pipeline. All paths start with `/api/v1/...` and get intercepted by the existing runtime patch.

## Component Interaction Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Browser (SPA)                                 │
│                                                                      │
│  ┌──────────┐   ┌──────────────────────┐   ┌────────────────────┐  │
│  │ App.ts   │──>│ Domain Adapters      │──>│ Generated Clients  │  │
│  │          │   │ (dual-mode switch)   │   │ (sebuf TS client)  │  │
│  └──────────┘   └──────────┬───────────┘   └────────┬───────────┘  │
│       │                    │                         │              │
│       │          ┌─────────v─────────┐    ┌─────────v──────────┐   │
│       │          │ Legacy Services   │    │ fetch('/api/v1/..') │   │
│       │          │ (existing *.ts)   │    └─────────┬──────────┘   │
│       │          └─────────┬─────────┘              │              │
│       │                    │                        │              │
│  ┌────v─────────────────┐  │         ┌──────────────v───────────┐  │
│  │ Analysis Layer       │  │         │ Runtime Fetch Patch      │  │
│  │ (clustering, scoring,│  │         │ (Tauri: sidecar + cloud) │  │
│  │  convergence)        │  │         │ (Web: passthrough)       │  │
│  └──────────────────────┘  │         └──────────────┬───────────┘  │
│                            │                        │              │
└────────────────────────────│────────────────────────│──────────────┘
                             │                        │
              ┌──────────────v──────┐   ┌─────────────v──────────────┐
              │ Upstream APIs       │   │ Server Runtime              │
              │ (direct, legacy     │   │                             │
              │  Vite proxy / edge) │   │ ┌─────────────────────┐    │
              └─────────────────────┘   │ │ Router (matchRoute)  │   │
                                        │ └──────────┬──────────┘    │
                                        │            │               │
                                        │ ┌──────────v──────────┐    │
                                        │ │ Generated Handlers   │   │
                                        │ │ (RouteDescriptor[])  │   │
                                        │ └──────────┬──────────┘    │
                                        │            │               │
                                        │ ┌──────────v──────────┐    │
                                        │ │ Handler Impls        │   │
                                        │ │ (upstream proxy)     │   │
                                        │ └──────────┬──────────┘    │
                                        │            │               │
                                        │ ┌──────────v──────────┐    │
                                        │ │ Upstream APIs        │   │
                                        │ │ (USGS, FRED, etc.)  │   │
                                        │ └─────────────────────┘    │
                                        │                            │
                                        │ Deployed as:               │
                                        │  - Vercel edge catch-all   │
                                        │  - Tauri sidecar routes    │
                                        │  - Vite dev plugin         │
                                        └────────────────────────────┘
```

## Scalability Considerations

| Concern | Current (80 services) | Post-Migration | At Scale (200+ APIs) |
|---------|----------------------|----------------|---------------------|
| Type safety | None (ad-hoc interfaces) | Full (proto-generated) | Full (proto-generated) |
| API key exposure | Some keys in browser bundle | All keys server-side | All keys server-side |
| Cold start | 60+ individual Vercel functions | 1 catch-all function | 1 catch-all, code-split handlers |
| Error handling | Inconsistent per-service | Uniform via generated handlers | Uniform via generated handlers |
| Caching | Per-service, inconsistent | Centralized cache-header factory | Edge caching + CDN |
| Adding new API | New .ts file + Vercel function + Vite proxy | New RPC in proto + handler impl | New RPC in proto + handler impl |
| Desktop/Web parity | Manual sidecar sync | Automatic (same routes) | Automatic (same routes) |

## Suggested Build Order

The migration has explicit dependencies. Build order matters.

### Phase 1: Proto Definitions + Client Generation (no server dependency)

**Build:**
- Proto file directory structure
- buf.yaml/buf.gen.yaml configuration
- Common shared messages (pagination, geo, temporal)
- 2-3 domain service protos (start with Environmental and Markets -- simplest upstream APIs)
- Run protoc-gen-ts-client to generate clients
- Verify generated client types match existing `src/types/index.ts` shapes

**Why first:** Proto definitions are the contract. They can be written and validated now. Client generation already works. No server codegen dependency.

**Dependency:** None. This is foundation work.

### Phase 2: Domain Adapters + Dual-Mode Switch

**Build:**
- `src/services/domains/` adapter modules
- Feature flag entries in `src/services/runtime-config.ts`
- Adapter for Environmental domain (fetchEarthquakes, fetchActiveFires, etc.)
- Adapter for Markets domain (fetchMarkets, fetchCrypto, etc.)
- Wire adapters into App.ts imports (replace direct service imports)

**Why second:** Adapters establish the dual-mode pattern. Even without the server running, adapters default to legacy path. This changes zero behavior but sets up the switch.

**Dependency:** Phase 1 (generated client types for import signatures).

### Phase 3: Server Runtime + Handler Implementations

**Build:**
- Server directory structure
- Shared utilities (CORS, upstream-fetch, api-keys, cache-headers)
- Router utility (matchRoute)
- Environmental handler implementation
- Markets handler implementation
- Vite dev plugin (first runtime adapter -- fastest feedback loop)
- Verify: flip feature flag, confirm sebuf path works in dev

**Why third:** Server codegen (protoc-gen-ts-server) may still be finalizing. Handler implementations are hand-written regardless. Start with Vite plugin for rapid iteration.

**Dependency:** Phase 1 (proto definitions for server codegen), Phase 2 (adapters to consume new endpoints).

### Phase 4: Remaining Domains + Production Runtimes

**Build:**
- Proto definitions for remaining 7 domains
- Handler implementations for all domains
- Vercel catch-all edge function
- Tauri sidecar route registration
- Remove individual Vercel edge functions as each domain migrates
- Feature parity testing between legacy and sebuf paths

**Dependency:** Phases 1-3 (patterns established, infrastructure proven).

### Phase 5: Legacy Removal + Type Consolidation

**Build:**
- Remove legacy service files
- Remove Vite dev proxy entries (now handled by sebuf plugin)
- Migrate `src/types/index.ts` to re-export from generated types
- Remove dual-mode adapter branches (always use sebuf path)
- Remove old `api/*.js` Vercel functions

**Dependency:** Phase 4 (all domains migrated and verified).

## WebSocket Services: Explicitly Outside Scope

AIS vessel tracking (`src/services/ais.ts`) and OpenSky relay (`src/services/military-flights.ts` for WebSocket mode) use WebSocket connections through a Railway relay. sebuf is HTTP-only.

**Architecture decision:** These services stay as-is. They are already well-isolated (AIS has its own connection lifecycle, OpenSky relay has its own reconnection logic). They do not participate in the proto migration.

If WebSocket services need proto-like type safety in the future, a separate `proto/worldmonitor/streaming/v1/` package could define message types (but not service RPCs) that these services import for type checking. This is optional and separate from the HTTP migration.

## RSS Feed Special Case

RSS feeds are the highest-volume service (50+ feed sources, 850 lines of feed definitions). They currently use Vite dev proxies for each feed domain (30+ proxy entries) and a Vercel edge function (`api/rss-proxy.js`) in production.

**Recommended approach:** A single `NewsService.GetFeedItems` RPC that takes a feed URL parameter. The server handler validates the URL against the allowed domain list (currently hardcoded in `api/rss-proxy.js`) and proxies the fetch. This replaces 30+ Vite proxy entries with one sebuf route.

```protobuf
rpc GetFeedItems(GetFeedItemsRequest) returns (GetFeedItemsResponse) {
  option (sebuf.http.config) = {
    path: "/feeds"
    method: HTTP_METHOD_GET
  };
}

message GetFeedItemsRequest {
  string feed_url = 1 [(sebuf.http.query) = { name: "url" }];
  string category = 2 [(sebuf.http.query) = { name: "category" }];
}
```

This consolidates feed proxying into a single, typed endpoint with server-side domain validation.

## Sources

- Direct inspection of sebuf codebases:
  - `/sebuf.nosync/` -- sebuf toolkit source
  - `/sebuf.nosync/internal/tsservergen/` -- TS server generator (exists, working, has golden tests)
  - `/sebuf.nosync/internal/tsclientgen/` -- TS client generator (stable)
  - `/sebuf.nosync/examples/ts-client-demo/` -- TS client example with generated output
  - `/sebuf.nosync/internal/tsservergen/testdata/golden/` -- TS server golden files showing RouteDescriptor[] pattern
- Direct inspection of WorldMonitor codebase:
  - `src/services/*.ts` -- 80+ existing service modules
  - `api/*.js` -- 60+ Vercel edge functions
  - `vite.config.ts` -- 30+ dev proxy entries
  - `src/services/runtime.ts` -- Tauri fetch patch mechanism
  - `src/utils/circuit-breaker.ts` -- Existing resilience pattern
  - `src/services/persistent-cache.ts` -- Existing caching pattern
  - `.planning/codebase/` -- Existing architecture documentation

---

*Architecture research: 2026-02-18*
