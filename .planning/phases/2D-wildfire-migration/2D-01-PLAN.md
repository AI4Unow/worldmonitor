---
phase: 2D-wildfire-migration
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - proto/worldmonitor/wildfire/v1/fire_detection.proto
  - src/generated/server/worldmonitor/wildfire/v1/service_server.ts
  - src/generated/client/worldmonitor/wildfire/v1/service_client.ts
  - api/server/worldmonitor/wildfire/v1/handler.ts
  - api/[[...path]].ts
autonomous: true
requirements: [DOMAIN-01, SERVER-02]

must_haves:
  truths:
    - "FireDetection proto includes region and day_night fields"
    - "Handler fetches all 9 monitored regions from NASA FIRMS CSV API in parallel"
    - "Handler maps CSV rows to proto-typed FireDetection objects with correct confidence enum mapping"
    - "Handler returns empty list gracefully when NASA_FIRMS_API_KEY is missing"
    - "POST /api/wildfire/v1/list-fire-detections is routable through the gateway"
    - "Sidecar bundle compiles with wildfire routes included"
  artifacts:
    - path: "proto/worldmonitor/wildfire/v1/fire_detection.proto"
      provides: "FireDetection with region and day_night fields"
      contains: "string region = 8"
    - path: "api/server/worldmonitor/wildfire/v1/handler.ts"
      provides: "WildfireServiceHandler implementation"
      exports: ["wildfireHandler"]
    - path: "api/[[...path]].ts"
      provides: "Gateway with wildfire routes mounted"
      contains: "createWildfireServiceRoutes"
  key_links:
    - from: "api/server/worldmonitor/wildfire/v1/handler.ts"
      to: "src/generated/server/worldmonitor/wildfire/v1/service_server.ts"
      via: "implements WildfireServiceHandler interface"
      pattern: "WildfireServiceHandler"
    - from: "api/[[...path]].ts"
      to: "api/server/worldmonitor/wildfire/v1/handler.ts"
      via: "imports wildfireHandler and mounts routes"
      pattern: "wildfireHandler"
---

<objective>
Implement the WildfireService server-side: enhance the FireDetection proto with missing fields, implement the handler that proxies NASA FIRMS CSV API, wire it into the catch-all gateway, and rebuild the sidecar bundle.

Purpose: Establishes the backend for wildfire data, validating the env-var gating pattern (NASA_FIRMS_API_KEY) and CSV-parsing handler pattern that future domains may need.
Output: Working POST /api/wildfire/v1/list-fire-detections endpoint returning proto-typed fire detections from all 9 monitored regions.
</objective>

<execution_context>
@/Users/sebastienmelki/.claude/get-shit-done/workflows/execute-plan.md
@/Users/sebastienmelki/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/2D-wildfire-migration/2D-RESEARCH.md
@.planning/phases/2C-seismology-migration/2C-02-SUMMARY.md

@api/server/worldmonitor/seismology/v1/handler.ts
@api/[[...path]].ts
@proto/worldmonitor/wildfire/v1/fire_detection.proto
@proto/worldmonitor/wildfire/v1/service.proto
@src/generated/server/worldmonitor/wildfire/v1/service_server.ts
@api/firms-fires.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Enhance FireDetection proto, regenerate, and implement wildfire handler</name>
  <files>
    proto/worldmonitor/wildfire/v1/fire_detection.proto
    api/server/worldmonitor/wildfire/v1/handler.ts
  </files>
  <action>
**Step 1: Add missing fields to FireDetection proto.**

In `proto/worldmonitor/wildfire/v1/fire_detection.proto`, add two fields to the `FireDetection` message after `detected_at` (field 7):

```proto
// Monitored region name (e.g., "Ukraine", "Russia", "Iran").
string region = 8;
// Day or night detection ("D" or "N").
string day_night = 9;
```

No validation annotations needed on these string fields -- they are handler-assigned, not user input.

**Step 2: Regenerate TypeScript code.**

Run `make generate` to regenerate all TypeScript from updated protos. Verify the generated `FireDetection` interface in both `src/generated/client/worldmonitor/wildfire/v1/service_client.ts` and `src/generated/server/worldmonitor/wildfire/v1/service_server.ts` now includes `region: string` and `dayNight: string` fields.

**Step 3: Implement the wildfire handler.**

Create `api/server/worldmonitor/wildfire/v1/handler.ts` following the seismology handler pattern (`api/server/worldmonitor/seismology/v1/handler.ts`).

The handler must:

1. **Read env var**: `const apiKey = process.env.NASA_FIRMS_API_KEY || process.env.FIRMS_API_KEY || '';`
2. **Graceful degradation**: If `!apiKey`, return `{ fireDetections: [], pagination: undefined }` immediately (no error thrown).
3. **Define monitored regions** as a `Record<string, string>` mapping region name to bbox string:
   - `'Ukraine': '22,44,40,53'`
   - `'Russia': '20,50,180,82'`
   - `'Iran': '44,25,63,40'`
   - `'Israel/Gaza': '34,29,36,34'`
   - `'Syria': '35,32,42,37'`
   - `'Taiwan': '119,21,123,26'`
   - `'North Korea': '124,37,131,43'`
   - `'Saudi Arabia': '34,16,56,32'`
   - `'Turkey': '26,36,45,42'`
4. **Fetch all regions in parallel** using `Promise.allSettled`. For each region:
   - URL: `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${apiKey}/VIIRS_SNPP_NRT/${bbox}/1`
   - Headers: `{ Accept: 'text/csv' }`
   - Parse the CSV response (see below)
   - Tag each detection with the region name
5. **CSV parsing**: Write a `parseCSV(csv: string)` helper:
   - Split by newlines, first line is headers
   - For each data row, split by comma, map by header index
   - Return array of parsed row objects
6. **Map CSV rows to FireDetection**: For each parsed row:
   - `id`: Generate as `${region}-${index}` or use `${latitude}-${longitude}-${acq_date}-${acq_time}` for uniqueness
   - `location`: `{ latitude: parseFloat(row.latitude), longitude: parseFloat(row.longitude) }`
   - `brightness`: `parseFloat(row.bright_ti4) || 0`
   - `frp`: `parseFloat(row.frp) || 0`
   - `confidence`: Map letter to enum -- `'h'` -> `'FIRE_CONFIDENCE_HIGH'`, `'n'` -> `'FIRE_CONFIDENCE_NOMINAL'`, `'l'` -> `'FIRE_CONFIDENCE_LOW'`, default -> `'FIRE_CONFIDENCE_UNSPECIFIED'`
   - `satellite`: `row.satellite || ''`
   - `detectedAt`: Parse `acq_date` + `acq_time` to epoch ms. Pattern: `acq_date` is `YYYY-MM-DD`, `acq_time` is `HHMM`. Combine: `new Date(acq_date + 'T' + acq_time.padStart(4, '0').slice(0,2) + ':' + acq_time.padStart(4, '0').slice(2) + ':00Z').getTime()`
   - `region`: The region name string
   - `dayNight`: `row.daynight || ''`
7. **Collect results**: Flatten all successful region results into a single `fireDetections` array. Log failures to console.error with `[FIRMS]` prefix (matching legacy pattern). Skip failed regions.
8. **Return**: `{ fireDetections, pagination: undefined }`

Import types from the generated server file using the same relative path pattern as seismology:
```typescript
import type {
  WildfireServiceHandler,
  ServerContext,
  ListFireDetectionsRequest,
  ListFireDetectionsResponse,
  FireConfidence,
} from '../../../../../src/generated/server/worldmonitor/wildfire/v1/service_server';
```

Export `wildfireHandler` as a named const implementing `WildfireServiceHandler`.
  </action>
  <verify>
Run `make generate` and confirm no errors. Run `npx tsc --noEmit` and confirm the handler compiles with zero errors. Grep the generated client file for `region` and `dayNight` to confirm fields are present.
  </verify>
  <done>
FireDetection proto has `region` (field 8) and `day_night` (field 9). Generated TypeScript interfaces include `region: string` and `dayNight: string`. Handler file exists at `api/server/worldmonitor/wildfire/v1/handler.ts`, exports `wildfireHandler`, type-checks cleanly.
  </done>
</task>

<task type="auto">
  <name>Task 2: Wire wildfire routes into gateway and rebuild sidecar</name>
  <files>
    api/[[...path]].ts
  </files>
  <action>
**Step 1: Mount wildfire routes in the catch-all gateway.**

In `api/[[...path]].ts`:
1. Add import for the wildfire route creator alongside the existing seismology import:
   ```typescript
   import { createWildfireServiceRoutes } from '../src/generated/server/worldmonitor/wildfire/v1/service_server';
   import { wildfireHandler } from './server/worldmonitor/wildfire/v1/handler';
   ```
2. Add wildfire routes to `allRoutes`:
   ```typescript
   const allRoutes = [
     ...createSeismologyServiceRoutes(seismologyHandler, serverOptions),
     ...createWildfireServiceRoutes(wildfireHandler, serverOptions),
   ];
   ```
3. Note: `ServerOptions` type is already imported from seismology -- the same `serverOptions` const works for both since `onError: mapErrorToResponse` is service-agnostic.

**Step 2: Rebuild the sidecar sebuf bundle.**

Run `npm run build:sidecar-sebuf` to rebuild the Tauri sidecar bundle with the new wildfire routes included. This must succeed without errors.

**Step 3: Type check the full project.**

Run `npx tsc --noEmit` to verify no type errors were introduced.
  </action>
  <verify>
Run `npx tsc --noEmit` -- zero errors. Run `npm run build:sidecar-sebuf` -- succeeds. Grep `api/[[...path]].ts` for `createWildfireServiceRoutes` to confirm it is wired in.
  </verify>
  <done>
Gateway mounts wildfire routes. Sidecar bundle compiles with wildfire included. Full type check passes.
  </done>
</task>

</tasks>

<verification>
1. `make generate` succeeds with updated proto
2. `npx tsc --noEmit` passes with zero errors
3. `npm run build:sidecar-sebuf` succeeds
4. `api/server/worldmonitor/wildfire/v1/handler.ts` exists and exports `wildfireHandler`
5. `api/[[...path]].ts` includes `createWildfireServiceRoutes`
6. Generated `FireDetection` interface has `region` and `dayNight` fields
</verification>

<success_criteria>
POST /api/wildfire/v1/list-fire-detections is a routable endpoint that, when NASA_FIRMS_API_KEY is set, fetches CSV fire data from all 9 monitored regions and returns proto-typed FireDetection objects. When the key is missing, it returns an empty list without error.
</success_criteria>

<output>
After completion, create `.planning/phases/2D-wildfire-migration/2D-01-SUMMARY.md`
</output>
