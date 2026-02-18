---
phase: 2D-wildfire-migration
plan: 02
type: execute
wave: 2
depends_on: [2D-01]
files_modified:
  - src/services/wildfires/index.ts
  - src/App.ts
  - src/components/SatelliteFiresPanel.ts
  - src/services/signal-aggregator.ts
  - src/components/MapContainer.ts
  - src/components/Map.ts
  - src/components/DeckGLMap.ts
  - src/e2e/map-harness.ts
autonomous: true
requirements: [DOMAIN-01, SERVER-02]

must_haves:
  truths:
    - "App.ts loads fire data via the new wildfires service module using WildfireServiceClient"
    - "Fire detections appear on the map layer with correct position, brightness, and FRP"
    - "SatelliteFiresPanel displays region stats computed from proto-typed data"
    - "Signal aggregator receives fire data with correct field mappings"
    - "Missing API key shows config error in panel without crashing"
    - "Legacy firms-satellite.ts and api/firms-fires.js are deleted"
  artifacts:
    - path: "src/services/wildfires/index.ts"
      provides: "Wildfire service module with fetchAllFires, computeRegionStats, flattenFires"
      exports: ["fetchAllFires", "computeRegionStats", "flattenFires", "FireRegionStats"]
    - path: "src/App.ts"
      provides: "loadFirmsData using wildfires service"
      contains: "@/services/wildfires"
  key_links:
    - from: "src/services/wildfires/index.ts"
      to: "src/generated/client/worldmonitor/wildfire/v1/service_client.ts"
      via: "WildfireServiceClient.listFireDetections"
      pattern: "WildfireServiceClient"
    - from: "src/App.ts"
      to: "src/services/wildfires/index.ts"
      via: "import fetchAllFires, flattenFires, computeRegionStats"
      pattern: "@/services/wildfires"
    - from: "src/components/SatelliteFiresPanel.ts"
      to: "src/services/wildfires/index.ts"
      via: "import FireRegionStats type"
      pattern: "@/services/wildfires"
---

<objective>
Create the wildfires service module, rewire all frontend consumers from the legacy firms-satellite service to the new proto-backed service, and delete legacy files.

Purpose: Completes the wildfire domain migration end-to-end by connecting the frontend to the new WildfireServiceClient, using a service module with real business logic (region stats, flatten, grouping).
Output: All fire data flows through sebuf. Legacy endpoint and service deleted.
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
@.planning/phases/2D-wildfire-migration/2D-01-SUMMARY.md
@.planning/phases/2C-seismology-migration/2C-02-SUMMARY.md

@src/services/firms-satellite.ts
@src/services/earthquakes.ts
@src/generated/client/worldmonitor/wildfire/v1/service_client.ts
@src/App.ts (lines 1-30, 4155-4205)
@src/components/SatelliteFiresPanel.ts
@src/services/signal-aggregator.ts (lines 239-270)
@src/components/MapContainer.ts (lines 259-265)
@src/components/Map.ts (lines 125-135, 2530-2540, 3419-3422)
@src/components/DeckGLMap.ts (lines 255-260, 1452-1465, 3280-3283)
@src/e2e/map-harness.ts (lines 1019-1030)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create wildfires service module and rewire all consumers</name>
  <files>
    src/services/wildfires/index.ts
    src/App.ts
    src/components/SatelliteFiresPanel.ts
    src/services/signal-aggregator.ts
    src/components/MapContainer.ts
    src/components/Map.ts
    src/components/DeckGLMap.ts
    src/e2e/map-harness.ts
  </files>
  <action>
**Step 1: Create `src/services/wildfires/index.ts`.**

This is a real service module (not a thin adapter like earthquakes.ts) because it contains business logic: region grouping, stats computation, and shape transformation. Use directory-per-service pattern per user preference.

```typescript
import {
  WildfireServiceClient,
  type FireDetection,
  type FireConfidence,
} from '@/generated/client/worldmonitor/wildfire/v1/service_client';

export type { FireDetection };
```

The module must export:

**`FireRegionStats` interface:**
```typescript
export interface FireRegionStats {
  region: string;
  fires: FireDetection[];
  fireCount: number;
  totalFrp: number;
  highIntensityCount: number;
}
```

**`FetchResult` interface:**
```typescript
export interface FetchResult {
  regions: Record<string, FireDetection[]>;
  totalCount: number;
  skipped?: boolean;
  reason?: string;
}
```

**`fetchAllFires(days?: number): Promise<FetchResult>`:**
- Create client: `const client = new WildfireServiceClient('');`
- Call `client.listFireDetections({})` (no params needed -- handler fetches all regions)
- Group the returned `fireDetections` array by `region` field into `Record<string, FireDetection[]>`
- If the response has zero detections AND there was no error, this might mean API key is missing. The handler returns empty list for missing key. Set `skipped: true, reason: 'NASA_FIRMS_API_KEY not configured'` ONLY if the response is empty. Note: We cannot distinguish "no fires" from "no API key" at the client level. The simplest approach: if `fireDetections.length === 0`, return `{ regions: {}, totalCount: 0, skipped: true, reason: 'NASA_FIRMS_API_KEY not configured' }`. This matches legacy behavior where an empty response triggered the skipped path. If we want to be more precise, the handler could include a signal in the response -- but for now, match legacy behavior.

  ACTUALLY -- better approach: the handler currently returns empty on missing key. The legacy endpoint returned `{ skipped: true }` explicitly. To maintain the skipped detection, check if `fireDetections` array is empty. If empty, treat as skipped. If the proto response has pagination with `totalCount: 0`, that's a legitimate empty response vs. a missing key. But since pagination is undefined when key is missing, use: if `fireDetections.length === 0` -> `skipped: true`. This is the safest heuristic matching legacy behavior.

- Wrap in try/catch: on error, `console.warn('[FIRMS] Fetch failed:', e)` and return `{ regions: {}, totalCount: 0 }`

**`computeRegionStats(regions: Record<string, FireDetection[]>): FireRegionStats[]`:**
- Same logic as legacy but adapted to proto types:
- For each `[region, fires]` in regions:
  - `highIntensityCount`: fires where `brightness > 360` AND confidence is `'FIRE_CONFIDENCE_HIGH'` (legacy used `confidence > 80`, which corresponds to the `h` letter that maps to HIGH enum)
  - `totalFrp`: sum of `frp` values
  - `fireCount`: `fires.length`
- Sort descending by `fireCount`

**`flattenFires(regions: Record<string, FireDetection[]>): FireDetection[]`:**
- Simple: flatten all region arrays. The `region` field is already on each `FireDetection` (set by the handler), so no need to tag.
- Return flat `FireDetection[]`

**`MapFire` type and helper (for map layer compatibility):**

The map's `setFires()` signature expects `Array<{ lat, lon, brightness, frp, confidence: number, region, acq_date, daynight }>`. Rather than changing the map signature (which 3 files share -- MapContainer, Map, DeckGLMap), export a mapper:

```typescript
export interface MapFire {
  lat: number;
  lon: number;
  brightness: number;
  frp: number;
  confidence: number;
  region: string;
  acq_date: string;
  daynight: string;
}

export function toMapFires(fires: FireDetection[]): MapFire[] {
  return fires.map(f => ({
    lat: f.location?.latitude ?? 0,
    lon: f.location?.longitude ?? 0,
    brightness: f.brightness,
    frp: f.frp,
    confidence: confidenceToNumber(f.confidence),
    region: f.region,
    acq_date: new Date(f.detectedAt).toISOString().slice(0, 10),
    daynight: f.dayNight,
  }));
}

function confidenceToNumber(c: FireConfidence): number {
  switch (c) {
    case 'FIRE_CONFIDENCE_HIGH': return 95;
    case 'FIRE_CONFIDENCE_NOMINAL': return 50;
    case 'FIRE_CONFIDENCE_LOW': return 20;
    default: return 0;
  }
}
```

This preserves the map layer's existing rendering logic (which uses numeric brightness thresholds and `lat`/`lon` field names) without any changes to map components.

**Step 2: Rewire `src/App.ts`.**

1. Change import (line 22):
   - FROM: `import { fetchAllFires, flattenFires, computeRegionStats } from '@/services/firms-satellite';`
   - TO: `import { fetchAllFires, flattenFires, computeRegionStats, toMapFires } from '@/services/wildfires';`

2. Update `loadFirmsData()` method (around line 4155-4205):
   - `fetchAllFires(1)` call stays the same (function signature compatible)
   - `fireResult.skipped` check stays the same
   - `flattenFires(regions)` returns `FireDetection[]` now
   - `computeRegionStats(regions)` returns `FireRegionStats[]` (same interface name, new import path)
   - Change the signal aggregator feed (lines 4169-4176):
     ```typescript
     signalAggregator.ingestSatelliteFires(flat.map(f => ({
       lat: f.location?.latitude ?? 0,
       lon: f.location?.longitude ?? 0,
       brightness: f.brightness,
       frp: f.frp,
       region: f.region,
       acq_date: new Date(f.detectedAt).toISOString().slice(0, 10),
     })));
     ```
   - Change the map feed (line 4179):
     ```typescript
     this.map?.setFires(toMapFires(flat));
     ```

**Step 3: Rewire `src/components/SatelliteFiresPanel.ts`.**

Change import (line 2):
- FROM: `import type { FireRegionStats } from '@/services/firms-satellite';`
- TO: `import type { FireRegionStats } from '@/services/wildfires';`

No other changes needed -- `FireRegionStats` has the same shape. The panel accesses `s.region`, `s.fireCount`, `s.highIntensityCount`, `s.totalFrp` -- all present in the new interface. The `fires: FireDetection[]` field in `FireRegionStats` now contains proto `FireDetection` objects instead of `FireDataPoint`, but the panel never accesses individual fire properties -- it only uses the aggregate stat fields.

**Step 4: Update `src/services/signal-aggregator.ts`.**

Update the JSDoc comment (around line 243):
- FROM: `Source: src/services/firms-satellite.ts`
- TO: `Source: src/services/wildfires`

No signature change needed -- `ingestSatelliteFires` takes `Array<{lat, lon, brightness, frp, region, acq_date}>` which App.ts maps to from proto data.

**Step 5: Update `src/e2e/map-harness.ts`.**

Update the `setFires` test data (lines 1019-1030) to stay consistent -- this data goes through `setFires()` which still expects the `{ lat, lon, brightness, frp, confidence, region, acq_date, daynight }` shape. No change needed since the map harness directly creates the MapFire-shaped objects (not proto objects).

Verify no import of `firms-satellite` exists in map-harness.ts. If it does, update it.

**Step 6: Verify no remaining imports of `firms-satellite` exist anywhere.**

Search for `firms-satellite` across the codebase. All references should be gone after Steps 2-5.

**Step 7: Type check.**

Run `npx tsc --noEmit` to confirm zero errors.
  </action>
  <verify>
Run `npx tsc --noEmit` -- zero errors. Grep the codebase for `firms-satellite` -- only the file itself should remain (to be deleted in Task 2). Grep for `@/services/wildfires` -- should appear in App.ts and SatelliteFiresPanel.ts.
  </verify>
  <done>
Wildfires service module created at `src/services/wildfires/index.ts`. All consumers import from `@/services/wildfires` instead of `@/services/firms-satellite`. Signal aggregator and map layer receive correctly mapped data. Type check passes.
  </done>
</task>

<task type="auto">
  <name>Task 2: Delete legacy wildfire files and rebuild</name>
  <files>
    api/firms-fires.js
    src/services/firms-satellite.ts
  </files>
  <action>
**Step 1: Delete legacy files.**

- Delete `api/firms-fires.js` -- replaced by `api/server/worldmonitor/wildfire/v1/handler.ts`
- Delete `src/services/firms-satellite.ts` -- replaced by `src/services/wildfires/index.ts`

**Step 2: Verify no remaining references.**

Grep the entire codebase for:
- `firms-fires` -- should have zero matches (the API URL was hardcoded in the deleted service file, not in config)
- `firms-satellite` -- should have zero matches
- `FireDataPoint` -- should have zero matches (type only existed in deleted file)
- `FiresFetchResult` -- should have zero matches (type only existed in deleted file)

If any references remain, fix them.

**Step 3: Rebuild sidecar and type check.**

Run `npm run build:sidecar-sebuf` to rebuild (ensures no dangling references in the sidecar bundle).
Run `npx tsc --noEmit` to confirm zero errors.
Run `npm run build` to confirm the full Vite build succeeds.
  </action>
  <verify>
`api/firms-fires.js` does not exist. `src/services/firms-satellite.ts` does not exist. `npx tsc --noEmit` passes. `npm run build` succeeds. No grep matches for `firms-satellite` or `firms-fires` in src/ or api/.
  </verify>
  <done>
Legacy wildfire endpoint and service module deleted. No dangling references. Full build passes. Wildfire domain is fully migrated to sebuf.
  </done>
</task>

</tasks>

<verification>
1. `src/services/wildfires/index.ts` exists and exports `fetchAllFires`, `computeRegionStats`, `flattenFires`, `toMapFires`, `FireRegionStats`
2. `src/App.ts` imports from `@/services/wildfires` (not `firms-satellite`)
3. `src/components/SatelliteFiresPanel.ts` imports `FireRegionStats` from `@/services/wildfires`
4. `api/firms-fires.js` is deleted
5. `src/services/firms-satellite.ts` is deleted
6. `npx tsc --noEmit` passes with zero errors
7. `npm run build` succeeds
8. Zero grep matches for `firms-satellite` or `firms-fires` across src/ and api/
</verification>

<success_criteria>
All wildfire data flows through the WildfireServiceClient -> sebuf gateway -> wildfire handler pipeline. The wildfires service module provides region grouping, stats computation, and map-compatible data transformation. Legacy files are deleted. Full build passes.
</success_criteria>

<output>
After completion, create `.planning/phases/2D-wildfire-migration/2D-02-SUMMARY.md`
</output>
