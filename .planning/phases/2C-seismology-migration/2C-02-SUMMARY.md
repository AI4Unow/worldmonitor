---
phase: 2C-seismology-migration
plan: 02
subsystem: api
tags: [protobuf, typescript, sebuf, seismology, port-adapter, migration]

# Dependency graph
requires:
  - phase: 2C-seismology-migration
    provides: INT64_ENCODING_NUMBER annotations ensuring occurredAt generates as number, SeismologyServiceClient
provides:
  - Port/adapter in earthquakes.ts wrapping SeismologyServiceClient
  - All 7 consuming files adapted to proto Earthquake field names
  - Legacy api/earthquakes.js endpoint deleted
  - Vite proxy for /api/earthquake removed
  - API_URLS.earthquakes config entry removed
affects: [2D-through-2S-migrations]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Port/adapter pattern: module exports functions backed by generated client, re-exports proto type"
    - "Proto field access: location?.latitude ?? 0 pattern for nested optional GeoCoordinates"
    - "Time field handling: occurredAt is number (epoch ms), wrap in new Date() only when Date type required"

key-files:
  created: []
  modified:
    - src/services/earthquakes.ts
    - src/App.ts
    - src/components/Map.ts
    - src/components/DeckGLMap.ts
    - src/components/MapPopup.ts
    - src/components/MapContainer.ts
    - src/services/geo-convergence.ts
    - src/e2e/map-harness.ts
    - src/config/variants/base.ts
    - vite.config.ts
  deleted:
    - api/earthquakes.js

key-decisions:
  - "Inlined earthquake time filtering in Map.ts instead of adapting filterByTime signature -- filterByTime expects { time?: Date } used by other types, proto Earthquake has occurredAt: number"
  - "Removed now-unused filterByTime method from Map.ts (was only called for earthquakes)"
  - "Port re-exports proto Earthquake type so consumers import from @/services/earthquakes (the port), never the generated client directly"

patterns-established:
  - "Port/adapter for sebuf: src/services/{domain}.ts imports generated client, re-exports domain types, exports async functions"
  - "Consumer import pattern: import type { Earthquake } from '@/services/earthquakes' (never from @/types for migrated domains)"
  - "Proto field mapping: lat/lon -> location?.latitude/longitude ?? 0, depth -> depthKm, time -> occurredAt, url -> sourceUrl"

requirements-completed: [CLIENT-02, CLIENT-04, CLEAN-01, CLEAN-02]

# Metrics
duration: 9min
completed: 2026-02-18
---

# Phase 2C Plan 02: Seismology Client Wiring Summary

**Port/adapter wrapping SeismologyServiceClient, 7 consuming files adapted to proto field names, legacy endpoint and proxy deleted**

## Performance

- **Duration:** 9 min
- **Started:** 2026-02-18T15:04:35Z
- **Completed:** 2026-02-18T15:13:43Z
- **Tasks:** 2
- **Files modified:** 10 (8 modified, 1 deleted, 1 config cleaned)

## Accomplishments
- Rewrote src/services/earthquakes.ts as minimal port/adapter using SeismologyServiceClient (removed circuit breaker, persistent cache, USGS interfaces, fallback logic)
- Adapted all 7 consuming files to proto Earthquake field names (location?.latitude, depthKm, occurredAt, sourceUrl)
- Deleted legacy api/earthquakes.js endpoint, removed Vite proxy, cleaned API_URLS config
- Full type-check and build pass with zero errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewrite earthquakes.ts adapter and adapt all consuming components** - `624e7f0` (feat)
2. **Task 2: Delete legacy earthquake endpoint, remove Vite proxy, clean config** - `a9088bb` (chore)

## Files Created/Modified
- `src/services/earthquakes.ts` - Rewritten as port/adapter wrapping SeismologyServiceClient
- `src/App.ts` - Updated intelligenceCache type, adapted eq field accesses
- `src/components/Map.ts` - Removed Earthquake from @/types import, inlined time filter, adapted field accesses
- `src/components/DeckGLMap.ts` - Updated import, adapted filterByTime getter, getPosition, ghost layer
- `src/components/MapPopup.ts` - Updated import, adapted depth/coords/time/url fields
- `src/components/MapContainer.ts` - Updated Earthquake import source
- `src/services/geo-convergence.ts` - Updated import, adapted ingestEarthquakes to use proto fields
- `src/e2e/map-harness.ts` - Updated import, rewrote test data to proto shape
- `api/earthquakes.js` - DELETED (legacy USGS proxy endpoint)
- `vite.config.ts` - Removed /api/earthquake proxy block
- `src/config/variants/base.ts` - Removed API_URLS.earthquakes entry

## Decisions Made
- **Inlined earthquake time filter in Map.ts:** The SVG Map's `filterByTime` method has signature `<T extends { time?: Date }>` which other overlay types depend on. Rather than changing the signature (which would require updating all callers), inlined the equivalent filter for earthquakes using `occurredAt >= cutoff`. Since earthquakes was the only caller of `filterByTime`, the method was then removed as dead code.
- **Port re-exports proto type:** The adapter re-exports `Earthquake` from the generated client so consumers import from the port (`@/services/earthquakes`), establishing the pattern for all future domain migrations.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed unused filterByTime method from Map.ts**
- **Found during:** Task 1, Step 4 (type check)
- **Issue:** After replacing `filterByTime(this.earthquakes)` with inline filtering (necessary because proto Earthquake lacks `time: Date`), the `filterByTime` method had no remaining callers and triggered TS6133 (declared but never read)
- **Fix:** Removed the unused private method
- **Files modified:** src/components/Map.ts
- **Verification:** tsc --noEmit passes with zero errors
- **Committed in:** 624e7f0 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minor cleanup of dead code caused by the migration. No scope creep.

## Issues Encountered
None - all steps executed smoothly, type check and build passed on first attempt after the filterByTime fix.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Seismology domain is fully migrated end-to-end: proto -> generated client -> port/adapter -> all consuming components
- Pattern established for remaining 2D-through-2S domain migrations
- Legacy Earthquake type in @/types preserved per decision (removal deferred to Phase 2T)
- No blockers for next domain migration

## Self-Check: PASSED

- src/services/earthquakes.ts: FOUND
- src/App.ts: FOUND
- src/components/Map.ts: FOUND
- src/components/DeckGLMap.ts: FOUND
- src/components/MapPopup.ts: FOUND
- src/components/MapContainer.ts: FOUND
- src/services/geo-convergence.ts: FOUND
- src/e2e/map-harness.ts: FOUND
- api/earthquakes.js: CONFIRMED DELETED
- .planning/phases/2C-seismology-migration/2C-02-SUMMARY.md: FOUND
- Commit 624e7f0: FOUND
- Commit a9088bb: FOUND

---
*Phase: 2C-seismology-migration*
*Completed: 2026-02-18*
