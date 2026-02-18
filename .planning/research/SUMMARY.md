# Project Research Summary

**Project:** WorldMonitor — Protobuf-Driven HTTP API Migration (sebuf)
**Domain:** Brownfield SPA API layer migration — vanilla TypeScript frontend with 80+ service modules
**Researched:** 2026-02-18
**Confidence:** HIGH (based on direct codebase inspection, first-party sebuf tooling analysis, and established migration patterns)

## Executive Summary

WorldMonitor is a production vanilla TypeScript SPA that consumes 60+ external APIs (Finnhub, Yahoo Finance, USGS, ACLED, GDELT, and more) through 80+ ad-hoc fetch-based service modules and 60+ individual Vercel edge functions. The migration introduces sebuf — a protobuf-first HTTP API toolkit that generates zero-dependency TypeScript clients and Go/TS server handlers from `.proto` definitions. The value proposition is not a change in wire format (HTTP/JSON stays) but a structural one: `.proto` files become the single source of truth for every external API contract, replacing scattered hand-written TypeScript interfaces with generated, consistent types across all 9 data domains (Environmental, Markets, Military, Geopolitical, Cyber, Economic, Research, Infrastructure, News).

The recommended approach is a strictly incremental, service-by-service migration using the Strangler Fig pattern with a dual-mode adapter layer. Each service independently switches from legacy fetch calls to the sebuf-generated client via a per-service feature flag. This means zero behavioral change during migration — the app remains fully operational throughout. The migration proceeds in a clear dependency order: (1) shared proto types and toolchain, (2) dual-mode infrastructure, (3) simple single-upstream services first, (4) complex aggregated/multi-proxy services last, (5) legacy removal. Proto files drive both the TS client (generated now, already stable) and the TS server handler (sebuf TS server codegen exists and has golden tests, but should be validated in small batches before scaling to all 80+ services).

The two highest risks are process risks, not technical ones. First: analysis paralysis from premature domain taxonomy design — the fix is to write the first proto file immediately and let groupings emerge from practice. Second: dual-mode drift where both paths persist indefinitely — the fix is per-service migration gates with hard 2-week deletion windows and a visible burn-down metric. The technically critical risk is the global fetch patch in `runtime.ts` (`installRuntimeFetchPatch()`), which intercepts all `/api/*` calls for Tauri desktop routing. All sebuf client URLs must use the `/api/` prefix convention and relative base URLs, or the desktop build breaks silently.

## Key Findings

### Recommended Stack

The proto toolchain is fully established and well-documented. Buf CLI v1.65.0 orchestrates all codegen via config-driven `buf.yaml` (v2) and `buf.gen.yaml` (v2). The sebuf plugins (`protoc-gen-ts-client`, `protoc-gen-go-http`, `protoc-gen-openapiv3`) are installed via `go install`. The critical insight: sebuf-generated TypeScript clients have zero npm dependencies — they use native `fetch()` and produce standard TypeScript interfaces. No `@bufbuild/protobuf` runtime is added to the browser bundle. The existing stack (Vite 6, TypeScript 5.7, Tauri 2, Vercel Edge Functions) requires no changes — generated `.ts` files are treated as plain TypeScript by all existing tooling.

**Core technologies:**
- Buf CLI v1.65.0: proto toolchain — 2x faster than raw protoc, built-in linting and breaking-change detection
- sebuf `protoc-gen-ts-client`: generates zero-dependency TypeScript HTTP clients — no bundle impact
- sebuf `protoc-gen-go-http` / `protoc-gen-ts-server`: generates server handlers — Go server stable, TS server has golden tests, validate in batches
- sebuf `protoc-gen-openapiv3`: generates OpenAPI v3.1 docs — free documentation from the same proto source
- `buf.build/bufbuild/protovalidate`: declarative field validation — defer client-side validation to avoid `@bufbuild/protobuf` bundle weight
- Vite / TypeScript / Tauri / Vercel: existing stack unchanged

**What NOT to use:** Binary protobuf transport, gRPC-Web, the `@bufbuild/protobuf` runtime on the client, raw `protoc`, `google.api.http` annotations (sebuf uses its own `sebuf.http` annotations).

### Expected Features

The migration has ~30-35 in-scope services (external HTTP API callers) out of 80+ total. The remaining services are client-side analysis/computation modules (clustering, ML, analysis workers, WebSocket connections) that stay as-is. Full details in `FEATURES.md`.

**Must have (table stakes):**
- Proto file definitions for all 9 domains (~40-50 proto files total)
- Generated TypeScript client types replacing hand-written interfaces
- Dual-mode client adapter — per-service switchover with feature flag control
- Response shape matching — proto messages producing JSON-compatible with existing UI consumers
- Circuit breaker integration — `withCircuitBreaker()` wrapper pattern around every sebuf client call
- Feature flag compatibility — `isFeatureAvailable()` checks preserved in wrapper layer, not in generated client
- Error handling parity — same fallback values on failure as today
- Persistent cache compatibility — generated types must remain JSON-serializable for IndexedDB layer
- Multi-proxy URL resolution — sebuf clients configurable with base URL, compatible with `proxyUrl()` / fetch patch

**Should have (differentiators):**
- Domain-organized proto file structure replacing 80+ flat service files
- Self-documenting API surface via proto comments
- Consistent error types via `worldmonitor.core.v1.Error` and `ApiStatus` shared messages
- Generated server handler interfaces via `protoc-gen-ts-server` (replaces 60+ individual Vercel edge functions with a single catch-all router)
- Request validation via `buf.validate` annotations
- OpenAPI documentation generation (automatic once protos exist)
- Batch request coalescing for multi-call services (e.g., FRED fetches 7 series independently)
- API parity test harness — call both legacy and sebuf paths, diff outputs
- Enum standardization — string union types become proto-backed enums

**Defer to post-migration:**
- Client-side `buf.validate` validation (requires `@bufbuild/protobuf` runtime, adds bundle weight)
- Batch request coalescing (optimization, not migration prerequisite)
- New data source integration (freeze API surface during migration)
- Server-side caching layer changes (keep existing IndexedDB/localStorage/Tauri FS untouched)

**Out of scope (explicitly):**
- WebSocket services: `ais.ts`, OpenSky WebSocket relay — sebuf is HTTP-only
- Client-side analysis services: clustering, ML worker, signal aggregator, etc.
- RSS feed direct migration — RSS returns XML, not JSON; wrap at high level only

### Architecture Approach

The architecture is a three-layer transformation: proto definitions as contract, generated TS clients replacing fetch calls in the browser, and generated TS server handlers replacing the 60+ individual Vercel edge functions with a single catch-all dispatcher. The server runtime is framework-agnostic — a `RouteDescriptor[]` array adapts to Vercel Edge, Tauri sidecar, and Vite dev plugin from a single `server/routes.ts` barrel file, guaranteeing identical API behavior across all three deployment targets. The dual-mode adapter pattern (`src/services/domains/`) exposes unchanged function signatures to `App.ts` while internally routing to either the legacy service or the sebuf client based on a per-service feature flag. All critical infrastructure (circuit breaker, persistent cache, feature flags, data-freshness tracking) wraps the transport layer rather than being embedded in it.

**Major components:**
1. `proto/worldmonitor/` — domain contract definitions in `.proto` files (9 domains, shared common types)
2. `src/generated/clients/` — generated zero-dependency TypeScript HTTP clients (one per domain)
3. `src/services/domains/` — dual-mode adapters maintaining existing function signatures for App.ts
4. `server/handlers/` — hand-written handler implementations (upstream proxy, API key injection, response shaping)
5. `server/generated/` — generated TypeScript server interfaces (`RouteDescriptor[]`)
6. `server/runtime/` — framework adapters: Vercel catch-all, Tauri sidecar registration, Vite dev plugin
7. `server/shared/` — cross-cutting: CORS, upstream-fetch, api-keys, cache-headers
8. Legacy `src/services/*.ts` — existing services, gradually replaced and deleted

**Key patterns:** One proto service per domain. Handler as upstream proxy only (business logic stays client-side). Shared router for all runtimes. `/api/` URL prefix convention enforced for fetch patch compatibility.

**Anti-patterns to avoid:** One mega-service proto. Client-side proto-to-legacy type mapping (creates parallel type hierarchies). Server handlers containing analysis logic. Per-endpoint Vercel functions (reverts the consolidation win). Breaking the fetch patch by using non-`/api/` URLs.

### Critical Pitfalls

1. **Taxonomy paralysis before first proto** — debating domain boundaries for weeks without shipping code. Prevention: start with `earthquakes.ts` (single upstream, no auth, no WebSocket), write the proto, let groupings emerge from practice.

2. **Proto mirroring upstream API shapes instead of application domain shapes** — designing `string latitude` to match ACLED's raw JSON instead of `double lat` matching the existing `ConflictEvent` TypeScript interface. Prevention: match existing TS interfaces in `src/types/index.ts`, not upstream API docs.

3. **Dual-mode drift — legacy code never removed** — the old path stays "just in case" indefinitely. Prevention: per-service feature flag, hard 2-week deletion deadline after parity verification, visible burn-down metric.

4. **Ignoring the runtime fetch patch and multi-proxy maze** — sebuf clients using different URL patterns than `/api/*`, breaking Tauri desktop routing silently. Prevention: enforce `/api/` prefix on all sebuf HTTP annotations; test every migrated service on Vite dev, Vercel production, and Tauri desktop.

5. **Circuit breaker loss during migration** — swapping `fetchEarthquakes()` (which wraps `breaker.execute()`) with a raw sebuf client call, losing graceful degradation and offline mode. Prevention: mandatory `withCircuitBreaker()` wrapper pattern established with the very first migrated service.

## Implications for Roadmap

### Phase 1: Foundation — Proto Toolchain and Shared Types
**Rationale:** Everything depends on proto definitions existing. Toolchain must be in place before any code generation can run. The `common/` shared message types (GeoCoordinates, TimeRange, PaginationParams, Error, ApiStatus) are imported by every domain — they must exist first. This phase has zero risk of breaking the running app.
**Delivers:** Working `buf generate` pipeline; generated common types; verified codegen output structure; url convention documented
**Addresses:** Table stakes: proto file definitions (core layer), service base path configuration, HTTP method annotations
**Avoids:** Pitfall #1 (taxonomy paralysis) — phase is bounded to toolchain + shared types only, no domain taxonomy decisions yet

### Phase 2: Dual-Mode Infrastructure
**Rationale:** The dual-mode adapter is the migration enabler for all subsequent phases. Build it once, reuse it for all 9 domains. Even without any sebuf client calls active, the adapter wiring into App.ts establishes the function signature contract and the feature flag switch pattern. No behavioral change in this phase.
**Delivers:** `src/services/domains/` adapter shell, feature flag entries in `runtime-config.ts`, `withCircuitBreaker()` wrapper pattern, App.ts wired to domain adapters (defaulting to legacy path)
**Addresses:** Table stakes: dual-mode adapter, circuit breaker integration, feature flag compatibility, error handling parity
**Avoids:** Pitfall #3 (dual-mode forever) — the deletion gate process is defined here; Pitfall #5 (circuit breaker loss) — wrapper pattern established before first service migration

### Phase 3: Simple Domain Migration — Environmental First
**Rationale:** Environmental (earthquakes, fires, natural events) is the simplest domain: single-upstream APIs, no auth, no Railway relay, no WebSocket, minimal variant logic. Proves the full pipeline end-to-end: proto definitions → generated TS client → dual-mode adapter → parity test → legacy deletion. The learnings from this phase define conventions for all remaining phases.
**Delivers:** `proto/worldmonitor/environmental/v1/`, generated client, adapter implementation, parity test harness, first legacy service deletion
**Addresses:** Table stakes: query parameter mapping, path variable support, response shape matching, persistent cache compatibility
**Avoids:** Pitfall #2 (proto mirroring upstream) — Environmental APIs are simple enough to get the proto-vs-upstream shape distinction right without pressure; Pitfall #9 (scope creep) — bounded to transport layer only
**Research flag:** Needs validation that `protoc-gen-ts-server` golden test patterns match what WorldMonitor handlers require. Manual server handler written for this phase.

### Phase 4: Server Runtime Infrastructure
**Rationale:** After the Environmental client migration proves proto definitions work, add the server-side layer. Server infrastructure (shared router, CORS, upstream-fetch, api-keys, cache-headers, Vite dev plugin) is built once and reused by all domains. Starting with the Vite dev plugin gives the fastest feedback loop before committing to Vercel and Tauri adapters.
**Delivers:** `server/shared/`, `server/runtime/` (Vite plugin first), `server/routes.ts`, first server handler (Environmental), Vite dev plugin replaces Vite proxy entries for migrated routes
**Addresses:** Must-have: multi-proxy URL resolution, server handler interfaces, API key server-side injection
**Avoids:** Pitfall #4 (fetch patch maze) — URL convention and base URL configuration validated here with Tauri desktop test

### Phase 5: Markets Domain — Complex Case Proof
**Rationale:** Markets (Finnhub, Yahoo Finance, CoinGecko, Polymarket) is the hardest single domain: multi-provider, multi-proxy, auth required, Polymarket's 4-tier fallback chain. If this migration works cleanly, every remaining domain is easier. Tackle it while patterns are fresh and before scaling to remaining 7 domains.
**Delivers:** `proto/worldmonitor/markets/v1/`, generated client, Markets handler (Vercel catch-all path), Markets adapter with Polymarket proxy chain preserved
**Addresses:** Table stakes: multi-proxy URL resolution for complex chains, response shape matching for multi-provider aggregation
**Avoids:** Pitfall #4 (Polymarket proxy maze) — explicitly migrated and tested; Pitfall #10 (aggregated service complexity) — Markets is moderately aggregated; a controlled learning

### Phase 6: Remaining Simple Domains
**Rationale:** With Environmental and Markets patterns established, migrate the remaining simpler domains in parallel batches: Cyber, Economic, Research, Infrastructure. These have straightforward single-upstream or simple aggregation patterns. Each follows the same adapter → proto → handler → parity test → legacy deletion sequence.
**Delivers:** Proto definitions, clients, adapters, and server handlers for Cyber, Economic, Research, and Infrastructure domains; legacy service deletions; Vercel catch-all function consolidating replaced endpoints
**Addresses:** All remaining table stakes for in-scope services
**Avoids:** Pitfall #11 (variant logic) — `SITE_VARIANT` audit performed before each batch; Pitfall #8 (barrel export mess) — new wrapper replaces old module in barrel per domain

### Phase 7: Complex/Hybrid Domains — Geopolitical, Military, News
**Rationale:** These three domains are the hardest: Geopolitical has 7+ services with ACLED multi-source aggregation; Military has WebSocket+HTTP hybrid services (OpenSky, Wingbits); News/RSS has 50+ feed sources requiring a fan-out pattern rather than a single RPC. Leave them last once the migration machinery is battle-proven.
**Delivers:** Geopolitical and Military HTTP portions migrated; RSS consolidated into a single `NewsService.GetFeedItems` RPC replacing 30+ Vite proxy entries; WebSocket services (AIS, OpenSky relay) confirmed as deliberately excluded
**Addresses:** Table stakes for complex multi-source aggregation; RSS proxy consolidation
**Avoids:** Pitfall #12 (WS+HTTP hybrid coupling) — HTTP and WS portions separated with shared data interface, not shared module state; Pitfall #10 (aggregated service complexity) — handled last with full playbook

### Phase 8: Legacy Removal and Type Consolidation
**Rationale:** With all in-scope domains migrated and parity verified, remove all dual-mode scaffolding and legacy code. Consolidate types: `src/types/index.ts` re-exports from generated proto types. This is the cleanup phase that realizes the full architectural benefit.
**Delivers:** Removal of all legacy `src/services/*.ts` HTTP service files, old Vercel `api/*.js` functions removed (replaced by catch-all), all `src/types/index.ts` migrated to re-export generated types, dual-mode adapter branches collapsed to sebuf-only paths, Vite proxy entries removed
**Addresses:** Full type consolidation, zero parallel type hierarchies, single catch-all Vercel function
**Avoids:** Pitfall #3 (dual-mode forever) — this is the final enforcement gate

### Phase Ordering Rationale

- Foundation before domain work: the shared common types are imported everywhere; they must exist before domain protos can be written
- Infrastructure before migration: dual-mode adapter and `withCircuitBreaker()` pattern must exist before any service switches to sebuf path, or the first migration breaks production
- Simple before complex: Environmental first proves the full pipeline cheaply; Markets proves the hard cases before scaling; hybrid/aggregated domains last
- Server runtime before production runtimes: Vite plugin gives fast iteration; Vercel and Tauri adapters validated before committing all domains
- Explicit legacy removal phase: prevents dual-mode drift by making deletion a first-class deliverable

### Research Flags

Phases needing deeper research during planning:
- **Phase 3 (Environmental migration):** Validate that `protoc-gen-ts-server` golden test output matches WorldMonitor's handler interface requirements before scaling proto writing to all domains
- **Phase 4 (Server Runtime):** The Tauri sidecar route registration pattern (`local-api-server.mjs`) needs detailed mapping to `RouteDescriptor[]` before implementation
- **Phase 7 (RSS/News):** RSS feeds return XML. The consolidation pattern (single `GetFeedItems` RPC + server-side domain validation) needs spike validation — XML parsing in server handler may need a library

Phases with standard patterns (skip research-phase):
- **Phase 1 (Foundation):** Buf CLI setup and proto toolchain are well-documented; sebuf examples provide exact configuration
- **Phase 2 (Dual-mode infrastructure):** Pattern fully specified in ARCHITECTURE.md with code examples
- **Phase 6 (Simple domains):** Established playbook from Phases 3-5; no new patterns required

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Buf CLI v1.65.0 verified; sebuf repo inspected directly; zero-dependency TS client confirmed; existing stack compatibility verified |
| Features | HIGH | Based on direct codebase analysis of 80+ service files; in-scope/out-of-scope boundary clearly established |
| Architecture | HIGH | Based on direct inspection of both sebuf source (`/sebuf.nosync/internal/tsservergen/`) and WorldMonitor codebase; RouteDescriptor[] pattern confirmed in golden tests |
| Pitfalls | HIGH | Derived from codebase evidence (fetch patch in runtime.ts, Polymarket proxy chain, barrel exports) plus established migration patterns |

**Overall confidence:** HIGH

### Gaps to Address

- **sebuf TS server codegen production-readiness:** The `protoc-gen-ts-server` exists and has golden tests, but has not been run against WorldMonitor protos yet. Validate with a 3-5 proto batch (Phase 3) before committing the full design to server-generated interfaces.
- **Tauri sidecar route registration:** The exact integration between `RouteDescriptor[]` and `local-api-server.mjs` is not documented in existing planning files. Requires a short spike during Phase 4.
- **Proto definition scale:** 40-50 proto files for 9 domains is the estimate. Actual count may vary once aggregated services are analyzed (Geopolitical alone has 7+ upstream sources). Budget extra time for Geopolitical and Military proto design.
- **`SITE_VARIANT` audit:** `grep -r "SITE_VARIANT" src/services/` has not been fully analyzed. Must be done before designing protos for affected services (Polymarket, RSS, Markets).
- **RSS XML handling in server handler:** The `GetFeedItems` approach requires server-side XML parsing. No Go/TS XML library has been selected. This is a minor gap but needs a decision before Phase 7.

## Sources

### Primary (HIGH confidence)
- sebuf GitHub repository (direct inspection) — plugin names, example code, zero-dependency client confirmed
- sebuf `/sebuf.nosync/internal/tsservergen/testdata/golden/` — RouteDescriptor[] server pattern confirmed
- sebuf `examples/ts-client-demo/` and `examples/multi-service-api/` — buf.gen.yaml, proto structure verified
- WorldMonitor `src/services/*.ts` (80+ files) — direct codebase analysis, circuit breaker and proxy patterns
- WorldMonitor `api/*.js` (60+ files) — Vercel edge function patterns
- WorldMonitor `src/services/runtime.ts` lines 179-238 — global fetch patch mechanism
- WorldMonitor `src/services/polymarket.ts` lines 77-140 — 4-tier proxy fallback chain
- WorldMonitor `src/utils/circuit-breaker.ts` — resilience patterns, 25 services confirmed using this
- WorldMonitor `src/services/index.ts` — 34 barrel re-exports
- Buf CLI GitHub releases — v1.65.0 verified (Feb 2026)
- buf.gen.yaml v2 official docs — configuration schema verified
- protovalidate v1.0 announcement — stable status confirmed

### Secondary (MEDIUM confidence)
- Proto best practices (protobuf.dev/best-practices/) — field numbering, message design
- Strangler Fig pattern (Azure Architecture Center) — incremental replacement strategy
- Buf monorepo patterns (buf.build docs) — file organization best practices
- sebuf buf.build BSR module `buf.build/sebmelki/sebuf` — published module confirmed

### Tertiary (LOW confidence)
- Proto monorepo blog articles — organizational rationale (unverified opinions)
- @bufbuild/protobuf and @bufbuild/protovalidate npm version numbers — from search results, npm page access failed during research

---
*Research completed: 2026-02-18*
*Ready for roadmap: yes*
