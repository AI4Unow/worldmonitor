---
phase: 02-server-runtime
plan: 03
subsystem: infra
tags: [esbuild, tauri, sidecar, bundler, sebuf]

# Dependency graph
requires:
  - phase: 02-server-runtime (02-02)
    provides: "Catch-all gateway api/[[...path]].ts with router, CORS, error-mapper, and seismology handler"
provides:
  - "scripts/build-sidecar-sebuf.mjs — esbuild script that compiles api/[[...path]].ts into a single ESM .js bundle"
  - "api/[[...path]].js — compiled catch-all gateway bundle discoverable by sidecar buildRouteTable()"
  - "npm run build:sidecar-sebuf — standalone build script"
  - "npm run build now includes sidecar-sebuf compilation step"
affects: [sidecar, tauri-build, desktop-deployment]

# Tech tracking
tech-stack:
  added: [esbuild (explicit devDependency)]
  patterns: ["esbuild ESM bundling for sidecar-compatible .js artifacts"]

key-files:
  created:
    - scripts/build-sidecar-sebuf.mjs
  modified:
    - package.json
    - package-lock.json
    - .gitignore
    - .planning/REQUIREMENTS.md

key-decisions:
  - "esbuild over tsc for bundling: tsc produces per-file .js output, sidecar needs single self-contained module"
  - "Gitignore bracket escaping: used [[] character class pattern since backslash escaping is unreliable for brackets in .gitignore"

patterns-established:
  - "Sidecar build artifacts: compile TS to .js via esbuild, gitignore output, chain into npm run build"

requirements-completed: [SERVER-05]

# Metrics
duration: 3min
completed: 2026-02-18
---

# Phase 02 Plan 03: Sidecar Sebuf Bundle Summary

**esbuild compilation step that bundles the TypeScript catch-all gateway into a single ESM .js file for Tauri sidecar discovery via buildRouteTable()**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-18T13:51:20Z
- **Completed:** 2026-02-18T13:54:28Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Created esbuild build script that compiles api/[[...path]].ts into a 6.2 KB self-contained ESM bundle
- Chained build:sidecar-sebuf into npm run build so tauri build automatically produces the bundle
- Verified compiled bundle handler returns status 200 for POST requests, confirming sidecar compatibility
- Full build pipeline (tsc + vite build + sidecar-sebuf) passes end-to-end with zero regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Add esbuild compilation step for sebuf sidecar gateway bundle** - `cf9d345` (feat)
2. **Task 2: Verify sidecar discovery and update REQUIREMENTS.md** - `523e74e` (docs)

## Files Created/Modified
- `scripts/build-sidecar-sebuf.mjs` - esbuild script that bundles api/[[...path]].ts into api/[[...path]].js
- `package.json` - Added build:sidecar-sebuf script, chained into build command, added esbuild devDependency
- `package-lock.json` - Updated lockfile with esbuild dependency tree
- `.gitignore` - Added api/[[...path]].js as build artifact (escaped brackets)
- `.planning/REQUIREMENTS.md` - Added SERVER-05 gap closure annotation

## Decisions Made
- Used esbuild instead of tsc for bundling: tsc produces per-file output but the sidecar needs a single self-contained module that can be imported via dynamic import. esbuild bundles all TS dependencies into one file in ~50ms.
- Used `[[]` character class pattern in .gitignore to match literal brackets, since backslash escaping is unreliable for bracket characters in gitignore glob patterns.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed .gitignore bracket escaping**
- **Found during:** Task 1 (gitignore step)
- **Issue:** Plan specified literal `api/[[...path]].js` in .gitignore, but brackets are interpreted as glob character classes. The file was not being ignored.
- **Fix:** Used `api/[[][[].*.js` pattern which uses `[[]` character class to match a literal `[` bracket.
- **Files modified:** .gitignore
- **Verification:** `git check-ignore` confirms the file is now ignored; regular .js files in api/ are not affected.
- **Committed in:** cf9d345 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Essential fix for correct gitignore behavior. No scope creep.

## Issues Encountered
None beyond the gitignore bracket escaping (documented above as deviation).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- SERVER-05 gap is fully closed: the Tauri sidecar can now discover and load the compiled sebuf gateway bundle
- All Phase 02 (Server Runtime) plans are complete (01: server infrastructure, 02: gateway integration, 03: sidecar bundle)
- Ready for Phase 2C+ domain handler migration (one phase per domain)

## Self-Check: PASSED

All files verified present. All commits verified in git history.

---
*Phase: 02-server-runtime*
*Completed: 2026-02-18*
