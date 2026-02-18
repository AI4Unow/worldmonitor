# Architecture

**Analysis Date:** 2026-02-18

## Pattern Overview

**Overall:** Event-driven multi-layer architecture with variant-based feature isolation

**Key Characteristics:**
- Single-page application (SPA) with progressive enhancement
- Multiple variants (full/geopolitical, tech, finance) sharing core infrastructure
- Reactive data flow: services → aggregators → UI components
- Web Workers for CPU-intensive operations (ML, analysis)
- Responsive adaptive rendering (WebGL maps on desktop, SVG fallback on mobile)

## Layers

**Presentation Layer:**
- Purpose: Render interactive UI with map, panels, and modals
- Location: `src/components/`
- Contains: Panel-based layout system, interactive maps, news/market displays, modals
- Depends on: Services, utilities, types
- Used by: App.ts orchestrator

**Service Layer:**
- Purpose: Data fetching, aggregation, analysis, and state management
- Location: `src/services/` (80+ service modules)
- Contains: Feed fetching, market data, military tracking, geo-convergence detection, clustering
- Depends on: Types, external APIs (via fetch/proxies), utilities
- Used by: App.ts, workers, components

**Data Analysis Layer:**
- Purpose: Real-time signal detection, anomaly identification, correlation analysis
- Location: `src/services/analysis-core.ts`, `src/services/signal-aggregator.ts`, `src/services/country-instability.ts`
- Contains: News clustering, velocity metrics, threat classification, deviation detection
- Depends on: Analysis constants, entity extraction
- Used by: Both main thread and workers

**Worker Layer (Background Processing):**
- Purpose: Offload CPU-intensive tasks from main thread
- Location: `src/services/ml-worker.ts`, `src/services/analysis-worker.ts`
- Contains: ML inference (sentiment, entity extraction), complex analysis
- Depends on: ONNX Runtime, Transformers.js, core analysis functions
- Used by: App.ts through worker manager interface

**Configuration Layer:**
- Purpose: Variant-specific settings, geospatial references, static data
- Location: `src/config/` and `src/config/variants/`
- Contains: Panel configs, map layers, feed lists, entity locations, geo hubs
- Depends on: Types
- Used by: App.ts, services, components

**Utilities Layer:**
- Purpose: Shared helpers, algorithms, formatting, state management
- Location: `src/utils/`
- Contains: Analysis constants (thresholds, keywords), localStorage management, URL state parsing, reverse geocoding
- Depends on: Types
- Used by: Services, components, analysis code

## Data Flow

**Real-Time Data Pipeline:**

1. **Ingestion**: RSS feeds, market APIs, military tracking APIs fetched on intervals
2. **Aggregation**: Raw data aggregated by category (news, markets, flights, vessels, outages)
3. **Analysis**:
   - News clustered by similarity (Jaccard distance)
   - Velocity metrics computed from source frequency
   - Threat classification applied
   - Geographic signals detected and correlated
4. **Deduplication**: Signals compared against recent history to avoid duplicates
5. **Presentation**: Filtered/sorted data pushed to UI components for rendering
6. **User Interaction**: URL state synchronized, panels resized, filters applied

**State Management:**
- Short-lived state: In-memory collections (news, markets, signals) in App.ts
- Persistent state: localStorage (panel settings, monitors, map layers, variant preference)
- Real-time state: WebSocket connections for AIS vessel tracking, military vessel stream
- URL state: Map view, zoom, time range encoded in URL for sharing/deep linking

## Key Abstractions

**Panel System:**
- Purpose: Modular dashboard widget with consistent header/content/resize interface
- Examples: `src/components/NewsPanel.ts`, `src/components/MarketPanel.ts`, `src/components/CIIPanel.ts`
- Pattern: Extends base `Panel` class, implements typed render/update methods, stores to localStorage

**Signal/Event Types:**
- Purpose: Unified representation of monitored phenomena across domains
- Examples: `InternetOutage`, `MilitaryFlight`, `SocialUnrestEvent`, `CyberThreat`
- In: `src/types/index.ts` — used for type safety across services and UI

**Clustering Algorithm:**
- Purpose: Group news items by topic/event
- Location: `src/services/clustering.ts` and `src/services/analysis-core.ts`
- Pattern: Jaccard similarity on tokenized titles, threshold-based grouping, temporal windowing

**Geo-Convergence Detection:**
- Purpose: Identify geographic hotspots where multiple signal types overlap
- Location: `src/services/geo-convergence.ts`
- Pattern: Discretized 1x1 degree grid cells, event type tracking per cell, threshold crossing triggers signals

**Country Instability Index (CII):**
- Purpose: Composite risk score for countries based on multiple input signals
- Location: `src/services/country-instability.ts`
- Pattern: Weighted ingestion from protests, military, news, outages, conflicts, displacement, climate data

**Cross-Module Integration:**
- Purpose: Coordinate behavior across loosely-coupled services
- Location: `src/services/cross-module-integration.ts`
- Pattern: Centralized event registry, listener subscriptions, cascade effects (e.g., protest → military posture update)

**Map Rendering Abstraction:**
- Purpose: Conditional rendering: Deck.GL (WebGL) on desktop, D3/SVG fallback on mobile
- Location: `src/components/MapContainer.ts` (delegator) → `src/components/DeckGLMap.ts` or `src/components/Map.ts`
- Pattern: Unified interface, implementation swapped at runtime based on device capability

## Entry Points

**Main App:**
- Location: `src/main.ts`
- Triggers: Page load
- Responsibilities:
  - Initialize analytics, theme, runtime config
  - Install service worker for offline support
  - Create App instance and call init()

**App Orchestrator:**
- Location: `src/App.ts` (4,287 lines)
- Triggers: Application lifecycle
- Responsibilities:
  - Initialize all services (fetch loops, WebSocket streams)
  - Create and manage all panels
  - Handle user interactions (map clicks, panel resizing, time range changes)
  - Synchronize state to localStorage and URL
  - Coordinate data updates across components

**Settings Page:**
- Location: `src/settings-main.ts`
- Triggers: User navigates to /settings
- Responsibilities: Desktop app configuration, API key management, feature toggles

## Error Handling

**Strategy:** Graceful degradation with circuit breakers and fallbacks

**Patterns:**
- **Circuit Breaker**: `src/utils/circuit-breaker.ts` — track API failures, pause requests after threshold, resume after cooldown
- **Fallback Rendering**: Missing data renders as empty state, no breaking exceptions
- **Service Decomposition**: If one feed fails, others continue; if clustering fails, show raw items
- **Error Logging**: Errors logged to console; production errors sent to Vercel Analytics
- **Recovery**: Page reload or service restart on critical state corruption

## Cross-Cutting Concerns

**Logging:** Console-based only; structured with `[Module]` prefix in App.ts
```
console.log('[App] Variant check: stored="tech", current="full"')
```

**Validation:** Input validation at API boundaries; type safety at compile time via TypeScript strict mode

**Authentication:**
- API Keys: Environment variables (dev) or Tauri secrets (desktop)
- User Data: Monitors/preferences stored in localStorage (no server backend)

**Internationalization:**
- i18next library (`src/services/i18n.ts`)
- 24 locale files in `src/locales/`
- All UI text pulled through `t()` function for translation

**Performance Optimization:**
- Debouncing: URL state updates, panel filter operations
- Memoization: Entity index cached, clustering results reused
- Web Workers: ML inference, trend analysis offloaded
- Code Splitting: ML dependencies (onnxruntime, transformers.js) in separate chunk
- Lazy Loading: Components created on-demand, workers initialized on first use

**Theme Management:**
- Inline script in HTML applies stored theme before page renders (prevents flash)
- CSS custom properties for color scheme
- Light/dark mode toggle persisted to localStorage

---

*Architecture analysis: 2026-02-18*
