# Technology Stack

**Analysis Date:** 2026-02-18

## Languages

**Primary:**
- TypeScript 5.7.2 - Main application language for frontend and type safety
- JavaScript - Test runners and utility scripts (Node.js)

**Secondary:**
- Rust 2021 edition - Tauri desktop application backend via `src-tauri/Cargo.toml`
- WASM - ML inference via onnxruntime-web for local browser models

## Runtime

**Environment:**
- Node.js - Primary development and build runtime
- Browser (Web) - Client-side execution (ES2020 target)
- Tauri 2.10.0 - Desktop runtime for macOS/Windows/Linux

**Package Manager:**
- npm - Lockfile: package-lock.json (present)

## Frameworks

**Core:**
- Vite 6.0.7 - Build tool and dev server
- TypeScript - Language and type checking
- Custom vanilla TypeScript/DOM - No UI framework (raw Web Components/DOM)

**Build/Dev:**
- Tauri CLI 2.10.0 - Desktop application bundling (dmg, nsis, msi, appimage)
- Vite Plugin PWA 1.2.0 - Progressive Web App generation and service worker management

**Testing:**
- Playwright 1.52.0 - E2E testing with visual regression (snapshots)
- Node test runner (native) - Data validation tests via `node --test`

## Key Dependencies

**Critical - Geospatial & Visualization:**
- deck.gl 9.2.6 - High-performance 3D rendering for geographic data
  - @deck.gl/aggregation-layers 9.2.6 - Clustering and aggregation
  - @deck.gl/core 9.2.6 - Core rendering engine
  - @deck.gl/geo-layers 9.2.6 - Geographic layer support
  - @deck.gl/layers 9.2.6 - Layer types
  - @deck.gl/mapbox 9.2.6 - MapLibre integration
- maplibre-gl 5.16.0 - Vector tile map rendering (basemap)
- topojson-client 3.1.0 - GeoJSON/TopoJSON conversion
- d3 7.9.0 - Data manipulation and visualization utilities

**Data & ML:**
- @xenova/transformers 2.17.2 - Client-side NLP models (Hugging Face Transformers.js)
- onnxruntime-web 1.23.2 - WASM-based ML inference for local models
- youtubei.js 16.0.1 - YouTube data extraction for live streams

**Observability & Analytics:**
- @vercel/analytics 1.6.1 - Frontend analytics collection

**Infrastructure (Desktop):**
- @upstash/redis 1.36.1 - Redis caching client for desktop sidecar
- reqwest 0.12 (Rust) - HTTP client for Tauri backend
- keyring 3 (Rust) - Native OS credential storage for secrets

**i18n:**
- i18next 25.8.10 - Internationalization framework
- i18next-browser-languagedetector 8.2.1 - Browser language detection

**Utilities:**
- ws 8.19.0 - WebSocket client for live data streams

## Configuration

**Environment Variables:**
Build variants controlled via `VITE_VARIANT`:
- `VITE_VARIANT=full` - Full world monitoring (geopolitical)
- `VITE_VARIANT=tech` - Tech industry monitoring
- `VITE_VARIANT=finance` - Financial markets monitoring

Desktop/Development:
- `VITE_DESKTOP_RUNTIME=1` - Enable Tauri desktop mode
- `VITE_E2E=1` - E2E test mode
- `VITE_WS_RELAY_URL` - Railway WebSocket relay for AIS/OpenSky
- `VITE_OPENSKY_RELAY_URL` - OpenSky API relay endpoint
- `VITE_ENABLE_AIS=false` - Disable AIS feature client-side
- `VITE_ENABLE_CYBER_LAYER=true` - Enable cyber threats layer
- `VITE_MAP_INTERACTION_MODE=flat|3d` - Map interaction style
- `VITE_TAURI_API_BASE_URL` - Desktop local API endpoint
- `VITE_TAURI_REMOTE_API_BASE_URL` - Desktop remote API base

**Runtime Secrets (Desktop via Tauri keyring):**
- `GROQ_API_KEY` - Groq LLM summarization
- `OPENROUTER_API_KEY` - OpenRouter LLM fallback
- `FRED_API_KEY` - Federal Reserve Economic Data
- `EIA_API_KEY` - US Energy Information Administration
- `CLOUDFLARE_API_TOKEN` - Cloudflare Radar outages
- `ACLED_ACCESS_TOKEN` - Armed Conflict Location Event Data
- `URLHAUS_AUTH_KEY` - abuse.ch URLhaus threat intel
- `OTX_API_KEY` - AlienVault OTX threat intel (optional)
- `ABUSEIPDB_API_KEY` - AbuseIPDB threat intel (optional)
- `WINGBITS_API_KEY` - Military aircraft enrichment
- `AISSTREAM_API_KEY` - AISStream WebSocket authentication
- `OPENSKY_CLIENT_ID` - OpenSky OAuth client ID
- `OPENSKY_CLIENT_SECRET` - OpenSky OAuth client secret
- `FINNHUB_API_KEY` - Finnhub market data (optional)
- `NASA_FIRMS_API_KEY` - NASA FIRMS fire detection (optional)
- `UC_DP_KEY` - UCDP event data key

**Build:**
- `tsconfig.json` - TypeScript strict mode with ES2020 target
- `vite.config.ts` - Vite build configuration with PWA, variant plugins
- `playwright.config.ts` - E2E test runner configuration
- `src-tauri/tauri.conf.json` - Tauri desktop configuration (variants: tech, finance)

## Platform Requirements

**Development:**
- Node.js (npm, no specific version pinned but implied recent LTS)
- Rust toolchain (for Tauri desktop builds)
- macOS/Windows/Linux (Tauri supports all platforms)

**Production:**
- Vercel - Web hosting (worldmonitor.app, tech.worldmonitor.app, finance.worldmonitor.app)
- Desktop platforms - macOS (dmg), Windows (nsis/msi), Linux (appimage)

## Browser Capabilities

**Required:**
- ES2020 JavaScript support
- IndexedDB for persistent client-side storage
- Service Worker support (PWA)
- WebSocket support for live data
- WebGL/WebGPU for deck.gl 3D rendering
- Web Workers for ML inference and data processing

**Supported:**
- All modern browsers (Chrome, Firefox, Safari, Edge)
- Offline operation via service worker caching

---

*Stack analysis: 2026-02-18*
