# Domain Pitfalls

**Domain:** Protobuf-driven HTTP API migration (sebuf) for brownfield SPA with 80+ service modules
**Researched:** 2026-02-18
**Overall confidence:** HIGH (derived from codebase analysis + established migration patterns)

---

## Critical Pitfalls

Mistakes that cause rewrites, extended timelines, or production breakage.

---

### Pitfall 1: Big Bang Domain Taxonomy — Reorganizing All 80 Services Before Any Migration

**What goes wrong:** The team spends weeks designing the "perfect" domain taxonomy (News, Markets, Military, Geopolitical, Environmental, Cyber, Economic, Research, Infrastructure) before writing a single `.proto` file. The taxonomy looks clean on paper but collapses when tested against reality: `polymarket.ts` spans both Markets and Geopolitical; `military-flights.ts` uses OpenSky (Transport domain?) but serves the Military panel; `cyber-threats.ts` aggregates five upstream sources that could each be a separate service. Endless boundary debates consume time, and by the time you start writing protos, the taxonomy needs revising anyway.

**Why it happens:** Domain-driven design literature encourages getting boundaries right before building. But WorldMonitor's services are organized around upstream API sources, not domain concepts. The same data feeds multiple UI panels (e.g., ACLED data appears in both conflict maps and country intel modals). Trying to force upstream-organized services into domain-organized protos before understanding the actual call patterns creates premature abstractions.

**Consequences:**
- Proto files that don't match actual data flows, requiring rework
- Analysis paralysis — weeks of taxonomy debates with no shipped code
- Services that straddle domains get split awkwardly, breaking the existing `import` graph
- The barrel export in `src/services/index.ts` (34 re-exports) becomes a mine field during reorganization

**Warning signs:**
- Domain taxonomy discussion exceeds 2 days without a proto file being written
- Services like `polymarket.ts`, `markets.ts`, or `cyber-threats.ts` can't cleanly fit one domain
- Debates about whether `earthquakes.ts` belongs in "Environmental" or "Natural Hazards"

**Prevention:**
1. Start with the simplest, most isolated services first (e.g., `earthquakes.ts` — single upstream, single endpoint, no auth, no WebSocket, no variant logic). Write the proto, generate client, verify parity. Learn from it.
2. Let the taxonomy emerge from migrated services rather than designing it upfront. After 10-15 services are migrated, patterns will reveal natural groupings.
3. Accept that some services will live in a `misc` or `data` package initially. Reorganize after migration is complete.

**Phase:** Proto design phase. Limit initial taxonomy to 3-4 obvious groupings; defer fine-grained boundaries.

---

### Pitfall 2: Proto Schema Mirrors External API Shape Instead of Application Domain Shape

**What goes wrong:** Proto messages are designed to match upstream API response shapes (e.g., ACLED's `event_id_cnty`, `admin1`, `latitude` as strings) rather than the application's internal types (e.g., `ConflictEvent` with `lat: number`, `lon: number`, `time: Date`). This creates a 1:1 mapping that provides no abstraction benefit — you've just added a proto layer that mirrors the JSON you already parse. Worse, when upstream APIs change their response format (which they do — ACLED has changed their API twice), the proto change cascades through generated code.

**Why it happens:** It feels efficient to use sebuf annotations (`unwrap`, `flatten`) to match the existing JSON shapes exactly. The PROJECT.md even states "Proto definitions must match existing API shapes." But this confuses two things: the proto as a *wire contract between your server and client* versus the upstream API's contract. Your proto should define *your* domain's types. The server handler is where upstream API shapes get translated.

**Consequences:**
- Upstream API changes break proto contracts (which should be stable)
- No type improvement — proto types are as messy as the upstream JSON (string coordinates, string dates, inconsistent naming)
- Client code still needs the same parsing/mapping logic that exists today
- Multiple upstreams that feed the same domain (e.g., Feodo + URLhaus + OTX + AbuseIPDB all feeding `CyberThreat`) can't share a clean proto type

**Warning signs:**
- Proto field names use snake_case matching upstream APIs (e.g., `event_id_cnty`) instead of your domain names
- Proto messages have `string latitude` instead of `double lat`
- You find yourself writing `// same as ACLED response` comments in proto files

**Prevention:**
1. Design proto messages to match *existing TypeScript interfaces* (`ConflictEvent`, `Earthquake`, `FredSeries`, `InternetOutage`), not upstream API shapes. These interfaces already represent your application's domain model.
2. The server handler's job is to fetch from upstream, parse the raw response, and return data conforming to your proto messages. This is where `parseFloat(e.latitude)` and `new Date(e.event_date)` live.
3. Use proto `Timestamp` for dates, `double` for coordinates, proper enums for event types. Enforce types that TypeScript interfaces already model.

**Phase:** Proto design phase. Review every proto message against the corresponding TypeScript interface in `src/services/`, not against the upstream API docs.

---

### Pitfall 3: Dual-Mode Runs Forever — Legacy Code Never Gets Removed

**What goes wrong:** The migration plan calls for dual-mode operation: existing fetch calls work alongside new sebuf clients. This is correct for safety. But "temporarily" running both paths becomes permanent. Each service has two implementations: the old one that works and the new one that's "almost verified." Nobody wants to delete the old code because "what if the new path has an edge case?" After 6 months, you're maintaining two service layers with subtly different behavior, double the bug surface, and imports from both old and new modules scattered through the app.

**Why it happens:** Dual-mode is comfortable. The old code has been battle-tested across Vercel, Tauri, and dev modes. The new sebuf path might not handle all the edge cases (Cloudflare JA3 fingerprint blocking on Polymarket, Railway relay fallback chains, desktop-vs-cloud secret validation). There's no forcing function to complete the migration, so it drifts.

**Consequences:**
- Two code paths with subtle behavioral differences (e.g., circuit breaker configured differently in old vs. new)
- New features get added to the old path "because it's faster" — creating more legacy
- Bundle size grows (both old and new client code shipped)
- Confusion about which path is active for any given service

**Warning signs:**
- More than 3 months in dual-mode for any single service
- New features or bug fixes applied to the old service path instead of the new one
- Developers unsure which import path (`src/services/conflicts.ts` vs. sebuf client) a component uses
- The old barrel `src/services/index.ts` still re-exports everything it does today

**Prevention:**
1. **Per-service migration gate:** Each service gets a feature flag (extend the existing `RuntimeFeatureId` system) that controls old-vs-new path. Once the new path is verified, flip the flag and set a calendar reminder to delete old code within 2 weeks.
2. **Parity test suite:** Before switching any service, run an automated comparison: call both old and new paths with the same inputs, diff the outputs. The existing circuit breaker `execute()` wrapper is a natural interception point.
3. **Burn-down chart:** Track "services still on old path" as a visible metric. If it stops decreasing, something is wrong.
4. **Hard deadline per batch:** Migrate in batches of 5-8 services. Each batch has a 2-week window: Week 1 = dual-mode with parity testing, Week 2 = old code deletion.

**Phase:** Every migration phase needs an explicit "legacy removal" task, not just "verify parity."

---

### Pitfall 4: Ignoring the Runtime Fetch Patch and Multi-Target Proxy Maze

**What goes wrong:** The most dangerous hidden complexity in this codebase is `runtime.ts` line 179: `installRuntimeFetchPatch()`. This function monkey-patches `window.fetch` globally to intercept all `/api/*` calls and route them through the Tauri sidecar (with retry logic and cloud fallback). Several services also have their own bespoke proxy chains: `polymarket.ts` has a 4-tier fallback (direct browser -> Tauri Rust command -> Railway relay -> Vercel edge -> production endpoint). `ais.ts` constructs URLs from WebSocket relay URLs. `worldbank.ts` uses Railway relay because World Bank blocks Vercel IPs.

If the new sebuf client makes fetch calls to `/api/*` routes, the runtime fetch patch will intercept them in desktop mode, potentially routing them through the sidecar — which may not implement the sebuf server endpoints. If sebuf clients use different URL patterns, the desktop fetch patch won't intercept them, breaking the desktop-vs-cloud routing.

**Why it happens:** The fetch patch is a "set it and forget it" piece of infrastructure. Nobody thinks about it during proto design because it's transparent. But sebuf generates clients that construct their own fetch calls with specific URLs, and these URLs must be compatible with the existing proxy infrastructure.

**Consequences:**
- Sebuf clients work on `localhost:5173` (Vite dev) but break on Tauri desktop
- Sebuf clients work on desktop but bypass the Railway relay, causing Vercel IP blocks for WorldBank/OpenSky
- Double-patching: fetch patch intercepts a request that the sebuf client already routed correctly
- API key injection via sidecar fails because sebuf client doesn't use the same fetch path

**Warning signs:**
- Services work in dev mode but fail on desktop builds
- "Network error" logs appearing only in Tauri builds
- Polymarket/WorldBank/OpenSky data missing only on Vercel deployment
- Sebuf client URLs don't start with `/api/` and thus bypass the fetch patch

**Prevention:**
1. **URL convention:** All sebuf-generated client endpoints MUST use the `/api/` prefix so the existing fetch patch intercepts them in desktop mode. This should be enforced in proto HTTP annotations.
2. **Proxy-aware base URL:** The sebuf client must accept a configurable base URL. In web/Vite mode it's `""` (relative). In Tauri mode, the fetch patch handles routing — but only if URLs match `/api/*`.
3. **Test matrix:** Every migrated service must be tested on all three targets: Vite dev, Vercel production, and Tauri desktop. This is not optional.
4. **Services with custom proxy chains** (Polymarket's 4-tier fallback, AIS relay URL construction, WorldBank Railway relay) must be migrated LAST. Their proxy logic needs to be replicated in the sebuf server handler, and the client must be agnostic to which upstream path was used.

**Phase:** Infrastructure/foundation phase. Establish the URL convention and base URL configuration BEFORE migrating any service.

---

### Pitfall 5: Breaking the Circuit Breaker and Cache Layer During Migration

**What goes wrong:** 25 services use `createCircuitBreaker()`. Each breaker has state: failure count, cooldown timer, and cached last-good-response. The RSS feed system has its own per-feed circuit breaker with cooldown. `persistent-cache.ts` provides IndexedDB/localStorage/Tauri file system caching. When services are migrated to sebuf clients, these resilience patterns get lost unless explicitly preserved.

The sebuf-generated client makes a plain `fetch()` call. It has no circuit breaker, no cache, no retry logic. If you swap `fetchEarthquakes()` (which wraps in `breaker.execute()`) with a raw sebuf client call, you lose: automatic fallback to cached data on failure, cooldown periods preventing API hammering, and the circuit breaker status dashboard (`getCircuitBreakerStatus()`).

**Why it happens:** The generated client is intentionally thin — it handles serialization and HTTP, nothing else. The circuit breaker, caching, and retry logic are application concerns that need to be preserved in a wrapper layer. But during migration excitement, teams often swap the fetch call directly without wrapping, thinking "we'll add resilience later."

**Consequences:**
- API failures cause cascading errors instead of graceful degradation
- Rate-limited APIs (ACLED, Finnhub, FRED) get hammered when circuit breaker protection is lost
- Desktop offline mode breaks — cached data no longer served when network is unavailable
- `getCircuitBreakerStatus()` / `getEarthquakesDataState()` return stale/wrong data
- The `data-freshness.ts` reporting system stops getting update signals

**Warning signs:**
- Error rates spike after migrating a service
- A service that used to show "cached data (5m ago)" now shows "unavailable"
- Desktop app shows blank panels when offline (used to show last-known data)
- `breaker.getStatus()` returns `'ok'` for a service that's actually failing via the new path

**Prevention:**
1. **Middleware wrapper pattern:** Create a `withCircuitBreaker<T>(breakerName: string, clientCall: () => Promise<T>, defaultValue: T)` function that wraps any sebuf client call in the existing circuit breaker. This becomes the standard migration pattern.
2. **Checklist per service migration:**
   - [ ] Circuit breaker wrapping preserved
   - [ ] Cache TTL preserved
   - [ ] Persistent cache fallback preserved (if service uses it)
   - [ ] `data-freshness.ts` recordUpdate() call preserved
   - [ ] Status getter function (`get*Status()`) still works
3. **Do NOT refactor the circuit breaker system** during migration. Keep `CircuitBreaker<T>` exactly as-is. Refactoring resilience infrastructure while migrating transport is a recipe for compound failures.

**Phase:** First service migration. Establish the wrapper pattern with the very first migrated service, then replicate across all others.

---

### Pitfall 6: Sebuf TS Server Codegen Not Ready — Building on Shifting Sand

**What goes wrong:** The PROJECT.md explicitly states "sebuf TS server codegen is still in progress" and "Proto files written before server is ready." This means proto files are being designed without the ability to verify that the server-side codegen actually works with them. When the server codegen ships, it may impose constraints that invalidate proto design decisions: annotation syntax differences, handler interface shapes, route descriptor formats, or limitations on nested message types.

**Why it happens:** The project owner (who is also the sebuf maintainer) wants to parallelize: write protos now, implement server later. This is reasonable IF the proto design doesn't assume server codegen capabilities that may not materialize. But if the team designs 30+ proto files with specific annotation patterns, and the server codegen doesn't support some of them, it's a mass rework.

**Consequences:**
- Proto files need rewriting when server codegen ships with different annotation requirements
- Server handlers can't be tested until codegen is ready, creating a long feedback loop
- Blocking dependency: if server codegen is delayed, the entire migration stalls at "proto files written but not usable"
- Risk of designing protos for client consumption only, ignoring server-side constraints

**Warning signs:**
- Proto files accumulate without any server-side validation
- Annotations used in protos are not documented in sebuf's current README/docs
- Client codegen works but server codegen requirements are "TBD"
- More than 20 proto files written without a single server handler being generated

**Prevention:**
1. **Write protos in small batches:** Start with 3-5 proto files for the simplest services. Wait for server codegen to be minimally functional before writing the remaining 75+.
2. **Client-first is fine, but verify with manual server:** Before server codegen is ready, implement 2-3 server handlers by hand (matching the handler interface shape the codegen will eventually produce). This validates that the proto design works end-to-end.
3. **Pin proto annotation syntax:** Before writing protos at scale, get a commitment from the sebuf project on which annotations are stable vs. experimental. Only use stable annotations.
4. **Decouple client migration from server migration:** The client can use sebuf-generated types and clients pointing at existing `/api/*` endpoints (which are already implemented as Vercel serverless functions). The server migration is a separate, later phase.

**Phase:** Proto design phase and first migration phase. Limit proto batch size until server codegen is validated.

---

## Moderate Pitfalls

Mistakes that cause delays, tech debt, or partial rework.

---

### Pitfall 7: Feature Flag System Interaction — isFeatureAvailable() Short-Circuit Lost

**What goes wrong:** Many services begin with `if (!isFeatureAvailable('economicFred')) return [];`. This check combines feature toggle state, desktop-vs-cloud context, and secret availability. When migrating to a sebuf client, this guard must be preserved. If the sebuf client call is made without checking `isFeatureAvailable()`, the request hits the server, which may fail (no API key configured) or return an error that the old path would have avoided entirely.

**Prevention:**
1. The feature availability check stays in the service wrapper, NOT in the generated client.
2. Migration pattern: `isFeatureAvailable(featureId)` -> sebuf client call -> circuit breaker -> return. Same order as today, just replacing the inner fetch.
3. Desktop-specific secret validation (`feature.desktopRequiredSecrets`) must still be checked client-side before making the request.

**Phase:** First migration batch. Establish the pattern in the wrapper layer.

---

### Pitfall 8: Barrel Export Explosion During Transition

**What goes wrong:** `src/services/index.ts` re-exports 34 modules. During dual-mode migration, some services export from old files and some from new sebuf client wrappers. Import consumers (components, `App.ts`) import from `@/services` and get a mix of old and new. Name collisions occur when both old `fetchEarthquakes` and new `fetchEarthquakes` (from sebuf wrapper) exist. TypeScript catches identical function names but not subtle type differences (e.g., old returns `Earthquake[]`, new returns `sebuf.Earthquake[]` with slightly different field types).

**Prevention:**
1. During migration, the new wrapper module exports the SAME function signatures with the SAME names. The wrapper internally delegates to sebuf client.
2. Never have two modules exporting the same public API. The wrapper replaces the old module in the barrel export.
3. Type alignment: ensure sebuf-generated types are either used directly or mapped to existing TypeScript interfaces at the wrapper boundary. Do NOT introduce parallel type hierarchies.

**Phase:** Every migration batch. Enforce barrel export hygiene.

---

### Pitfall 9: Scope Creep — "While We're Migrating, Let's Also..."

**What goes wrong:** Migration touches every service file. The temptation is irresistible: "While we're migrating `fred.ts`, let's also add schema validation." "While we're here, let's consolidate the three different cache strategies." "Let's normalize error handling across all services." "Let's add Zod validation since proto gives us schemas." Each addition is reasonable in isolation, but collectively they balloon the migration from "swap fetch for sebuf client" to "rewrite the entire service layer."

The CONCERNS.md from the sebuf branch already identifies: missing input validation, inconsistent error handling, no logging framework, missing tests, and several other improvements. The migration will make all of these feel urgent.

**Prevention:**
1. **Strict scope rule:** Each migrated service changes ONE thing: the transport layer. Circuit breaker stays. Cache strategy stays. Error handling stays. Feature flags stay. If you see something that needs fixing, file it as a separate issue.
2. **No new features during migration batches.** If a service needs improvement, do it BEFORE migration (in the old code) or AFTER migration (in the new wrapper). Never simultaneously.
3. **PR size limit:** A migration PR for a batch of 5 services should touch ~5 old service files (deletions) and ~5 new wrapper files (additions), plus barrel export updates. If it touches 20+ files, scope has crept.

**Phase:** All phases. This is the single most likely cause of timeline overrun.

---

### Pitfall 10: Proto Message Design for Aggregated Services

**What goes wrong:** Several services aggregate multiple upstream APIs into a single response. `cyber-threats.ts` calls Feodo, URLhaus, C2Intel, OTX, and AbuseIPDB, then merges results. `markets.ts` calls Finnhub for some symbols and Yahoo Finance for others. `rss.ts` fetches 50+ RSS feeds with per-feed circuit breakers. Designing proto messages for these aggregated services is significantly harder than for single-upstream services.

If you model the aggregation in proto (e.g., `CyberThreatsResponse` with `repeated CyberThreat threats` plus `CyberThreatsMeta meta`), the server handler becomes complex — it must replicate all the multi-source aggregation, partial failure handling, and source-status tracking. If you model each upstream separately (e.g., `FeodoService`, `UrlhausService`, etc.), the client must do the aggregation that the server should handle.

**Prevention:**
1. **Aggregated services get a single proto service** with the aggregation happening server-side. The proto response includes per-source metadata (like the existing `CyberThreatsMeta.sources`).
2. **Do NOT split aggregated services into per-upstream protos.** The aggregation is business logic that belongs on the server.
3. **Migrate aggregated services AFTER single-upstream services.** Learn from simpler cases first.
4. **The `rss.ts` feed system is a special case** — it's not a single API but a fan-out to 50+ endpoints with per-feed circuit breakers. This may NOT benefit from proto migration. Consider keeping RSS as-is and wrapping it at a higher level (e.g., a `NewsFeedService` proto that calls the existing RSS infrastructure).

**Phase:** Later migration batches (after simple services are proven).

---

### Pitfall 11: Variant-Specific Behavior Lost in Proto Abstraction

**What goes wrong:** `SITE_VARIANT` (`'full'` | `'tech'` | `'finance'`) controls behavior throughout the service layer: `rss.ts` adjusts AI classification limits per variant, `polymarket.ts` uses different tag sets, feed configurations differ. Proto definitions are variant-agnostic — they define the contract. But the variant-specific behavior needs to be preserved somewhere.

If variant logic moves to the server, the server needs to know which variant is requesting. If it stays on the client, the client wrapper handles it before/after the sebuf call. If it's split inconsistently, variant behavior regresses.

**Prevention:**
1. **Variant is a request parameter, not a server-side config.** Include `string variant = N;` in request messages where variant changes behavior.
2. **For services where variant only affects what gets fetched** (e.g., different Polymarket tags), the variant is a request-time parameter.
3. **For services where variant affects post-processing** (e.g., RSS AI classification limits), keep that logic in the client wrapper.
4. **Audit variant usage** before designing protos: `grep -r "SITE_VARIANT" src/services/` to know which services are affected.

**Phase:** Proto design phase. Audit variant usage early.

---

### Pitfall 12: WebSocket Services Treated as "Out of Scope" but Tightly Coupled

**What goes wrong:** The PROJECT.md correctly states WebSocket services (AIS, OpenSky relay, World Bank relay) are out of sebuf scope. But `ais.ts` is deeply coupled to snapshot polling (HTTP) and callback processing. `military-flights.ts` has both HTTP and WebSocket paths. Declaring "WebSocket is out of scope" doesn't cleanly separate the HTTP and WS parts of these services.

The risk: when migrating `military-flights.ts` HTTP endpoints to sebuf, the WebSocket-dependent parts are left behind in the old module. Now you have a split service: half in the sebuf wrapper, half in the legacy module, with shared state between them (the flight cache `Map`, the breaker instance).

**Prevention:**
1. **For hybrid HTTP+WS services:** migrate ONLY the HTTP portion. The WS portion stays in its original module. The two communicate through a shared data interface (not shared module state).
2. **Do NOT attempt to share circuit breaker instances** between old WS code and new sebuf wrapper. Create separate breakers.
3. **AIS is the most complex case.** Its snapshot polling (HTTP) feeds into the callback dispatch system (in-memory). If the HTTP part migrates to sebuf, the in-memory callback state must be accessible from the sebuf wrapper. Consider keeping AIS as a unified module that internally uses the sebuf client for its HTTP calls.

**Phase:** Late migration batch. WebSocket-coupled services are the hardest and should be last.

---

## Minor Pitfalls

Annoyances that slow development but are easily correctable.

---

### Pitfall 13: Proto Field Numbering Discipline

**What goes wrong:** During rapid proto authoring, field numbers get assigned arbitrarily, then reused or changed during iteration. When protos eventually land on a stable schema, historical serialized data (cached responses, stored in IndexedDB) may be incompatible.

**Prevention:** Even though sebuf uses JSON transport (not binary protobuf), maintain proto field numbering discipline from day one. Reserve deleted field numbers. Never reuse numbers. This costs nothing and prevents issues if binary transport is ever added.

**Phase:** Proto design phase. Establish convention in the first proto file.

---

### Pitfall 14: `config/` Constants Not Accessible from Proto Layer

**What goes wrong:** `API_URLS` in `src/config/` defines endpoint URLs. `FRED_SERIES` in `src/services/fred.ts` defines which series to fetch. `CRYPTO_MAP` in `src/config/` maps crypto IDs. These constants are needed by server handlers but live in client-side code. When server handlers need them, they either duplicate the constants or import from client code (which may have browser-specific imports like `import.meta.env`).

**Prevention:** Extract shared constants (API URLs, series lists, crypto maps) into a `shared/` or `proto-config/` directory that can be imported by both client wrappers and server handlers without pulling in browser-specific code.

**Phase:** Foundation/infrastructure phase, before writing server handlers.

---

### Pitfall 15: Response Transformation Logic Duplicated Between Old and New Paths

**What goes wrong:** Services like `conflicts.ts` have `mapEventType()` that transforms upstream strings into domain enums. `fred.ts` has display value calculation (`WALCL / 1000`). `outages.ts` has country code to coordinate lookup. During dual-mode, if this logic lives in both the old service file and the new server handler, bugs get fixed in one place but not the other.

**Prevention:** Extract pure transformation functions (mapEventType, coordinate lookups, unit conversions) into shared utility modules BEFORE migration. Both old and new paths import from the shared module. This is one of the few pre-migration refactors worth doing.

**Phase:** Pre-migration preparation. Extract shared transformers first.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Proto design | Taxonomy paralysis (#1) | Start with 3-5 simple services, let groupings emerge |
| Proto design | Mirroring upstream shapes (#2) | Match existing TS interfaces, not upstream API responses |
| Proto design | Server codegen assumptions (#6) | Write protos in small batches, validate with manual server |
| Foundation/infra | Fetch patch incompatibility (#4) | Enforce `/api/` URL prefix convention for all sebuf endpoints |
| Foundation/infra | Circuit breaker wrapper pattern (#5) | Establish `withCircuitBreaker` pattern with first service |
| First migration batch | Feature flag guard lost (#7) | Preserve `isFeatureAvailable()` in wrapper, not in generated client |
| First migration batch | Scope creep (#9) | Strict rule: change transport only, file everything else as separate issues |
| Middle migration batches | Barrel export collisions (#8) | New wrapper replaces old module in barrel; same function signatures |
| Middle migration batches | Variant logic (#11) | Audit `SITE_VARIANT` usage before designing protos for affected services |
| Late migration batches | Aggregated service complexity (#10) | Learn from simple services first; RSS may not benefit from proto migration |
| Late migration batches | WS+HTTP hybrid services (#12) | Migrate HTTP portion only; shared data interface, separate breakers |
| All phases | Dual-mode drift (#3) | Per-service feature flag + 2-week deletion window + burn-down tracking |
| All phases | Scope creep (#9) | PR size limits, no simultaneous improvements |

## Pitfall Severity vs. Likelihood Matrix

| Pitfall | Severity | Likelihood | Effort to Prevent |
|---------|----------|------------|-------------------|
| #1 Taxonomy paralysis | High | High | Low (just start small) |
| #2 Proto mirrors upstream | High | High | Medium (requires discipline) |
| #3 Dual-mode forever | High | Very High | Medium (process + tooling) |
| #4 Fetch patch maze | Critical | Medium | Medium (convention + testing) |
| #5 Circuit breaker loss | Critical | High | Low (wrapper pattern) |
| #6 Server codegen not ready | High | Medium | Low (batch proto writing) |
| #7 Feature flags lost | Medium | Medium | Low (checklist) |
| #8 Barrel export mess | Medium | Medium | Low (convention) |
| #9 Scope creep | High | Very High | High (discipline) |
| #10 Aggregated services | Medium | Medium | Medium (sequencing) |
| #11 Variant behavior | Medium | Medium | Low (audit early) |
| #12 WS hybrid coupling | Medium | Low | Medium (defer to late phase) |

## Sources

### Official Documentation
- [Proto Best Practices (Dos and Don'ts)](https://protobuf.dev/best-practices/dos-donts/) - Field numbering, message design, enum patterns
- [Protocol Buffers Backward/Forward Compatibility](https://earthly.dev/blog/backward-and-forward-compatibility/) - Schema evolution rules
- [Protobuf Field Presence](https://protobuf.dev/programming-guides/field_presence/) - Optional vs required semantics

### Migration Patterns
- [Strangler Fig Pattern - Azure Architecture Center](https://learn.microsoft.com/en-us/azure/architecture/patterns/strangler-fig) - Incremental replacement strategy
- [Migration Strategies in Large Codebases](https://www.scottberrevoets.com/2022/11/15/migration-strategies-in-large-codebases/) - Batch migration, parity testing
- [Frontend Migration Guide](https://frontendmastery.com/posts/frontend-migration-guide/) - Dual-mode complexity, scope management
- [Incremental Migrations - Vercel](https://vercel.com/blog/incremental-migrations) - Why incremental beats big-bang

### Domain Design
- [Protobuffers Are Wrong (Reasonably Polymorphic)](https://reasonablypolymorphic.com/blog/protos-are-wrong/) - Wire format vs. application format mismatch
- [The Most Common DDD Mistake (Medium)](https://medium.com/navalia/the-most-common-domain-driven-design-mistake-6c3f90e0ec2b) - Boundary abstraction errors
- [Resilient REST APIs: Parallel Change](https://artificial.io/company/blog/resilient-rest-apis-the-case-for-parallel-change/) - Dual-mode execution patterns

### Codebase Evidence (HIGH confidence)
- `src/services/runtime.ts` lines 179-238: Global fetch patch intercepting all `/api/*` calls
- `src/services/polymarket.ts` lines 77-140: 4-tier proxy fallback chain
- `src/services/runtime-config.ts` lines 293-306: Feature availability gating combining toggles + secrets + desktop context
- `src/utils/circuit-breaker.ts`: 25 services depend on this; registry tracks all breakers globally
- `src/services/index.ts`: 34 barrel re-exports that all consumers depend on
- `src/services/ais.ts`: Hybrid HTTP polling + WebSocket callback dispatch with shared state

---

*Pitfalls audit: 2026-02-18*
