# Codebase Concerns

**Analysis Date:** 2026-02-18

## Tech Debt

**Monolithic Main Application Component:**
- Issue: `src/App.ts` is 4,287 lines with deeply nested initialization logic, multiple concerns (layout, data loading, event handling, state management)
- Files: `src/App.ts`
- Impact: Difficult to maintain, test, and refactor; high risk of regression on changes
- Fix approach: Break into smaller, focused classes (e.g., AppBootstrap, PanelManager, EventBrokerManager)

**Large Map Components:**
- Issue: `src/components/DeckGLMap.ts` (3,838 lines) and `src/components/Map.ts` (3,489 lines) contain mixed concerns: rendering, layer management, event handling, styling
- Files: `src/components/DeckGLMap.ts`, `src/components/Map.ts`
- Impact: Complex to modify, prone to visual regressions, state consistency issues
- Fix approach: Extract layer building logic, event handlers, and styling into separate modules

**Config Files as Data Warehouses:**
- Issue: Configuration files like `src/config/ai-datacenters.ts` (3,981 lines) contain pure data definitions mixed with constants
- Files: `src/config/ai-datacenters.ts`, `src/config/feeds.ts` (850 lines), `src/config/geo.ts` (1,240 lines)
- Impact: Large bundles, slow load times, makes data validation difficult
- Fix approach: Externalize to JSON/JSONL files or backend API, lazy-load when needed

**Console.log Throughout Codebase:**
- Issue: 241 console.log/error/warn calls spread across 61 files, no centralized logging framework
- Files: Across service layer, primarily in `src/services/`, `src/App.ts`, `src/components/`
- Impact: Hard to debug production issues, console noise during development, no structured logs
- Fix approach: Implement Logger service with levels (debug, info, warn, error) and centralized configuration

**Missing Input Validation on API Responses:**
- Issue: JSON.parse used 40 times with minimal error boundaries; many API responses assumed valid without schema validation
- Files: `src/services/persistent-cache.ts`, `src/App.ts`, RSS feed parsing, API integrations
- Impact: Runtime crashes on malformed API responses, silent data loss
- Fix approach: Add Zod or similar schema validation for all external API responses

**Service-Level Error Handling Gaps:**
- Issue: Only 303 try-catch blocks across 78 files; many async operations lack error handlers
- Files: Across all service files, particularly `src/services/rss.ts`, `src/services/ais.ts`
- Impact: Unhandled promise rejections, browser console errors, degraded user experience
- Fix approach: Systematically add try-catch to async operations; use circuit breaker pattern uniformly

## Known Bugs

**D3 Stale Selection References:**
- Symptoms: Map rendering occasionally fails, countries not displaying, layer groups become orphaned
- Files: `src/components/Map.ts` (lines 821-856)
- Trigger: Rapid panel switches, hidden tab behavior, DOM modifications
- Workaround: Code already includes detection and recreation (lines 834-841), but issue persists in edge cases
- Root cause: D3 selections can become stale when DOM is modified externally; multiple render paths don't invalidate properly

**Military Vessel Data Race:**
- Symptoms: Vessel count jumps between numbers, duplicate vessel IDs, inconsistent position updates
- Files: `src/services/military-vessels.ts`, `src/services/ais.ts`
- Trigger: Rapid polling with callback retention (2-hour window with 20,000 max vessels tracked)
- Root cause: `lastCallbackTimestampByMmsi` map can grow unbounded if vessels cycle; no deduplication between snapshot and callback streams

**Panel Order Migration Silent Failures:**
- Symptoms: Users report lost panel positions, panels revert to defaults unexpectedly
- Files: `src/App.ts` (lines 214-264)
- Trigger: JSON.parse on corrupted localStorage; migration runs twice (lines 217, 244)
- Root cause: Catch block doesn't reset migration flags, causing repeated migrations that overwrite user settings

## Security Considerations

**Environment Variable Exposure:**
- Risk: Runtime secrets (GROQ_API_KEY, OPENROUTER_API_KEY, etc.) accessible via `import.meta.env` in browser bundle
- Files: `src/services/runtime-config.ts`, `src/services/ais.ts`, multiple integration services
- Current mitigation: Runtime config feature toggles limit exposure; some keys require desktop/sidecar
- Recommendations:
  - Move all API calls to backend proxy endpoints
  - Never expose API keys to browser, even with feature toggles
  - Implement server-side authentication for third-party services

**HTML Sanitization Incomplete:**
- Risk: User-controlled HTML (news titles, country names) only uses basic escapeHtml; no protection against entity encoding attacks
- Files: `src/utils/sanitize.ts`, `src/components/MapPopup.ts`, `src/components/NewsPanel.ts`
- Current mitigation: `escapeHtml()` handles `<>&"'` but not entities like `&#x3C;`
- Recommendations: Use DOMPurify for rich content, tighten sanitize.ts regex

**URL Validation Weak:**
- Risk: `sanitizeUrl()` accepts relative paths without base validation; could be exploited with `javascript:` payloads
- Files: `src/utils/sanitize.ts` (lines 14-44)
- Current mitigation: Validates protocols but doesn't handle encoded payloads
- Recommendations: Use URL constructor consistently; whitelist specific protocols explicitly

## Performance Bottlenecks

**Unbounded Array Growth in AIS Service:**
- Problem: `lastCallbackTimestampByMmsi` map has no eviction; grows to 20,000+ entries
- Files: `src/services/ais.ts` (line 62, line 14: MAX_CALLBACK_TRACKED_VESSELS)
- Cause: Vessels removed from snapshot but callbacks fire indefinitely; no TTL cleanup
- Improvement path: Implement LRU cache with TTL, prune entries older than callback retention window (2 hours)

**D3 Reselection on Every Render:**
- Problem: `Map.ts` recreates all D3 selections every render cycle; no caching of selections
- Files: `src/components/Map.ts` (lines 827-832)
- Cause: Comments say "CRITICAL: Always refresh d3 selections" but this forces full DOM traversal
- Improvement path: Cache selections, use conditional updates with data binding instead of full recreation

**Config Loading Not Lazy:**
- Problem: `src/config/ai-datacenters.ts` (3,981 lines) loads entirely at bundle time
- Files: `src/config/index.ts`, imported by `src/App.ts`
- Cause: Synchronous imports at module level
- Improvement path: Dynamic import() on first use, or serve from API endpoint with per-variant filtering

**NewsPanel Virtual Scrolling Edge Case:**
- Problem: VirtualScrolling threshold (15 items) may be too high; small panel with 20 items still virtualizes
- Files: `src/components/NewsPanel.ts` (line 13: VIRTUAL_SCROLL_THRESHOLD)
- Cause: Excessive rendering of 8-item chunks when list is small
- Improvement path: Disable virtual scroll for lists <20 items, use simple DOM rendering

**Map Layer Rendering Single-Threaded:**
- Problem: DeckGL layers built synchronously; large datasets cause frame drops
- Files: `src/components/DeckGLMap.ts` (line 3050: `updateLayers()` in RAF callback)
- Cause: No web worker parallelization for layer construction
- Improvement path: Offload cluster computation and styling to worker, post back results

## Fragile Areas

**Country Geometry Service:**
- Files: `src/services/country-geometry.ts`
- Why fragile: Preloading entire country geometry file; no bounds checking; single point of failure if geometry service is slow
- Safe modification: Add timeout to preload, cache selectively by region, validate coordinates before lookup
- Test coverage: No unit tests for coordinate validation logic

**Temporal Baseline Calculation:**
- Files: `src/services/temporal-baseline.ts`
- Why fragile: Complex sliding window logic with edge cases around timezone boundaries and leap seconds
- Safe modification: Add comprehensive unit tests, validate timestamps before processing, document assumptions
- Test coverage: No tests for daylight savings transitions or month-end edge cases

**Signal Aggregator Convergence Score:**
- Files: `src/services/signal-aggregator.ts`
- Why fragile: Multiple async sources feeding into single score; no locking/ordering guarantees
- Safe modification: Use queued updates, implement event ordering, add idempotency checks
- Test coverage: No tests for concurrent signal ingestion or out-of-order updates

**ML Worker Timeout Without Cleanup:**
- Files: `src/services/ml-worker.ts` (lines 79-84)
- Why fragile: READY_TIMEOUT_MS (10s) may fire while worker still initializing; cleanup() called but pending requests may leak
- Safe modification: Implement pending request cancellation, add heartbeat monitoring, extend timeout for slow devices
- Test coverage: No tests for timeout scenarios

**Panel Activity Tracking:**
- Files: `src/components/NewsPanel.ts` (line 73: `activityTracker.register()`)
- Why fragile: Activity tracker callbacks have no error boundary; one panel crash affects all
- Safe modification: Wrap callbacks in try-catch, add unregister cleanup on panel destroy
- Test coverage: No tests for activity tracking state consistency

## Scaling Limits

**localStorage Quota Exceeded Risk:**
- Current capacity: Browser's typical 5-10MB localStorage limit
- Usage: Multiple caches (feeds, persistent-cache, migrations) + panel settings + URL state
- Limit: With 50+ feeds × 100 items × average 2KB per item = ~10MB easily breached
- Scaling path:
  - Implement cache eviction (LRU, time-based)
  - Use IndexedDB for large datasets instead of localStorage
  - Compress cached JSON before storage

**Worker Pool Bottleneck:**
- Current capacity: Single ML worker and single Analysis worker
- Usage: ~100+ headlines analyzed per minute during peaks
- Limit: One worker can't keep up; queued jobs back up
- Scaling path: Worker pool manager, priority queue for urgent tasks, offload non-blocking tasks

**AIS Snapshot Memory Footprint:**
- Current capacity: 20,000 tracked vessels × ~200 bytes per record = 4MB
- Usage: Full snapshot polled every 10 seconds; callbacks retain 2-hour history
- Limit: Mobile devices with <256MB heap will experience GC pressure
- Scaling path: Implement vessel clustering, expire old callback records, implement delta sync

**Feed Ingestion Rate:**
- Current capacity: ~50 feeds polled every 5-10 minutes = 10 requests/minute baseline
- Usage: With 200+ news items per minute, deduplication and clustering becomes CPU-bound
- Limit: Browser thread gets blocked during clustering phase
- Scaling path: Offload clustering to worker, implement incremental updates, batch process headlines

## Dependencies at Risk

**ONNX Runtime Web:**
- Risk: Large model files (ONNX T5, sentiment) can exceed 100MB; no version pinning in package.json
- Impact: Bundle bloat, slow model loading on first use, incompatibility with future version changes
- Migration plan: Consider TensorFlow Lite as alternative with smaller models, or move to backend inference

**Deck.GL Version Drift:**
- Risk: Deck.gl 9.2.6 is not the latest; MapLibre-GL 5.16.0 has different API than older versions
- Impact: Security vulnerabilities in old Mapbox versions, incompatibility with new layer types
- Migration plan: Audit for breaking changes, test new versions in staging, plan gradual migration

**D3 v7 (Older Major Version):**
- Risk: D3 v7 is out of maintenance; v8 has breaking changes; no updates planned
- Impact: Security issues in older D3, missed performance improvements, incompatibility with new code
- Migration plan: Plan migration to v8 or replace with simpler charting library for specific use cases

**YouTubei.js Unofficial Library:**
- Risk: YouTubei.js is third-party reverse engineering of YouTube API; subject to breakage on API changes
- Impact: YouTube feed fetching can suddenly break, no official support channel
- Migration plan: Monitor GitHub issues, have fallback news source, consider official YouTube API (requires quota)

## Missing Critical Features

**No Graceful Degradation for Missing APIs:**
- Problem: Some features (military flights, vessel tracking) fail silently when APIs are unavailable; no user feedback
- Blocks: Users don't know why data is missing, can't take action
- Recommendation: Implement data freshness badges, show explicit "API unavailable" messages, suggest workarounds

**No Offline Mode:**
- Problem: App requires live APIs; no cached snapshot for offline usage
- Blocks: Users on poor connections or in areas with network restrictions
- Recommendation: Cache critical data (country geometry, base map), serve offline-capable snapshot

**No Analytics for Feature Usage:**
- Problem: Can't track which panels users interact with, which feeds are most relevant, which variants are used most
- Blocks: Data-driven decision making about feature prioritization
- Recommendation: Add privacy-respecting analytics (no PII), heatmaps for panel engagement

**No A/B Testing Framework:**
- Problem: Can't safely test new algorithms (clustering, scoring) without affecting all users
- Blocks: Incremental improvement of signal quality, can't validate hypotheses
- Recommendation: Implement feature flag service with user cohorts, parallel scoring systems

## Test Coverage Gaps

**Unit Test Absence:**
- What's not tested: Zero unit tests in codebase (0 .test.ts/.spec.ts files in src/)
- Files: `src/services/` (entire services directory), `src/utils/` (utility functions)
- Risk: Refactoring blindly, regressions in complex logic (clustering, analysis), type safety issues
- Priority: **High** - Add tests for signal aggregation, clustering, and score calculations

**Integration Test Gaps:**
- What's not tested:
  - Multi-service data flows (AIS → clustering → aggregation → display)
  - Panel state synchronization across browser tabs
  - Circuit breaker behavior under failure scenarios
- Files: Multiple services, `src/App.ts` orchestration
- Risk: Silent data loss, inconsistent state, cascading failures on API outage
- Priority: **High** - Add E2E tests for critical user flows

**E2E Test Fragility:**
- What's not tested: Only 4 E2E tests exist; heavy reliance on live data (subject to timing issues)
- Files: `e2e/*.spec.ts`
- Risk: Tests flake on slow networks, pass/fail based on real-world data, hard to debug
- Priority: **Medium** - Mock API responses, add test fixtures, increase test coverage

**Error Path Testing:**
- What's not tested: What happens when APIs timeout, return malformed JSON, or 5xx errors
- Files: All service files with network calls
- Risk: Unknown behavior on failure, no confidence in error handling
- Priority: **Medium** - Add error injection tests, validate circuit breaker fallbacks

**Data Validation Testing:**
- What's not tested: Schema validation for API responses, handling of missing/unexpected fields
- Files: All service files with external APIs
- Risk: Runtime crashes on data format changes, silent corruption
- Priority: **High** - Add schema validation layer, test with real API responses

---

*Concerns audit: 2026-02-18*
