# Phase 2B: Server Runtime — Context & Handoff

## What happened before this phase

### Phase 1 (complete): Proto Foundation
- Configured buf toolchain (`buf.yaml`, `buf.gen.yaml`, `buf.lock`)
- Created shared core proto types in `proto/worldmonitor/core/v1/`:
  - `geo.proto` (GeoCoordinates, BoundingBox)
  - `time.proto` (TimeRange)
  - `pagination.proto` (PaginationRequest, PaginationResponse)
  - `i18n.proto` (LocalizableString)
  - `identifiers.proto` (HotspotID, EventID, ProviderID + 10 domain IDs)
  - `general_error.proto` (RateLimited, UpstreamDown, GeoBlocked, MaintenanceMode)
  - `severity.proto` (SeverityLevel, CriticalityLevel, TrendDirection)
  - `country.proto` (CountryCode)
- Created `Makefile` with `make lint`, `make generate`, `make clean`, `make install`

### Phase 2A (complete): All Domain Protos
- Defined 17 domain service proto packages (79 proto files total)
- Generated 17 TypeScript client classes + 17 server handler interfaces + 34 OpenAPI specs
- Removed test domain protos (Phase 1 scaffolding)
- `buf lint` clean, `tsc --noEmit` clean

### Branch state
- Branch: `feat/sebuf-integration`
- PR: #106 (draft) at https://github.com/koala73/worldmonitor/pull/106
- Last commit: `536d5b5 feat(2A): define all 17 domain proto packages`
- Synced with main as of 2026-02-18

## What this phase needs to build

### Goal
Build shared server infrastructure and validate the full pipeline end-to-end with one real handler (seismology).

### Deliverables

#### 1. `api/server/router.ts` — Route matcher
- Takes an array of `RouteDescriptor[]` from all generated services
- Matches incoming `Request` by method + path
- Returns the matched handler or null
- Must handle the `/api/{domain}/v1/{rpc}` path pattern

#### 2. `api/server/cors.ts` — CORS middleware
- Port from existing `api/_cors.js` (read that file for the exact logic)
- `ALLOWED_ORIGIN_PATTERNS`: worldmonitor.app, vercel preview URLs, localhost, tauri
- `getCorsHeaders(req)` returns CORS headers
- Must handle OPTIONS preflight
- All sebuf routes use POST, so methods should include POST

#### 3. `api/server/error-mapper.ts` — Error → HTTP response mapper
- Implements the `onError` callback for `ServerOptions`
- Maps known error types to appropriate HTTP status codes
- Returns structured JSON error responses

#### 4. `api/[[...path]].ts` — Vercel catch-all gateway
- Imports all `createXxxServiceRoutes()` functions
- Mounts all `RouteDescriptor[]` arrays
- Applies CORS middleware
- Only intercepts `/api/*/v1/*` paths — old `api/*.js` files keep working
- Vercel routing: specific files take priority over catch-all

#### 5. `api/server/worldmonitor/seismology/v1/handler.ts` — First handler
- Implements `SeismologyServiceHandler` interface from generated server code
- Proxies USGS GeoJSON earthquake API
- Transforms USGS response to proto-shaped `ListEarthquakesResponse`
- Validates the complete pipeline: proto → generated interface → handler → gateway → HTTP

## Key reference files

| File | Purpose |
|------|---------|
| `src/generated/server/worldmonitor/seismology/v1/service_server.ts` | Generated server types + `SeismologyServiceHandler` interface + `createSeismologyServiceRoutes()` |
| `src/generated/client/worldmonitor/seismology/v1/service_client.ts` | Generated client (shows what callers expect) |
| `api/_cors.js` | Existing CORS logic to port |
| `api/earthquakes.js` | Existing earthquake endpoint (legacy, to eventually replace) |
| `src/types/index.ts` | Ground truth for entity shapes (lines 488-497 for `Earthquake`) |
| `Makefile` | `make generate`, `make lint` |
| `proto/worldmonitor/seismology/v1/service.proto` | Seismology service definition |

## Key patterns from generated code

The generated `service_server.ts` exports:
```typescript
export interface SeismologyServiceHandler {
  listEarthquakes(ctx: ServerContext, req: ListEarthquakesRequest): Promise<ListEarthquakesResponse>;
}

export function createSeismologyServiceRoutes(
  handler: SeismologyServiceHandler,
  options?: ServerOptions,
): RouteDescriptor[]
```

The `RouteDescriptor` shape:
```typescript
export interface RouteDescriptor {
  method: string;    // "POST"
  path: string;      // "/api/seismology/v1/list-earthquakes"
  handler: (req: Request) => Promise<Response>;
}
```

## Constraints

- All sebuf RPCs are POST with kebab-case paths
- No `oneof success/error` in responses — throw errors in handler, map with `onError`
- Base paths: `/api/{domain}/v1`
- Tauri fetch patch intercepts all `/api/*` — new paths work automatically
- Generated `int64` fields come as `string` in TypeScript (sebuf v0.7.0 has encoding options but they're not wired up yet in our buf.gen.yaml — fine for now, handlers return numbers as JSON anyway)

## Notes

- `enum_value` and `INT64_ENCODING_NUMBER` sebuf annotations exist in v0.7.0 but aren't configured yet. Not blocking — can be added later.
- The Makefile installs sebuf plugins at v0.6.0 — should be updated to v0.7.0 at some point.
- Pre-existing `@sentry/browser` TS error in `src/main.ts` — unrelated to our work.
