---
phase: 2C-seismology-migration
plan: 02
type: execute
wave: 2
depends_on:
  - 2C-01
files_modified:
  - src/services/earthquakes.ts
  - src/App.ts
  - src/components/Map.ts
  - src/components/DeckGLMap.ts
  - src/components/MapPopup.ts
  - src/components/MapContainer.ts
  - src/services/geo-convergence.ts
  - src/e2e/map-harness.ts
  - api/earthquakes.js
  - vite.config.ts
  - src/config/variants/base.ts
autonomous: true
requirements:
  - CLIENT-02
  - CLIENT-04
  - CLEAN-01
  - CLEAN-02

must_haves:
  truths:
    - "Frontend calls SeismologyServiceClient (via adapter) instead of legacy fetch to /api/earthquakes"
    - "Earthquake data renders correctly on all map implementations (SVG + DeckGL)"
    - "Earthquake popup shows correct depth, coordinates, time, and USGS link"
    - "Geo-convergence ingestion works with proto earthquake types"
    - "Legacy api/earthquakes.js is deleted"
    - "Vite proxy for /api/earthquake is removed"
    - "No code imports from @/types for the Earthquake type in migrated files"
  artifacts:
    - path: "src/services/earthquakes.ts"
      provides: "Port/adapter wrapping SeismologyServiceClient"
      contains: "SeismologyServiceClient"
    - path: "src/App.ts"
      provides: "loadNatural() calling adapter fetchEarthquakes()"
      contains: "fetchEarthquakes"
    - path: "src/components/DeckGLMap.ts"
      provides: "Earthquake layer using proto field names (location?.longitude)"
      contains: "location?.longitude"
    - path: "src/components/MapPopup.ts"
      provides: "Earthquake popup using depthKm, location, occurredAt, sourceUrl"
      contains: "depthKm"
  key_links:
    - from: "src/services/earthquakes.ts"
      to: "src/generated/client/worldmonitor/seismology/v1/service_client.ts"
      via: "SeismologyServiceClient import and instantiation"
      pattern: "new SeismologyServiceClient"
    - from: "src/App.ts"
      to: "src/services/earthquakes.ts"
      via: "fetchEarthquakes() import"
      pattern: "import.*fetchEarthquakes.*from.*services/earthquakes"
    - from: "src/components/DeckGLMap.ts"
      to: "src/generated/client/worldmonitor/seismology/v1/service_client.ts"
      via: "Earthquake type import (proto type)"
      pattern: "location\\?\\.longitude"
    - from: "src/services/geo-convergence.ts"
      to: "src/generated/client/worldmonitor/seismology/v1/service_client.ts"
      via: "Earthquake type for ingestEarthquakes"
      pattern: "location\\?\\.latitude"
---

<objective>
Rewrite the seismology frontend service with a port/adapter pattern backed by the generated SeismologyServiceClient, adapt all consuming components to use proto Earthquake field names, and delete the legacy api/earthquakes.js endpoint along with its Vite proxy and API_URLS config entry.

Purpose: This completes the first end-to-end domain migration (seismology), establishing the pattern for all subsequent 2D-2S migrations. The frontend moves from hand-written fetch to a generated, type-safe sebuf client.

Output: Rewritten adapter in earthquakes.ts, all 6+ consuming files adapted to proto types, legacy endpoint and proxy deleted.
</objective>

<execution_context>
@/Users/sebastienmelki/.claude/get-shit-done/workflows/execute-plan.md
@/Users/sebastienmelki/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/2C-seismology-migration/2C-RESEARCH.md
@.planning/phases/2C-seismology-migration/2C-01-SUMMARY.md
@src/services/earthquakes.ts
@src/generated/client/worldmonitor/seismology/v1/service_client.ts
@src/App.ts
@src/components/Map.ts
@src/components/DeckGLMap.ts
@src/components/MapPopup.ts
@src/components/MapContainer.ts
@src/services/geo-convergence.ts
@src/e2e/map-harness.ts
@api/earthquakes.js
@vite.config.ts
@src/config/variants/base.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Rewrite earthquakes.ts adapter and adapt all consuming components to proto types</name>
  <files>
    src/services/earthquakes.ts
    src/App.ts
    src/components/Map.ts
    src/components/DeckGLMap.ts
    src/components/MapPopup.ts
    src/components/MapContainer.ts
    src/services/geo-convergence.ts
    src/e2e/map-harness.ts
  </files>
  <action>
    **Step 1: Rewrite `src/services/earthquakes.ts` with port/adapter pattern.**

    Replace the entire file contents. The new module:
    - Imports `SeismologyServiceClient` and `Earthquake` type (as `ProtoEarthquake`) from `@/generated/client/worldmonitor/seismology/v1/service_client`
    - Re-exports the `Earthquake` type so consumers can import it from this module (the "port")
    - Creates a `SeismologyServiceClient` instance with empty string baseURL (`new SeismologyServiceClient('')`)
    - Exports `fetchEarthquakes(): Promise<Earthquake[]>` that calls `client.listEarthquakes({ minMagnitude: 0 })` and returns `response.earthquakes`
    - Removes: `getEarthquakesStatus()`, `getEarthquakesDataState()` (unused exports), circuit breaker, persistent cache, `USGSFeature`/`USGSResponse` interfaces, `API_URLS` import, `getFallbackEarthquakes()`
    - The adapter is minimal -- no class needed, just a module with exported functions per the port/adapter pattern (per Claude's discretion from research)

    ```typescript
    // src/services/earthquakes.ts
    import {
      SeismologyServiceClient,
      type Earthquake,
    } from '@/generated/client/worldmonitor/seismology/v1/service_client';

    // Re-export the proto Earthquake type as the domain's public type
    export type { Earthquake };

    const client = new SeismologyServiceClient('');

    export async function fetchEarthquakes(): Promise<Earthquake[]> {
      const response = await client.listEarthquakes({ minMagnitude: 0 });
      return response.earthquakes;
    }
    ```

    **Step 2: Update import paths in all consuming files.**

    Every file that currently imports `Earthquake` from `@/types` must be updated to import from `@/services/earthquakes` instead (the port). This follows the locked decision: "Consuming code imports the port (interface), never the adapter directly."

    However, per the locked decision "Leave legacy TypeScript types (Earthquake in src/types/index.ts) until Phase 2T", do NOT delete the legacy `Earthquake` type from `src/types/index.ts`. Just stop importing it in the migrated files.

    Files to update imports:

    a. **`src/App.ts`** (line 15 area): Change `Earthquake` import from `@/types` to `@/services/earthquakes`. The `fetchEarthquakes` import stays from `@/services/earthquakes` (already correct). Update the `intelligenceCache` type annotation at line ~3480 from `import('@/types').Earthquake[]` to use the locally-imported `Earthquake` type.

    b. **`src/components/Map.ts`** (line 7): Change `Earthquake` import from `@/types` to `@/services/earthquakes`.

    c. **`src/components/DeckGLMap.ts`**: Change `Earthquake` import from `@/types` to `@/services/earthquakes`.

    d. **`src/components/MapPopup.ts`** (line 1): Change `Earthquake` import from `@/types` to `@/services/earthquakes`.

    e. **`src/services/geo-convergence.ts`** (line 1): Change `Earthquake` import from `@/types` to `@/services/earthquakes`.

    f. **`src/e2e/map-harness.ts`**: Change `Earthquake` import from `@/types` to `@/services/earthquakes`.

    g. **`src/components/MapContainer.ts`**: Check if it imports `Earthquake` directly -- if it only passes through arrays, the type may be inferred. Update if needed.

    **Step 3: Adapt field accesses in each consuming file.**

    The proto Earthquake type has different field names. Apply these changes mechanically:

    | Legacy | Proto | Notes |
    |--------|-------|-------|
    | `eq.lat` | `eq.location?.latitude ?? 0` | Nested, optional with fallback |
    | `eq.lon` | `eq.location?.longitude ?? 0` | Nested, optional with fallback |
    | `eq.depth` | `eq.depthKm` | Rename |
    | `eq.time` | `eq.occurredAt` | number (epoch ms) after INT64 fix, NOT Date |
    | `eq.url` | `eq.sourceUrl` | Rename |

    Per-file changes:

    **a. `src/App.ts`:**
    - Line ~905: `inCountry(eq.lat, eq.lon)` -> `inCountry(eq.location?.latitude ?? 0, eq.location?.longitude ?? 0)`
    - Line ~907: `new Date(eq.time).getTime()` -> `eq.occurredAt` (already a number, no Date conversion needed)
    - Line ~1090: `this.isInCountry(eq.lat, eq.lon, code)` -> `this.isInCountry(eq.location?.latitude ?? 0, eq.location?.longitude ?? 0, code)`

    **b. `src/components/Map.ts`:**
    - Line ~1398: `projection([eq.lon, eq.lat])` -> `projection([eq.location?.longitude ?? 0, eq.location?.latitude ?? 0])`
    - Line ~1400: `eq.lon, eq.lat` in console.log -> `eq.location?.longitude, eq.location?.latitude`
    - The `setEarthquakes` method signature stays as `Earthquake[]` but now uses the proto type.

    **c. `src/components/DeckGLMap.ts`:**
    - Line ~906: `(eq) => eq.time` in `filterByTime` call -> `(eq) => eq.occurredAt`. The `filterByTime` method accepts `Date | string | number | undefined | null`, so passing a `number` (epoch ms) works without conversion.
    - Line ~973: `d => [d.lon, d.lat]` in ghost layer -> `d => [d.location?.longitude ?? 0, d.location?.latitude ?? 0]`
    - In `createEarthquakesLayer`: any `d.lon`, `d.lat` -> `d.location?.longitude ?? 0`, `d.location?.latitude ?? 0`
    - In `getPosition` callback for earthquakes scatterplot: same transformation.
    - Search for ALL occurrences of `d.lon`, `d.lat` in earthquake-related layers.

    **d. `src/components/MapPopup.ts`:**
    - Line ~635: `this.getTimeAgo(earthquake.time)` -> `this.getTimeAgo(new Date(earthquake.occurredAt))`. The `getTimeAgo` method takes `Date`, so convert epoch ms to Date.
    - Line ~648: `earthquake.depth.toFixed(1)` -> `earthquake.depthKm.toFixed(1)`
    - Line ~652: `earthquake.lat.toFixed(2)°, ${earthquake.lon.toFixed(2)°` -> `(earthquake.location?.latitude ?? 0).toFixed(2)°, ${(earthquake.location?.longitude ?? 0).toFixed(2)°`
    - Line ~659: `earthquake.url` -> `earthquake.sourceUrl`

    **e. `src/services/geo-convergence.ts`:**
    - Line ~86: `ingestGeoEvent(q.lat, q.lon, 'earthquake', q.time)` -> `ingestGeoEvent(q.location?.latitude ?? 0, q.location?.longitude ?? 0, 'earthquake', new Date(q.occurredAt))`
    - The `ingestGeoEvent` function takes `timestamp: Date = new Date()`, so convert epoch ms to Date.

    **f. `src/e2e/map-harness.ts`:**
    - Line ~797-808: Update the test earthquake data to match proto shape:
      ```typescript
      const earthquakes: Earthquake[] = [
        {
          id: 'e2e-eq-1',
          place: 'Harness Fault',
          magnitude: 5.8,
          depthKm: 12,
          location: { latitude: 34.1, longitude: -118.2 },
          occurredAt: new Date('2026-02-01T10:00:00.000Z').getTime(),
          sourceUrl: 'https://example.com/eq',
        },
      ];
      ```
    - Update the `Earthquake` import to come from `@/services/earthquakes`.

    **g. `src/components/MapContainer.ts`:**
    - The `setEarthquakes` method is a pass-through to SVG and DeckGL maps. If it imports `Earthquake` from `@/types`, change to `@/services/earthquakes`. The method signature stays the same (accepts `Earthquake[]`).

    **Step 4: Type-check the full frontend.**

    ```bash
    npx tsc --noEmit
    ```

    Fix any remaining type errors. Common issues:
    - Missing optional chaining on `location`
    - Methods expecting `Date` receiving `number` (add `new Date()` wrapper)
    - Forgotten field renames

    **Step 5: Verify the build.**

    ```bash
    npm run build
    ```

    Must succeed with no errors.
  </action>
  <verify>
    1. `npx tsc --noEmit` -- zero errors
    2. `npm run build` -- succeeds
    3. `grep "SeismologyServiceClient" src/services/earthquakes.ts` -- matches (adapter uses generated client)
    4. `grep "eq\.lat\|eq\.lon\|eq\.depth\|eq\.time\|eq\.url\b" src/App.ts src/components/Map.ts src/components/DeckGLMap.ts src/components/MapPopup.ts src/services/geo-convergence.ts` -- no matches (all legacy field names replaced)
    5. `grep "from '@/types'" src/services/earthquakes.ts` -- no match (no longer imports from legacy types)
    6. `grep "earthquake\.url\b" src/components/MapPopup.ts` -- no match (replaced with sourceUrl)
  </verify>
  <done>
    `src/services/earthquakes.ts` is rewritten as a port/adapter using `SeismologyServiceClient`. All 7 consuming files are adapted to proto field names (`location?.latitude`, `depthKm`, `occurredAt`, `sourceUrl`). All code compiles and builds without errors. The legacy `Earthquake` type in `@/types` is preserved (per decision) but no longer imported by migrated files.
  </done>
</task>

<task type="auto">
  <name>Task 2: Delete legacy earthquake endpoint, remove Vite proxy, and clean config</name>
  <files>
    api/earthquakes.js
    vite.config.ts
    src/config/variants/base.ts
  </files>
  <action>
    Per locked decision: "Delete api/earthquakes.js in the same commit as the client switchover."

    **Step 1: Delete `api/earthquakes.js`.**

    ```bash
    rm api/earthquakes.js
    ```

    This file is the legacy Vercel edge function that proxied USGS data. The catch-all gateway `api/[[...path]].ts` now handles seismology via the sebuf handler at `POST /api/seismology/v1/list-earthquakes`.

    **Step 2: Remove the Vite proxy rule for earthquakes.**

    In `vite.config.ts`, remove the entire `/api/earthquake` proxy block (lines ~483-494):
    ```typescript
    // Remove this entire block:
    // USGS Earthquake API
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

    The new client calls `POST /api/seismology/v1/list-earthquakes`, which is intercepted by `sebufApiPlugin` middleware in dev mode, not the proxy.

    **Step 3: Remove `earthquakes` from `API_URLS` config.**

    In `src/config/variants/base.ts` (line 18), remove:
    ```typescript
    earthquakes: '/api/earthquakes',
    ```

    This URL is no longer referenced by any code (the adapter uses the generated client, not `API_URLS.earthquakes`).

    **Step 4: Rebuild sidecar bundle.**

    ```bash
    npm run build:sidecar-sebuf
    ```

    The sidecar bundle should still work -- it compiles `api/[[...path]].ts` which doesn't reference `api/earthquakes.js`.

    **Step 5: Verify no dangling references.**

    ```bash
    grep -r "api/earthquakes" src/ api/ --include="*.ts" --include="*.js" --include="*.mjs"
    grep -r "API_URLS.earthquakes" src/
    ```

    Both should return zero results (except possibly comments, which are fine).

    **Step 6: Full build verification.**

    ```bash
    npm run build
    ```

    Must succeed.
  </action>
  <verify>
    1. `ls api/earthquakes.js 2>/dev/null` -- file does not exist
    2. `grep "/api/earthquake" vite.config.ts` -- no matches (proxy removed)
    3. `grep "earthquakes:" src/config/variants/base.ts` -- no match (API_URLS entry removed)
    4. `grep -r "API_URLS.earthquakes" src/` -- no matches
    5. `npm run build:sidecar-sebuf` -- succeeds
    6. `npm run build` -- succeeds
  </verify>
  <done>
    Legacy `api/earthquakes.js` deleted. Vite proxy for `/api/earthquake` removed. `API_URLS.earthquakes` config entry removed. No dangling references. Full build passes. The seismology domain is fully migrated from legacy to sebuf.
  </done>
</task>

</tasks>

<verification>
1. `npx tsc --noEmit` -- zero type errors across entire frontend
2. `npx tsc -p tsconfig.api.json --noEmit` -- zero API type errors
3. `npm run build` -- full build succeeds (tsc + vite + sidecar)
4. `api/earthquakes.js` does not exist
5. No imports of `Earthquake` from `@/types` in any migrated file
6. `src/services/earthquakes.ts` uses `SeismologyServiceClient`
7. No `eq.lat`, `eq.lon`, `eq.depth`, `eq.time`, `eq.url` references in migrated files
8. Vite proxy for earthquakes removed
9. `API_URLS.earthquakes` removed
</verification>

<success_criteria>
- `fetchEarthquakes()` calls `SeismologyServiceClient.listEarthquakes()` instead of legacy fetch
- All 6+ consuming files use proto field names (location?.latitude, depthKm, occurredAt, sourceUrl)
- Legacy `api/earthquakes.js` deleted
- Vite proxy for `/api/earthquake` removed
- `API_URLS.earthquakes` config entry removed
- Full project builds with zero errors
- E2E test data updated to proto shape
</success_criteria>

<output>
After completion, create `.planning/phases/2C-seismology-migration/2C-02-SUMMARY.md`
</output>
