# Phase 2C: Seismology Migration - Research

**Researched:** 2026-02-18
**Domain:** Frontend client migration, proto type adaptation, legacy cleanup
**Confidence:** HIGH

## Summary

Phase 2C migrates the seismology/earthquakes domain end-to-end: from the legacy `api/earthquakes.js` Vercel edge function + `src/services/earthquakes.ts` client-side service to the sebuf-powered handler (already implemented in Phase 2B) + generated `SeismologyServiceClient` + adapted frontend components. This is the first domain migration and sets the pattern for all subsequent 2D-2S migrations.

The handler and server infrastructure are already in place from Phase 2B. The catch-all gateway (`api/[[...path]].ts`) already mounts seismology routes at `POST /api/seismology/v1/list-earthquakes`. The generated client (`src/generated/client/worldmonitor/seismology/v1/service_client.ts`) provides a type-safe `SeismologyServiceClient` class. The main work is: (1) enabling INT64_ENCODING_NUMBER on proto time fields (prerequisite), (2) building a port/adapter layer in `src/services/earthquakes.ts` that uses the generated client, (3) adapting 8+ frontend files that consume the legacy `Earthquake` type, and (4) deleting the legacy `api/earthquakes.js` endpoint.

**Primary recommendation:** Start with INT64_ENCODING_NUMBER (requires BSR proto update + sebuf plugin upgrade), then build the adapter in `src/services/earthquakes.ts` that maps generated proto types to the legacy `Earthquake` shape, then gradually update components that can consume proto types directly.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

- Enable `INT64_ENCODING_NUMBER` on all time fields in proto files before migrating. Regenerate code so TypeScript gets `number` not `string` for int64 fields. This is part of this phase, done first.
- **Direct switch** -- no side-by-side comparison with legacy, just swap to sebuf.
- **Adapter/port pattern** for legacy interaction -- reference implementation at `koussa/internal/modules` (specifically playlist module). Port = interface declaring what the domain needs. Adapter = concrete implementation backed by sebuf client. Consuming code imports the port, never the adapter directly.
- **Adapt components** to consume generated response types directly -- no mapping shim between client and components.
- **Delete legacy adapter immediately** once sebuf adapter is wired up and working.
- **Gradual testing at both levels**: test each sub-step within the domain AND validate the full domain before moving to the next.
- **Atomic commits** for each sub-step.
- **Delete api/earthquakes.js in the same commit** as the client switchover.
- **Leave shared utils** (api/_cors.js, api/_upstash-cache.js, etc.) until Phase 2T.
- **Leave legacy TypeScript types** (Earthquake in src/types/index.ts) until Phase 2T.
- **Remove Vite proxy rule** for seismology when legacy endpoint is deleted.
- **Rebase onto main after every sub-step** (every atomic commit) -- maximum freshness.
- **Push after each sync** -- force push to keep PR current, CI runs on every commit.
- **One big PR (#106)** for the entire sebuf integration -- stays as draft.
- **PR description updates**: always update the PR description with what's new.

### Claude's Discretion

- Exact testing approach (manual smoke tests, automated integration tests, or both)
- Adapter/port implementation details in TypeScript (translate from Go reference)
- Component refactoring approach when adapting to proto types
- Commit message style and granularity within the atomic commits

### Deferred Ideas (OUT OF SCOPE)

None -- discussion stayed within phase scope.

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CLIENT-01 | TypeScript sebuf clients generated for all 9 domain services via protoc-gen-ts-client | Seismology client already generated at `src/generated/client/worldmonitor/seismology/v1/service_client.ts`. INT64_ENCODING_NUMBER prerequisite changes regeneration for ALL domains. |
| CLIENT-02 | Generated clients use relative URLs (/api/v1/...) to work with existing fetch patch (runtime.ts) across Vercel, Vite dev, and Tauri | Client already generates with relative paths (`/api/seismology/v1/list-earthquakes`). Tauri runtime.ts patches `window.fetch` to intercept `/api/*` paths -- works automatically. |
| CLIENT-04 | Generated client response types align with existing TypeScript interfaces used by components | **Key gap**: legacy `Earthquake` type has flat `lat`/`lon`/`depth`/`time`/`url` fields; proto type has nested `location`/`depthKm`/`occurredAt`/`sourceUrl`. Adapter maps between them. Decision: adapt components to proto types directly (no shim), but keep legacy type alive for non-migrated consumers until 2T. |
| SERVER-02 | Handler implementations for each domain that proxy requests to upstream external APIs and return proto-typed responses | Seismology handler already implemented at `api/server/worldmonitor/seismology/v1/handler.ts` (Phase 2B). Will need update when INT64_ENCODING_NUMBER changes `occurredAt` from string to number. |
| CLEAN-01 | Legacy service files deleted after verified parity per domain | `api/earthquakes.js` deleted in same commit as client switchover. `src/services/earthquakes.ts` rewritten (not deleted) to use adapter pattern. |
| CLEAN-02 | Legacy api/*.js Vercel edge functions removed after catch-all handler covers their functionality | `api/earthquakes.js` removed. Vite proxy rule `/api/earthquake` also removed. Shared utils preserved for other domains. |

</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| sebuf (protoc-gen-ts-client) | v0.6.0 (upgrade to v0.7.0+) | TypeScript client code generation | Project's own code generation tool; INT64_ENCODING_NUMBER support requires version with BSR-published annotation proto |
| sebuf (protoc-gen-ts-server) | v0.6.0 (upgrade to v0.7.0+) | TypeScript server handler generation | Same as above |
| buf | v2 | Proto compilation and dependency management | Standard buf.build toolchain |
| esbuild | ^0.27.3 | Bundle catch-all gateway for sidecar | Already used in `scripts/build-sidecar-sebuf.mjs` |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vite | (existing) | Dev server with sebufApiPlugin | Middleware intercepts `/api/{domain}/v1/*` routes in dev mode |
| playwright | (existing) | E2E tests | Visual/functional regression testing |

### Alternatives Considered

None -- all tooling is already established from Phase 2A/2B. No new dependencies needed.

## Architecture Patterns

### Current File Structure (seismology domain)

```
proto/worldmonitor/seismology/v1/
  earthquake.proto           # Earthquake message
  list_earthquakes.proto     # Request/Response messages
  service.proto              # SeismologyService (POST /api/seismology/v1/list-earthquakes)

src/generated/client/worldmonitor/seismology/v1/
  service_client.ts          # SeismologyServiceClient (generated)
src/generated/server/worldmonitor/seismology/v1/
  service_server.ts          # SeismologyServiceHandler interface + route creator (generated)

api/server/worldmonitor/seismology/v1/
  handler.ts                 # SeismologyServiceHandler implementation (proxies USGS)
api/server/
  router.ts                  # Map-based route matcher
  cors.ts                    # CORS headers (POST+OPTIONS only)
  error-mapper.ts            # Error-to-Response conversion
api/[[...path]].ts           # Vercel catch-all gateway (mounts all routes)
api/[[...path]].js           # esbuild bundle for sidecar

api/earthquakes.js           # LEGACY -- to be deleted
src/services/earthquakes.ts  # LEGACY client -- to be rewritten with adapter pattern
src/types/index.ts           # Contains legacy Earthquake interface (preserved until 2T)
```

### Pattern 1: Port/Adapter in TypeScript (from Go reference)

**What:** Separate the domain's external dependency (sebuf client) from its internal interface (port). Consuming code depends on the port interface, not the concrete client.

**When to use:** Every domain migration. The adapter translates between generated proto response types and whatever the consuming code needs.

**Reference:** `koussa/internal/modules/playlist`:
- Port: `internal/ports/song_catalog.go` -- defines `SongCatalog` interface with domain types
- Adapter: `playlistadapters/adapters.go` -- implements port using external service client

**TypeScript translation for seismology:**

```typescript
// src/services/earthquakes.ts (rewritten)

// Port: what the seismology domain exposes to the rest of the app
// Uses the generated proto types directly (per decision: no mapping shim)
import type { Earthquake as ProtoEarthquake } from '@/generated/client/worldmonitor/seismology/v1/service_client';

export interface SeismologyPort {
  fetchEarthquakes(): Promise<ProtoEarthquake[]>;
}

// Adapter: concrete implementation backed by sebuf client
import { SeismologyServiceClient } from '@/generated/client/worldmonitor/seismology/v1/service_client';

class SeismologyAdapter implements SeismologyPort {
  private client: SeismologyServiceClient;

  constructor() {
    this.client = new SeismologyServiceClient('');  // relative URLs
  }

  async fetchEarthquakes(): Promise<ProtoEarthquake[]> {
    const resp = await this.client.listEarthquakes({ minMagnitude: 0 });
    return resp.earthquakes;
  }
}

// Singleton export -- consuming code imports this, not the class
const adapter = new SeismologyAdapter();
export const fetchEarthquakes = () => adapter.fetchEarthquakes();
```

**Key insight from reference:** The port interface uses domain types (could be proto types since we chose "no mapping shim"). The adapter is the only place that knows about the concrete client. The rest of the app imports from the port, never from the generated client directly.

### Pattern 2: Type Gap Bridging (legacy Earthquake vs proto Earthquake)

**What:** The legacy `Earthquake` type and proto `Earthquake` type have different shapes. Components need gradual adaptation.

**Legacy type (src/types/index.ts):**
```typescript
interface Earthquake {
  id: string;      place: string;     magnitude: number;
  lat: number;     lon: number;       depth: number;
  time: Date;      url: string;
}
```

**Proto type (generated):**
```typescript
interface Earthquake {
  id: string;      place: string;     magnitude: number;
  depthKm: number;
  location?: GeoCoordinates;  // { latitude: number; longitude: number; }
  occurredAt: string;  // becomes number after INT64_ENCODING_NUMBER
  sourceUrl: string;
}
```

**Field mapping:**
| Legacy Field | Proto Field | Transformation |
|---|---|---|
| `lat` | `location?.latitude` | Nested access |
| `lon` | `location?.longitude` | Nested access |
| `depth` | `depthKm` | Rename only |
| `time: Date` | `occurredAt: number` (after INT64 fix) | `new Date(occurredAt)` if Date needed |
| `url` | `sourceUrl` | Rename only |
| `magnitude` | `magnitude` | Same |
| `id` | `id` | Same |
| `place` | `place` | Same |

**8 files that access Earthquake fields (need adaptation):**
1. `src/App.ts` -- calls `fetchEarthquakes()`, passes to `map.setEarthquakes()`, reads `eq.lat`, `eq.lon`, `eq.place`, `eq.magnitude`, `eq.time`
2. `src/components/Map.ts` -- `setEarthquakes()`, reads `eq.lon`, `eq.lat`, `eq.magnitude`, `eq.place`, `eq.time`
3. `src/components/DeckGLMap.ts` -- `setEarthquakes()`, reads `d.lon`, `d.lat`, `d.magnitude`, `d.place`
4. `src/components/MapPopup.ts` -- `renderEarthquakePopup()`, reads `earthquake.magnitude`, `.place`, `.depth`, `.lat`, `.lon`, `.time`, `.url`
5. `src/components/MapContainer.ts` -- `setEarthquakes()` pass-through
6. `src/services/geo-convergence.ts` -- `ingestEarthquakes()`, reads `q.lat`, `q.lon`, `q.time`
7. `src/components/PopulationExposurePanel.ts` -- category string only (`'earthquake'`), no type access
8. `src/e2e/map-harness.ts` -- test data seed with legacy shape
9. `src/components/CountryBriefPage.ts` -- signal count only
10. `src/components/CountryIntelModal.ts` -- signal count only

**Strategy (Claude's discretion area):**
- Option A: Rewrite each consumer to use proto field names directly (e.g., `eq.location?.latitude` instead of `eq.lat`)
- Option B: The adapter returns a compatibility object that has both legacy and proto field names
- **Recommended: Option A** -- The decision says "adapt components to consume generated response types directly -- no mapping shim." This means each component file gets updated to use the proto field accessors. The count is manageable (6 files with actual field access).

### Pattern 3: INT64_ENCODING_NUMBER Application

**What:** Proto `int64` fields generate as `string` in TypeScript by default (JSON large-integer safety). The `sebuf.http.int64_encoding` annotation overrides this to generate `number` for fields where the value fits safely in JS Number (timestamps in milliseconds).

**Current state:** The installed `protoc-gen-ts-client` binary (v0.6.0) already has `sebuf.http.int64_encoding` support compiled in (verified via binary strings). However, the BSR-published `sebuf/http/annotations.proto` does NOT expose the `int64_encoding` field extension. This means `buf generate` will fail if protos reference `(sebuf.http.int64_encoding)` because the annotation isn't defined in the dependency proto.

**Resolution path:**
1. Update BSR module `buf.build/sebmelki/sebuf` to publish the annotations.proto that includes `int64_encoding` field extension (extension number 50010)
2. Run `cd proto && buf dep update` to pull new annotations
3. Add annotation to time fields: `int64 occurred_at = 6 [(sebuf.http.int64_encoding) = INT64_ENCODING_NUMBER];`
4. Upgrade Makefile plugins from v0.6.0 to matching version (likely v0.7.0+)
5. Run `make generate` to regenerate all code
6. Verify generated `occurredAt: number` (not `string`)
7. Update handler to return `occurredAt: feature.properties.time` (number, not `String(...)`)

**Scope:** Apply to ALL int64 time fields across all 79 proto files (not just seismology). The user explicitly wants this done project-wide during this phase. There are ~50 int64 time fields across all proto files (see grep results).

**Non-time int64 fields** (e.g., `displacement.proto` counts like `refugees`, `asylum_seekers`, `total`) should NOT get INT64_ENCODING_NUMBER -- these are population counts that could exceed Number.MAX_SAFE_INTEGER. Only fields with `_at` suffix or that represent timestamps should be annotated.

### Anti-Patterns to Avoid

- **Anti-Pattern: Mapping shim between client and components** -- The decision explicitly says "no mapping shim." Components adapt to proto types directly. Don't create a compatibility layer.
- **Anti-Pattern: Keeping legacy and sebuf running side by side** -- Direct switch, no fallback period, no feature flags.
- **Anti-Pattern: Delaying INT64_ENCODING_NUMBER** -- It must be done first because it changes the generated type from `string` to `number`, which affects every consumer of time fields.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTTP client for USGS | Custom fetch wrapper | `SeismologyServiceClient` | Generated, type-safe, handles errors, validates responses |
| Request/response types | Manual TypeScript interfaces | Generated from proto | Single source of truth, auto-updated on proto changes |
| Error handling in client | Custom error parsing | Generated `ApiError`/`ValidationError` classes | Already handles 400 validation and general errors |
| CORS for sebuf routes | Manual CORS headers | `api/server/cors.ts` + gateway | Already handled at gateway level |
| Route matching | Regex-based router | `api/server/router.ts` Map lookup | O(1) lookup, already proven in Phase 2B |

**Key insight:** Everything on the server side is already built. This phase is purely about wiring the frontend to the generated client and cleaning up legacy code.

## Common Pitfalls

### Pitfall 1: INT64_ENCODING_NUMBER BSR Proto Mismatch
**What goes wrong:** Adding `(sebuf.http.int64_encoding) = INT64_ENCODING_NUMBER` to proto files fails `buf generate` because the BSR-published `sebuf/http/annotations.proto` doesn't define the extension field.
**Why it happens:** The installed binary (v0.6.0) has the feature compiled in, but the BSR proto dependency hasn't been updated to match.
**How to avoid:** First update BSR module, then `buf dep update`, then add annotations, then regenerate. Validate with `buf lint` before `buf generate`.
**Warning signs:** `buf generate` error about unknown extension `sebuf.http.int64_encoding`.

### Pitfall 2: Handler occurredAt Type Change
**What goes wrong:** After INT64_ENCODING_NUMBER, the generated server type changes `occurredAt` from `string` to `number`. The current handler returns `occurredAt: String(feature.properties.time)` which is now a type error.
**Why it happens:** Handler was written when `occurredAt` was `string`.
**How to avoid:** In the same commit as INT64_ENCODING_NUMBER, update handler to: `occurredAt: feature.properties.time` (already a number from USGS).
**Warning signs:** TypeScript error in `api/server/worldmonitor/seismology/v1/handler.ts`.

### Pitfall 3: Components Accessing Flat lat/lon After Proto Switch
**What goes wrong:** Components like `DeckGLMap.ts` use `d.lon`, `d.lat` for scatterplot layer positions. Proto type uses `d.location?.latitude` / `d.location?.longitude`. Missing the null check on `location` causes runtime undefined errors.
**Why it happens:** Proto marks `location` as optional (`location?: GeoCoordinates`), so it can be undefined.
**How to avoid:** Always use optional chaining with fallback: `d.location?.longitude ?? 0`. Update all `getPosition` callbacks in DeckGL layers. For Map.ts (SVG), same pattern.
**Warning signs:** Map markers disappearing or rendering at (0, 0).

### Pitfall 4: Date Object vs Epoch Millisecond Number
**What goes wrong:** Legacy code uses `eq.time` as a `Date` object. Proto code uses `occurredAt` as a `number` (epoch ms after INT64 fix). Code that calls `.toISOString()` or does date arithmetic breaks.
**Why it happens:** Fundamental type change from `Date` to `number`.
**How to avoid:** Identify all places that use `eq.time` as a Date: `filterByTime()`, `getTimeAgo()`, `ingestGeoEvent()`, persistent cache serialization. Update each to construct `new Date(occurredAt)` where needed, or work directly with the epoch number.
**Warning signs:** NaN in time displays, persistent cache serialization failures.

### Pitfall 5: Vercel File Routing Priority
**What goes wrong:** Confusion about whether `api/earthquakes.js` or `api/[[...path]].ts` handles `/api/earthquakes` requests.
**Why it happens:** Vercel's file-based routing gives priority to exact path matches over catch-all.
**How to avoid:** This is actually safe -- `api/earthquakes.js` handles `/api/earthquakes`, and `api/[[...path]].ts` handles `/api/seismology/v1/*`. They never conflict. When `earthquakes.js` is deleted, `/api/earthquakes` simply 404s (no fallback needed since client will be calling the new endpoint).
**Warning signs:** None -- this is a non-issue.

### Pitfall 6: SeismologyServiceClient BaseURL
**What goes wrong:** Client instantiated with wrong base URL, causing fetch to wrong host.
**Why it happens:** The client constructor takes a `baseURL` parameter. In this project, it should be `''` (empty string) because all paths are relative (`/api/seismology/v1/...`) and the runtime.ts fetch patch handles Tauri/desktop routing.
**How to avoid:** Always instantiate with `new SeismologyServiceClient('')`. Never pass a host URL. The Tauri fetch patch (`installRuntimeFetchPatch()`) in `runtime.ts` intercepts all `/api/*` requests and routes them to the local sidecar or cloud fallback.
**Warning signs:** CORS errors in dev mode, 404s in production.

### Pitfall 7: POST Method for sebuf Routes
**What goes wrong:** Legacy earthquake endpoint uses GET. Sebuf route uses POST. Frontend code that builds URLs with query params instead of POST body won't work.
**Why it happens:** All sebuf RPCs use POST (2A decision).
**How to avoid:** The generated client already handles this -- `listEarthquakes()` sends POST with JSON body. The adapter wraps this cleanly.
**Warning signs:** 404 or 405 Method Not Allowed errors.

### Pitfall 8: Vite Proxy Removal Timing
**What goes wrong:** Removing the Vite `/api/earthquake` proxy before the client is switched causes dev mode to break during testing.
**Why it happens:** The old client (`src/services/earthquakes.ts`) calls `fetch(API_URLS.earthquakes)` which resolves to `/api/earthquakes`. In dev mode, this is proxied to `earthquake.usgs.gov`.
**How to avoid:** Remove the Vite proxy rule in the same commit as the client switchover. The new client calls `/api/seismology/v1/list-earthquakes` which is intercepted by `sebufApiPlugin` middleware, not the proxy.
**Warning signs:** CORS errors or connection refused in dev mode after partial migration.

## Code Examples

### Generated SeismologyServiceClient Usage

```typescript
// Source: src/generated/client/worldmonitor/seismology/v1/service_client.ts
const client = new SeismologyServiceClient('');

const response = await client.listEarthquakes({
  minMagnitude: 4.5,
  // timeRange and pagination are optional
});

// response.earthquakes: Earthquake[]
// Each earthquake has: id, place, magnitude, depthKm, location?, occurredAt, sourceUrl
```

### Adapter Pattern Implementation

```typescript
// src/services/earthquakes.ts (rewritten)
import {
  SeismologyServiceClient,
  type Earthquake as ProtoEarthquake,
  type ListEarthquakesResponse,
} from '@/generated/client/worldmonitor/seismology/v1/service_client';

const client = new SeismologyServiceClient('');

export async function fetchEarthquakes(): Promise<ProtoEarthquake[]> {
  const response: ListEarthquakesResponse = await client.listEarthquakes({
    minMagnitude: 0,
  });
  return response.earthquakes;
}

// Remove: getEarthquakesStatus(), getEarthquakesDataState()
// These depend on the circuit breaker which is no longer needed --
// error handling is in the generated client (ApiError) and handler (error-mapper).
```

### Component Adaptation Example (DeckGLMap)

```typescript
// Before (legacy):
getPosition: (d) => [d.lon, d.lat],
getRadius: (d) => Math.pow(2, d.magnitude) * 1000,

// After (proto):
getPosition: (d) => [d.location?.longitude ?? 0, d.location?.latitude ?? 0],
getRadius: (d) => Math.pow(2, d.magnitude) * 1000,
```

### MapPopup Adaptation Example

```typescript
// Before (legacy):
earthquake.depth.toFixed(1)
earthquake.lat.toFixed(2)
earthquake.time  // Date object

// After (proto):
earthquake.depthKm.toFixed(1)
earthquake.location?.latitude?.toFixed(2) ?? 'N/A'
new Date(earthquake.occurredAt)  // number -> Date
earthquake.sourceUrl  // was: earthquake.url
```

### INT64_ENCODING_NUMBER Proto Annotation

```protobuf
// Before:
int64 occurred_at = 6;

// After:
import "sebuf/http/annotations.proto";

int64 occurred_at = 6 [(sebuf.http.int64_encoding) = INT64_ENCODING_NUMBER];
```

### Handler Update After INT64 Fix

```typescript
// Before (Phase 2B):
occurredAt: String(f.properties.time),

// After (Phase 2C):
occurredAt: f.properties.time,  // number, not string
```

### Vite Config -- Proxy Rule to Remove

```typescript
// Remove this from vite.config.ts proxy section:
'/api/earthquake': {
  target: 'https://earthquake.usgs.gov',
  changeOrigin: true,
  timeout: 30000,
  rewrite: (path) => path.replace(/^\/api\/earthquake/, ''),
  configure: (proxy) => {
    proxy.on('error', (err) => {
      console.log('Earthquake proxy error:', err.message);
    });
  },
},
```

### API_URLS Config -- Entry to Remove

```typescript
// Remove from src/config/variants/base.ts:
earthquakes: '/api/earthquakes',
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|---|---|---|---|
| `api/earthquakes.js` (Vercel edge function) | `api/[[...path]].ts` catch-all + `handler.ts` | Phase 2B | All sebuf domains routed through single gateway |
| `src/services/earthquakes.ts` (direct fetch + circuit breaker) | Generated `SeismologyServiceClient` via adapter | This phase (2C) | Type-safe client, generated error handling |
| `int64` -> `string` in TypeScript | `int64` -> `number` via INT64_ENCODING_NUMBER | This phase (2C) | All time fields become proper JS numbers |
| Direct USGS proxy in Vite dev | `sebufApiPlugin` middleware | Phase 2B | Consistent handler pipeline in dev and prod |

## Recommendations for Claude's Discretion Areas

### Testing Approach

**Recommendation: Manual smoke tests per sub-step, plus one lightweight integration test for the full pipeline.**

Rationale:
- The project uses `node --test` for API tests and Playwright for E2E. There's no vitest or Jest for unit tests.
- Manual testing is faster for this migration since the changes are mostly type rewiring.
- Suggested smoke tests:
  1. After INT64_ENCODING_NUMBER: `make generate`, verify `occurredAt: number` in generated code, run `tsc` on `tsconfig.api.json`
  2. After client switch: run dev server, open browser, verify earthquakes appear on map
  3. After component update: verify popup shows correct data (depth, time, coordinates)
  4. After legacy cleanup: verify no 404s for new endpoint, old endpoint removed
- Optional: add a `node --test` case in `tests/` that calls the seismology endpoint and validates response shape

### Adapter/Port Implementation

**Recommendation: Minimal adapter that exposes `fetchEarthquakes()` returning proto `Earthquake[]` directly.**

The Go reference pattern has ports as interfaces and adapters as classes. In TypeScript for this project:
- The "port" is just the function signature: `fetchEarthquakes(): Promise<Earthquake[]>`
- The "adapter" is the module that instantiates `SeismologyServiceClient` and calls it
- No need for an explicit interface/class -- a simple module with exported functions suffices
- The circuit breaker, persistent cache, and `API_URLS.earthquakes` reference are all removed
- Error handling flows through the generated client's `ApiError` class

### Component Refactoring Approach

**Recommendation: Update each file in a single pass with atomic commit per file.**

The type differences are small and mechanical:
- `lat` -> `location?.latitude ?? 0`
- `lon` -> `location?.longitude ?? 0`
- `depth` -> `depthKm`
- `time` -> `new Date(occurredAt)` where Date is needed, or `occurredAt` where epoch ms works
- `url` -> `sourceUrl`

Files that only reference counts (CountryBriefPage, CountryIntelModal, PopulationExposurePanel) need no type changes -- they don't access Earthquake fields, just `.length` or signal counts.

The `filterByTime` method in Map.ts and DeckGLMap.ts needs the time accessor function updated: `(eq) => eq.time` becomes `(eq) => new Date(eq.occurredAt)` or the filterByTime function itself needs to accept epoch ms.

## Open Questions

1. **BSR Annotations Proto Update**
   - What we know: The installed binary (v0.6.0) has `sebuf.http.int64_encoding` support. The BSR proto does NOT expose it. Extension number is 50010.
   - What's unclear: Does the user need to push an updated annotations.proto to BSR first, or is there a local workaround?
   - Recommendation: This is a prerequisite task for the user. The planner should make it the first task with a clear note that it may require sebuf repo changes. If the BSR update is not possible immediately, a workaround is to vendor the annotations.proto locally (copy into `proto/sebuf/http/annotations.proto` with the added extension). However, this creates drift from BSR.

2. **Non-Time int64 Fields**
   - What we know: ~50 int64 fields exist across all protos. Not all are timestamps -- displacement counts, humanitarian population numbers could be very large.
   - What's unclear: Exact safe threshold for INT64_ENCODING_NUMBER (JS MAX_SAFE_INTEGER = 2^53 - 1, or ~9 quadrillion). Timestamps in ms are ~1.7 trillion, well within range. Population counts could also be within range (world population is ~8 billion).
   - Recommendation: Apply INT64_ENCODING_NUMBER to all fields with `_at` suffix (timestamps). For count fields, leave as string for safety since some displacement/humanitarian figures could theoretically exceed safe integer. A comment in the proto file should document this decision.

3. **Circuit Breaker / Persistent Cache Removal**
   - What we know: The legacy `earthquakes.ts` uses `createCircuitBreaker` and `getPersistentCache`/`setPersistentCache` for resilience.
   - What's unclear: Whether the sebuf client + handler pipeline provides equivalent resilience.
   - Recommendation: The sebuf handler throws on USGS failure, the gateway `error-mapper.ts` converts to 502, and the generated client throws `ApiError`. There's no automatic retry or cache. For Phase 2C, this is acceptable -- the original circuit breaker was a nicety, not critical. The Tauri fetch patch has its own retry logic (`fetchLocalWithStartupRetry`). If resilience is needed later, it can be added to the adapter layer.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `api/earthquakes.js`, `api/[[...path]].ts`, `api/server/worldmonitor/seismology/v1/handler.ts`
- Codebase analysis: `src/generated/client/worldmonitor/seismology/v1/service_client.ts` (generated types)
- Codebase analysis: `src/generated/server/worldmonitor/seismology/v1/service_server.ts` (generated server)
- Codebase analysis: `src/services/earthquakes.ts` (legacy client)
- Codebase analysis: `src/types/index.ts` (legacy Earthquake interface, line 488)
- Codebase analysis: `src/App.ts` (earthquake data flow through loadNatural())
- Codebase analysis: `src/components/Map.ts`, `DeckGLMap.ts`, `MapPopup.ts` (rendering consumers)
- Codebase analysis: `src/services/geo-convergence.ts` (earthquake ingestion)
- Codebase analysis: `vite.config.ts` (sebufApiPlugin + proxy rules)
- Codebase analysis: `Makefile` (sebuf plugin versions, generate target)
- Codebase analysis: `proto/buf.gen.yaml`, `proto/buf.yaml`, `proto/buf.lock` (build config)
- Codebase analysis: `scripts/build-sidecar-sebuf.mjs` (esbuild bundling)
- Binary analysis: `protoc-gen-ts-client` binary strings confirm `sebuf.http.int64_encoding` extension 50010
- BSR export: `buf.build/sebmelki/sebuf` annotations.proto (does NOT include int64_encoding)

### Secondary (MEDIUM confidence)
- Reference implementation: `koussa/internal/modules/playlist` (Go port/adapter pattern)
- Phase 2B research: `.planning/phases/02-server-runtime/02-RESEARCH.md` (handler patterns, pitfalls)
- Project state: `.planning/STATE.md` (accumulated decisions)

### Tertiary (LOW confidence)
- None -- all findings verified against actual codebase.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all tooling already in place from Phase 2A/2B, verified against actual files
- Architecture: HIGH -- port/adapter pattern verified against koussa reference, type gaps documented with exact field mappings from actual generated code
- Pitfalls: HIGH -- all pitfalls derived from actual code analysis (type mismatches, BSR proto gap, handler updates needed)
- INT64_ENCODING_NUMBER: MEDIUM -- binary supports it, but BSR proto gap is real and needs resolution before work begins

**Research date:** 2026-02-18
**Valid until:** 2026-03-18 (stable -- proto definitions and generated code don't change externally)
