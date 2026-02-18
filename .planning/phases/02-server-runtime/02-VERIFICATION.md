---
phase: 02-server-runtime
verified: 2026-02-18T16:00:00Z
status: passed
score: 11/11 must-haves verified
re_verification:
  previous_status: gaps_found
  previous_score: 10/11
  gaps_closed:
    - "Tauri sidecar discovers and loads the compiled sebuf catch-all gateway bundle via buildRouteTable() (SERVER-05)"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "POST to /api/seismology/v1/list-earthquakes in dev mode"
    expected: "Returns earthquake data from USGS with correct proto-shaped fields (id, place, magnitude, depthKm, location, occurredAt, sourceUrl)"
    why_human: "Requires running Vite dev server and issuing a live HTTP request; cannot verify network I/O or response shape statically"
  - test: "OPTIONS preflight in dev mode"
    expected: "Returns 204 with Access-Control-Allow-Origin, Access-Control-Allow-Methods: POST OPTIONS, Access-Control-Max-Age: 86400"
    why_human: "Requires live server; static analysis confirms the code path exists but cannot verify header values at runtime"
  - test: "Request from disallowed origin in dev mode"
    expected: "Returns 403 with { error: 'Origin not allowed' } and CORS headers set to worldmonitor.app fallback"
    why_human: "Origin pattern matching needs runtime verification with a real non-matching Origin header"
---

# Phase 02: Server Runtime Verification Report

**Phase Goal:** Shared server infrastructure (router, CORS, error mapper) and catch-all gateway, validated with first handler (seismology)
**Verified:** 2026-02-18T16:00:00Z
**Status:** passed
**Re-verification:** Yes — after gap closure (02-03: SERVER-05 Tauri sidecar bundle)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Router matches POST requests by method+path and returns the correct handler | VERIFIED | `api/server/router.ts` (1,052 bytes) — exports `createRouter`, builds `Map<"METHOD /path", handler>` from `RouteDescriptor[]`. No regression. |
| 2 | CORS module returns correct headers for allowed origins and rejects disallowed origins | VERIFIED | `api/server/cors.ts` (1,341 bytes) — 8 `ALLOWED_ORIGIN_PATTERNS`, exports `getCorsHeaders` and `isDisallowedOrigin`. No regression. |
| 3 | Error mapper converts thrown errors to appropriate HTTP status codes (400, 429, 502, 500) | VERIFIED | `api/server/error-mapper.ts` (1,761 bytes) — handles `ApiError`, `TypeError+fetch` (502), catch-all (500). No regression. |
| 4 | Seismology handler fetches USGS GeoJSON and returns proto-shaped ListEarthquakesResponse | VERIFIED | `api/server/worldmonitor/seismology/v1/handler.ts` (1,619 bytes) — fetches `4.5_day.geojson`, maps all 7 fields, returns `{ earthquakes, pagination: undefined }`. No regression. |
| 5 | POST to /api/seismology/v1/list-earthquakes returns earthquake data through the catch-all gateway | VERIFIED (code) | `api/[[...path]].ts` mounts seismology routes via `createRouter`. All static imports confirmed intact. |
| 6 | OPTIONS preflight to /api/seismology/v1/list-earthquakes returns 204 with CORS headers | VERIFIED (code) | `api/[[...path]].ts`: `if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders })`. No regression. |
| 7 | Requests with disallowed origins are rejected with 403 | VERIFIED (code) | `api/[[...path]].ts`: `if (isDisallowedOrigin(request))` returns 403 with `{ error: 'Origin not allowed' }`. No regression. |
| 8 | Requests to non-existent sebuf routes return 404 | VERIFIED (code) | `api/[[...path]].ts`: `if (!matchedHandler)` returns 404 with `{ error: 'Not found' }`. No regression. |
| 9 | Existing api/*.js files continue to work unchanged | VERIFIED | `api/earthquakes.js` present (unmodified). The new `api/[[][[].*.js` gitignore rule uses character-class escaping, leaving all regular `.js` files unaffected. No regression. |
| 10 | Vite dev server handles /api/*/v1/* requests in-process without external proxy | VERIFIED | `sebufApiPlugin()` at `vite.config.ts` line 134, registered at line 296. No regression. |
| 11 | Tauri sidecar discovers and loads the compiled sebuf catch-all gateway bundle (SERVER-05) | VERIFIED | `api/[[...path]].js` exists (6,399 bytes, 196 lines). Zero remaining `import` statements — all TS dependencies inlined. Exports `handler as default`. Sidecar `buildRouteTable()` discovers it (`.js` filter passes, line 177). `routePath = "[[...path]]"` scores 0 in `routePriority`. `matchRoute` returns `true` for any pathname at line 127-128. `dispatch` calls `mod.default(request)` at line 804 — the compiled export satisfies `typeof mod.default === 'function'`. Chain fully wired without sidecar code changes. |

**Score:** 11/11 truths verified

---

### Required Artifacts

| Artifact | Provides | Status | Details |
|----------|----------|--------|---------|
| `api/server/router.ts` | Map-based route matching from RouteDescriptor[] | VERIFIED | 1,052 bytes. Wired into gateway and Vite plugin. |
| `api/server/cors.ts` | CORS header generation ported from api/_cors.js | VERIFIED | 1,341 bytes. Wired into gateway and Vite plugin. |
| `api/server/error-mapper.ts` | Error-to-HTTP-response mapping for onError callback | VERIFIED | 1,761 bytes. Wired as `serverOptions.onError` in gateway. |
| `api/server/worldmonitor/seismology/v1/handler.ts` | SeismologyServiceHandler proxying USGS earthquake API | VERIFIED | 1,619 bytes. Wired into gateway via `createSeismologyServiceRoutes`. |
| `api/[[...path]].ts` | Vercel catch-all edge function mounting all sebuf routes | VERIFIED | 2,185 bytes, `export const config = { runtime: 'edge' }`. All imports static. |
| `vite.config.ts` | Vite dev plugin intercepting sebuf API paths | VERIFIED | `sebufApiPlugin()` at line 134, registered at line 296. |
| `tsconfig.api.json` | TypeScript config for api/ directory type-checking | VERIFIED | Present; `tsc --noEmit -p tsconfig.api.json` script active. |
| `package.json` | typecheck:api and build scripts | VERIFIED | `typecheck:api` at line 17; `build:sidecar-sebuf` at line 12; `build` chains sidecar-sebuf at line 11. |
| `scripts/build-sidecar-sebuf.mjs` | esbuild invocation compiling api/[[...path]].ts to single ESM .js bundle | VERIFIED | 39 lines. Entry: `api/[[...path]].ts`, output: `api/[[...path]].js`, format: `esm`, platform: `node`, target: `node18`, bundle: `true`. Substantive and wired into `build:sidecar-sebuf` npm script. |
| `api/[[...path]].js` | Compiled catch-all gateway bundle consumable by sidecar .js-only file filter | VERIFIED | 6,399 bytes, 196 lines. Zero remaining imports. All TS dependencies inlined. Exports `handler as default`. Gitignored via `api/[[][[].*.js` pattern (`git check-ignore` confirms). |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `api/[[...path]].ts` | `api/server/router.ts` | `import { createRouter }` | WIRED | Line 10: static import, used at line 25. |
| `api/[[...path]].ts` | `api/server/cors.ts` | `import { getCorsHeaders, isDisallowedOrigin }` | WIRED | Line 11: static import, both functions used. |
| `api/[[...path]].ts` | `api/server/error-mapper.ts` | `import { mapErrorToResponse }` | WIRED | Line 12: static import, used as `serverOptions.onError`. |
| `api/[[...path]].ts` | `api/server/worldmonitor/seismology/v1/handler.ts` | `import { seismologyHandler }` | WIRED | Line 14: static import, passed to `createSeismologyServiceRoutes`. |
| `scripts/build-sidecar-sebuf.mjs` | `api/[[...path]].ts` | esbuild entryPoint | WIRED | Line 18: `path.join(projectRoot, 'api', '[[...path]].ts')` as `entryPoints[0]`. Pattern `api/\[\[...path\]\]\.ts` confirmed present. |
| `api/[[...path]].js` | `src-tauri/sidecar/local-api-server.mjs` | `buildRouteTable()` discovers .js files in api/ | WIRED | Sidecar line 177: `.endsWith('.js')` filter passes for `[[...path]].js`. Computed `routePath = "[[...path]]"`. `matchRoute` line 127: `[[...` catch-all returns `true` for any sebuf path. `dispatch` line 804: `mod.default(request)` calls compiled `handler`. |
| `package.json` build script | `scripts/build-sidecar-sebuf.mjs` | `npm run build:sidecar-sebuf` chained into `build` | WIRED | `"build": "tsc && vite build && npm run build:sidecar-sebuf"` at line 11. Every `tauri build` (via `beforeBuildCommand`) produces the bundle automatically. |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| SERVER-01 | 02-01 | TypeScript server handler interfaces generated for all 9 domains via protoc-gen-ts-server | SATISFIED | `src/generated/server/worldmonitor/seismology/v1/service_server.ts` — `SeismologyServiceHandler`, `createSeismologyServiceRoutes`. Inlined verbatim in compiled bundle. |
| SERVER-02 | 02-01 | Handler implementations for each domain proxying requests to upstream external APIs | SATISFIED (seismology scope) | `api/server/worldmonitor/seismology/v1/handler.ts` — proxies USGS GeoJSON, maps to proto-shaped response. |
| SERVER-03 | 02-02 | Vite dev server plugin mounting generated RouteDescriptor[] for local development | SATISFIED | `sebufApiPlugin()` in `vite.config.ts`. |
| SERVER-04 | 02-02 | Vercel catch-all edge function mounting generated RouteDescriptor[] for production | SATISFIED | `api/[[...path]].ts` with `runtime: 'edge'`. |
| SERVER-05 | 02-03 | Tauri sidecar adapter mounting generated RouteDescriptor[] for desktop deployment | SATISFIED | `api/[[...path]].js` (esbuild bundle) discovered by `buildRouteTable()`. Complete wiring chain verified. `api/[[...path]].js` gitignored; build chained into `npm run build`. REQUIREMENTS.md annotated with gap closure note. |
| SERVER-06 | 02-01 | Server handlers preserve existing CORS, rate limiting, and caching patterns from current api/*.js edge functions | SATISFIED | `cors.ts` ports `_cors.js` patterns exactly (8 identical RegExp patterns). `api/earthquakes.js` unmodified. |

---

### Anti-Patterns Found

None in files created or modified by this phase (02-01, 02-02, 02-03 deliverables).

---

### Human Verification Required

#### 1. Live POST to /api/seismology/v1/list-earthquakes (dev mode)

**Test:** Run `npm run dev`, then `curl -X POST http://localhost:3000/api/seismology/v1/list-earthquakes -H 'Content-Type: application/json' -d '{}'`
**Expected:** JSON body with an `earthquakes` array containing objects with fields `id`, `place`, `magnitude`, `depthKm`, `location.latitude`, `location.longitude`, `occurredAt` (string), `sourceUrl`. Non-empty if USGS has recent M4.5+ events.
**Why human:** Requires live network fetch to USGS API. Cannot verify runtime response shape or data presence statically.

#### 2. OPTIONS preflight (dev mode)

**Test:** `curl -i -X OPTIONS http://localhost:3000/api/seismology/v1/list-earthquakes -H 'Origin: http://localhost:3000'`
**Expected:** HTTP 204, headers include `Access-Control-Allow-Origin: http://localhost:3000`, `Access-Control-Allow-Methods: POST, OPTIONS`, `Access-Control-Max-Age: 86400`
**Why human:** Requires running server; static code analysis confirms the path exists but cannot verify header values at runtime.

#### 3. Disallowed origin rejection (dev mode)

**Test:** `curl -i -X POST http://localhost:3000/api/seismology/v1/list-earthquakes -H 'Origin: https://evil.example.com' -H 'Content-Type: application/json' -d '{}'`
**Expected:** HTTP 403, body `{"error":"Origin not allowed"}`, `Access-Control-Allow-Origin: https://worldmonitor.app` (fallback)
**Why human:** Origin pattern matching needs runtime verification with a non-matching origin header.

---

### Re-verification Summary

**Gap closed: SERVER-05 (Tauri sidecar integration)**

The previously-failed truth is now fully satisfied. The implementation:

1. `scripts/build-sidecar-sebuf.mjs` — esbuild script (39 lines) bundles `api/[[...path]].ts` and all TypeScript dependencies into a single self-contained ESM file. Uses `bundle: true`, `format: 'esm'`, `platform: 'node'`, `target: 'node18'`.

2. `api/[[...path]].js` — The compiled output (6,399 bytes, 196 lines). Contains inlined implementations of `createRouter`, `getCorsHeaders`, `isDisallowedOrigin`, `mapErrorToResponse`, `createSeismologyServiceRoutes`, `seismologyHandler`, and the catch-all `handler` function. Zero remaining `import` statements — fully self-contained. Exports `handler as default`.

3. The sidecar discovery chain is unbroken without any sidecar code changes:
   - `buildRouteTable()` walks `api/`, `[[...path]].js` passes `.endsWith('.js')` filter (line 177), and does not start with `_` (line 178)
   - `routePath` = `"[[...path]]"` after stripping `.js` extension
   - `routePriority` scores it `0` (lowest = highest catch-all priority) via the `[[...` branch (line 109)
   - `matchRoute` returns `true` for any pathname via `[[...` branch at line 127-128
   - `dispatch` calls `mod.default(request)` (line 804); the compiled export satisfies `typeof mod.default === 'function'` check (line 788)

4. `npm run build:sidecar-sebuf` is chained into `npm run build`, meaning every `tauri build` (which runs `npm run build` via `beforeBuildCommand`) automatically produces the bundle.

5. `api/[[...path]].js` is gitignored via `api/[[][[].*.js` pattern (bracket-class escaping for literal `[` characters). `git check-ignore` confirms the file is tracked as ignored.

6. REQUIREMENTS.md marks SERVER-05 `[x] Complete` with gap closure annotation.

**No regressions:** All 10 previously-verified truths confirmed intact via existence and sanity checks.

---

_Verified: 2026-02-18T16:00:00Z_
_Verifier: Claude (gsd-verifier)_
