# Codebase Structure

**Analysis Date:** 2026-02-18

## Directory Layout

```
worldmonitor.nosync/
├── src/                           # Main application source
│   ├── main.ts                    # Entry point: bootstrap & analytics
│   ├── App.ts                     # Main orchestrator (4,287 lines)
│   ├── settings-main.ts           # Settings page bootstrap
│   ├── components/                # UI components (51 files)
│   ├── services/                  # Data & analysis services (80 files)
│   ├── config/                    # Configuration & static data (26 files)
│   ├── types/                     # TypeScript type definitions
│   ├── utils/                     # Shared utilities & helpers
│   ├── styles/                    # CSS stylesheets
│   ├── workers/                   # Web Worker implementations
│   ├── bootstrap/                 # Startup utilities
│   ├── locales/                   # i18n translation files (24 languages)
│   └── e2e/                       # E2E test helpers
├── src-tauri/                     # Tauri desktop app wrapper
│   ├── src/                       # Rust backend for desktop
│   ├── sidecar/                   # Local Node.js API server
│   └── capabilities/              # Security policies
├── api/                           # Vercel serverless functions (62 subdirs)
│   ├── index.ts                   # Health check
│   ├── data/                      # Data manipulation endpoints
│   ├── pizzint/                   # Pentagon Pizza Index proxy
│   ├── youtube/                   # YouTube API integration
│   ├── eia/                       # Energy Information Administration
│   ├── wingbits/                  # Supply chain signals
│   └── ...other endpoints
├── tests/                         # Node.js tests for data processing
├── e2e/                           # Playwright E2E tests
├── docs/                          # Documentation & guides
├── public/                        # Static assets served directly
│   ├── data/                      # GeoJSON boundaries, configs
│   └── favico/                    # Favicons for all platforms
├── vite.config.ts                 # Vite build configuration
├── tsconfig.json                  # TypeScript configuration
├── playwright.config.ts           # E2E test configuration
├── index.html                     # Main HTML entry (variant-aware)
├── settings.html                  # Settings page HTML
└── package.json                   # Dependencies
```

## Directory Purposes

**src/components/:**
- Purpose: Reusable UI components for dashboard panels, maps, modals
- Contains: 51 TypeScript files implementing UI widgets
- Key files:
  - `Panel.ts` — Base class for resizable dashboard widgets
  - `MapContainer.ts` — Conditional map renderer (WebGL/SVG)
  - `DeckGLMap.ts` — WebGL map with deck.gl (3,838 lines)
  - `Map.ts` — SVG fallback map for mobile (3,489 lines)
  - `NewsPanel.ts`, `MarketPanel.ts`, `LiveNewsPanel.ts` — Content panels
  - `CIIPanel.ts`, `StrategicRiskPanel.ts`, `InsightsPanel.ts` — Analysis panels
  - `SearchModal.ts`, `SignalModal.ts` — User interactions

**src/services/:**
- Purpose: Data fetching, aggregation, analysis, state management
- Contains: 80+ service modules handling different aspects
- Categories:
  - **Data fetching**: `rss.ts`, `markets.ts`, `earthquakes.ts`, `flights.ts`, `military-flights.ts`, `military-vessels.ts`, `ais.ts`
  - **Analysis**: `clustering.ts`, `analysis-core.ts`, `signal-aggregator.ts`, `correlation.ts`, `threat-classifier.ts`
  - **Geospatial**: `geo-convergence.ts`, `geo-hub-index.ts`, `geo-activity.ts`, `reverse-geocode.ts`, `country-geometry.ts`
  - **Domain-specific**: `country-instability.ts`, `military-surge.ts`, `infrastructure-cascade.ts`, `hotspot-escalation.ts`
  - **ML/Workers**: `ml-worker.ts`, `analysis-worker.ts`
  - **Storage**: `persistent-cache.ts`, `storage.ts`, `data-freshness.ts`
  - **Utilities**: `velocity.ts`, `activity-tracker.ts`, `entity-extraction.ts`, `entity-index.ts`

**src/config/:**
- Purpose: Feature flags, panel layouts, map layers, geospatial references, static lookup data
- Contains: 26 configuration files
- Key files:
  - `variant.ts` — Runtime variant detection (full/tech/finance)
  - `variants/base.ts`, `full.ts`, `tech.ts`, `finance.ts` — Variant-specific configs
  - `panels.ts` — Panel order and enable/disable settings per variant
  - `feeds.ts` — RSS feed definitions (850 lines of feed URLs)
  - `geo.ts` — Strategic hotspots, conflict zones, military bases, cables, nuclear facilities (1,240 lines)
  - `ai-datacenters.ts` — AI facility locations (3,981 lines)
  - `tech-geo.ts`, `finance-geo.ts` — Tech/finance hub locations
  - `pipelines.ts` — Energy infrastructure (1,035 lines)
  - `markets.ts` — Stock/commodity/sector definitions

**src/types/:**
- Purpose: Shared TypeScript type definitions
- Contains: `index.ts` (1,293 lines) with all domain types
- Defines:
  - Data types: `NewsItem`, `ClusteredEvent`, `MarketData`, `CryptoData`
  - Event types: `InternetOutage`, `SocialUnrestEvent`, `MilitaryFlight`, `MilitaryVessel`, `CyberThreat`, `UcdpGeoEvent`
  - Configuration: `PanelConfig`, `MapLayers`, `Monitor`
  - Enums: `VelocityLevel`, `SentimentType`, `DeviationLevel`, `AssetType`

**src/utils/:**
- Purpose: Shared algorithms, formatting, constants, helpers
- Contains: 10 utility modules
- Key files:
  - `analysis-constants.ts` — Similarity thresholds, keywords, scoring rules
  - `circuit-breaker.ts` — API failure tracking and backoff
  - `urlState.ts` — Map state encoding/decoding for sharing
  - `theme-manager.ts` — Light/dark mode toggle
  - `reverse-geocode.ts` — Country lookup from coordinates
  - `sanitize.ts`, `export.ts`, `proxy.ts` — Security & data export helpers

**src/styles/:**
- Purpose: CSS stylesheets for all UI components
- Contains: Global styles, component styles, theme customization
- Files: `main.css` and component-specific CSS

**src/workers/:**
- Purpose: Web Worker implementations for background processing
- Contains: ML worker for sentiment analysis and NLP tasks
- Note: Workers excluded from TypeScript compilation (`tsconfig.json` exclude)

**src/bootstrap/:**
- Purpose: Startup and initialization helpers
- Contains: `chunk-reload.ts` — Recovery from stale bundle chunks after deployment

**src/locales/:**
- Purpose: Internationalization translation files
- Contains: 24 language files (`.d.ts` type definitions for i18next)
- Languages: en, es, fr, de, it, pt, nl, ru, zh, ar, ja, ko, pl, sv, and others

**src-tauri/:**
- Purpose: Desktop application wrapper using Tauri framework
- Contains:
  - `src/` — Rust backend for desktop-specific features
  - `sidecar/node/` — Local Node.js API server for desktop API proxying
  - `icons/` — App icons for different platforms
  - `capabilities/` — Tauri security capabilities configuration

**api/:**
- Purpose: Vercel serverless functions as API gateway
- Contains: Endpoint implementations for data that can't be fetched from frontend
- Key endpoints:
  - `index.ts` — Health check
  - `pizzint/gdelt.ts` — Pentagon Pizza Index tension indicators
  - `youtube/embed.ts` — YouTube live video detection
  - `cyber-threats.ts` — Cyber threat aggregation
  - Plus 50+ other endpoints for various integrations

**public/:**
- Purpose: Static assets served directly without build processing
- Contains:
  - `data/` — GeoJSON files, boundary data, configuration data
  - `favico/` — Favicon files for all platforms (iOS, Android, desktop)

**tests/:**
- Purpose: Node.js tests for data processing and API integration
- Contains: `.test.mjs` files for testing RSS parsing, data transformation, API responses

**e2e/:**
- Purpose: Playwright E2E tests for browser automation
- Contains:
  - `*.spec.ts` — Test scenarios (map interaction, panel rendering, visual regression)
  - Snapshots directory for golden image comparison tests

## Key File Locations

**Entry Points:**
- `src/main.ts` — Main application bootstrap (66 lines)
- `src/settings-main.ts` — Settings page bootstrap (245 lines)
- `index.html` — HTML entry point with variant-aware meta tags
- `settings.html` — Settings page HTML

**Configuration:**
- `vite.config.ts` — Build configuration with variant system, proxies, code splitting
- `tsconfig.json` — TypeScript strict mode, path aliases
- `playwright.config.ts` — E2E test configuration

**Core Logic:**
- `src/App.ts` — Main orchestrator with all initialization and event handling (4,287 lines)
- `src/services/analysis-core.ts` — News clustering algorithm, shared with workers (687 lines)
- `src/services/signal-aggregator.ts` — Geographic signal correlation
- `src/services/country-instability.ts` — Risk score computation (702 lines)

**Testing:**
- `tests/` — Unit/integration tests for data layer (run with `node --test`)
- `e2e/` — Playwright tests for browser scenarios

## Naming Conventions

**Files:**
- Components: `PascalCase.ts` (e.g., `NewsPanel.ts`, `MapContainer.ts`)
- Services: `kebab-case.ts` (e.g., `analysis-core.ts`, `country-instability.ts`)
- Utilities: `kebab-case.ts` (e.g., `reverse-geocode.ts`, `circuit-breaker.ts`)
- Configuration: `kebab-case.ts` (e.g., `ai-datacenters.ts`, `tech-geo.ts`)

**Directories:**
- Components: `components/` — plural, lowercase
- Services: `services/` — plural, lowercase
- Configuration: `config/` and `config/variants/` — lowercase
- Utilities: `utils/` — plural, lowercase
- Types: `types/` — plural, lowercase

**Classes:**
- PascalCase: `App`, `Panel`, `MapContainer`, `DeckGLMap`, `MLWorkerManager`
- Interface/Type PascalCase: `NewsItem`, `ClusteredEvent`, `MapLayers`

**Functions & Variables:**
- camelCase: `fetchCategoryFeeds()`, `clusterNewsHybrid()`, `detectGeoConvergence()`
- Constants: UPPER_SNAKE_CASE: `SIMILARITY_THRESHOLD`, `PREDICTION_SHIFT_THRESHOLD`, `IDLE_PAUSE_MS`

**Enums:**
- PascalCase name, values are camelCase or UPPER_SNAKE_CASE
- Example: type `VelocityLevel = 'normal' | 'elevated' | 'spike'`

## Where to Add New Code

**New Feature (End-to-End):**
1. **Type definition**: Add to `src/types/index.ts`
2. **Service logic**: Create `src/services/my-feature.ts`
3. **Service export**: Add to `src/services/index.ts`
4. **UI Component**: Create `src/components/MyFeaturePanel.ts` (extends `Panel`)
5. **Configuration**: Add to `src/config/panels.ts` (variant-specific)
6. **Update App.ts**: Initialize service, create panel, wire events
7. **Styling**: Add CSS to `src/styles/main.css`

**Example: Adding a new data source**
- Add fetch service: `src/services/my-api.ts` (exports `fetchMyApi()`)
- Add to index export: `src/services/index.ts`
- Create panel: `src/components/MyDataPanel.ts`
- Import in App.ts and instantiate in `init()`
- Add to panel config in `src/config/panels.ts` for the relevant variant

**New Component/Module:**
- Implementation: `src/components/MyComponent.ts` for UI, `src/services/my-service.ts` for logic
- Co-locate related code: If MyComponent needs specialized service, create dedicated service file
- Export through: `src/components/index.ts` or `src/services/index.ts` barrel files

**Utilities:**
- Shared helpers: `src/utils/my-utility.ts`
- Analysis helpers: `src/utils/analysis-constants.ts` (thresholds, keywords, scoring)
- UI helpers: `src/utils/theme-colors.ts`, `src/utils/export.ts`

**Configuration Data:**
- Geographic reference data: `src/config/geo.ts`
- API references: `src/config/variants/base.ts` (SHARED), variant-specific in `full.ts`, `tech.ts`, `finance.ts`
- Feed definitions: `src/config/feeds.ts`
- Entity locations: `src/config/ai-datacenters.ts`, `src/config/tech-geo.ts`, etc.

## Special Directories

**src/e2e/:**
- Purpose: E2E test utilities and harness
- Generated: No
- Committed: Yes
- Contains test helpers, map interaction mock, data fixtures

**dist/:**
- Purpose: Built output from Vite
- Generated: Yes (output of `npm run build`)
- Committed: No (in .gitignore)
- Contains: Bundled JS, CSS, optimized assets

**public/data/:**
- Purpose: Static data files bundled with app
- Generated: No (manually curated)
- Committed: Yes
- Contains: GeoJSON for country boundaries, region definitions, configuration files

**node_modules/:**
- Purpose: Dependencies
- Generated: Yes (output of `npm install`)
- Committed: No (in .gitignore)

**tests/:**
- Purpose: Data layer unit/integration tests
- Generated: No (source files)
- Committed: Yes
- Run with: `npm run test:data`

## Variant System Integration

All three variants (full, tech, finance) share:
- Core component infrastructure (panels, maps, base UI)
- Service infrastructure (fetching, clustering, analysis)
- Type definitions and utilities

Variant-specific differences:
- **Panel config**: `src/config/panels.ts` — different panels enabled per variant
- **Map layers**: `src/config/panels.ts` — different default layers
- **Feed sources**: Variant determines which feeds are loaded
- **API endpoints**: Tech and finance variants request different data

The variant is determined at **build time** via `VITE_VARIANT` environment variable (see `src/config/variant.ts`). It can also be overridden at **runtime** by localStorage setting `worldmonitor-variant`.

---

*Structure analysis: 2026-02-18*
