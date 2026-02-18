# External Integrations

**Analysis Date:** 2026-02-18

## APIs & External Services

### Real-Time Intelligence & News

**RSS Feed Aggregation:**
- BBC News - `/rss/bbc`
- The Guardian - `/rss/guardian`
- NPR - `/rss/npr`
- AP News - `/rss/apnews` (via RSSHub)
- Al Jazeera - `/rss/aljazeera`
- CNN - `/rss/cnn`
- Hacker News - `/rss/hn`
- Ars Technica - `/rss/arstechnica`
- The Verge - `/rss/verge`
- CNBC - `/rss/cnbc`
- MarketWatch - `/rss/marketwatch`
- Foreign Policy - `/rss/foreignpolicy`
- The Diplomat - `/rss/diplomat`
- Financial Times - `/rss/ft`
- Reuters - `/rss/reuters`
- Yahoo Finance News - `/rss/yahoonews`
- VentureBeat - `/rss/venturebeat`
- TechCrunch - `/rss/techcrunch`
- Google News - `/rss/googlenews`

**Defense & Intelligence Sources:**
- Defense One - `/rss/defenseone`
- War on the Rocks - `/rss/warontherocks`
- Breaking Defense - `/rss/breakingdefense`
- Bellingcat - `/rss/bellingcat`
- Krebs on Security - `/rss/krebs`
- The Drive (War Zone) - `/rss/warzone`

**AI & Tech Industry:**
- OpenAI Blog - `/rss/openai`
- Anthropic Blog - `/rss/anthropic`
- Google AI Blog - `/rss/googleai`
- DeepMind Blog - `/rss/deepmind`
- Hugging Face - `/rss/huggingface`
- MIT Technology Review - `/rss/techreview`
- arXiv.org - `/rss/arxiv`

**Government Sources:**
- White House - `/rss/whitehouse`
- US State Department - `/rss/statedept`, `/rss/state`
- Department of Defense - `/rss/defense`, `/rss/defensegov`
- Department of Justice - `/rss/justice`
- CDC - `/rss/cdc`
- FEMA - `/rss/fema`
- DHS - `/rss/dhs`
- Federal Reserve - `/rss/fedreserve`
- SEC - `/rss/sec`
- US Treasury - `/rss/treasury`
- CISA - `/rss/cisa`

**Think Tanks & Policy:**
- Brookings Institution - `/rss/brookings`
- Council on Foreign Relations - `/rss/cfr`
- CSIS - `/rss/csis`

**Location:** `src/services/rss.ts`, `src/config/feeds.ts` (feed definitions)
**Implementation:** Vite dev proxy to RSS endpoints + Playwright page content fetching
**Caching:** 10-minute TTL with persistent fallback cache via IndexedDB

### Markets & Financial Data

**Stock Markets:**
- Finnhub - `/api/finnhub` (via Vite proxy)
  - SDK: Client via fetch
  - Auth: `FINNHUB_API_KEY` (optional, limits-free tier)
  - Real-time: Stock quotes, technical indicators
  - Location: `src/services/markets.ts`

**Commodities & Forex:**
- Yahoo Finance - `/api/yahoo` (Vite proxy to query1.finance.yahoo.com)
  - Auth: None (no API key required)
  - Data: Indices, futures, forex rates
  - Location: `src/services/markets.ts`

**Cryptocurrency:**
- CoinGecko - `/api/coingecko` (Vite proxy to api.coingecko.com)
  - Auth: None (free tier)
  - Data: Crypto prices, 24h changes, sparklines
  - Location: `src/services/markets.ts`

**Prediction Markets:**
- Polymarket - `/api/polymarket` (Railway relay proxy)
  - Auth: None (public API)
  - Data: Event markets, probabilities, volumes
  - Relay: Uses Railway relay because Cloudflare JA3 blocks Vercel
  - Location: `src/services/polymarket.ts`

### Economic & Government Data

**Federal Reserve Economic Data (FRED):**
- API: `/api/fred-data` (Vite proxy, server-side in production)
- Auth: `FRED_API_KEY` (required via env)
- Data: CPI, unemployment, Fed funds rate, VIX, treasury yields, etc.
- Series tracked: WALCL, FEDFUNDS, T10Y2Y, UNRATE, CPIAUCSL, DGS10, VIXCLS
- Location: `src/services/fred.ts`

**US Government Spending:**
- USA Spending API - Public endpoint
- Data: Federal contract and spending analytics
- Location: `src/services/usa-spending.ts`

**World Bank:**
- World Bank Open Data API
- Data: Development indicators, GDP, population, poverty
- Relay: Uses Railway WS relay in production
- Location: `src/services/worldbank.ts`

**US Energy Information Administration (EIA):**
- EIA API - `/api/eia` proxy
- Auth: `EIA_API_KEY` (required)
- Data: Oil prices, energy production/consumption
- Location: `src/services/oil-analytics.ts`

### Military & Transportation Tracking

**Aircraft Tracking:**
- OpenSky Network - `/api/opensky` (Railway relay)
  - Auth: OAuth via `OPENSKY_CLIENT_ID`, `OPENSKY_CLIENT_SECRET`
  - Data: Military and commercial flight detection
  - Relay: Uses Railway/WSRelay because Vercel blocked by OpenSky
  - Location: `src/services/military-flights.ts`

**Aircraft Enrichment:**
- Wingbits API - Aircraft metadata/classification
  - Auth: `WINGBITS_API_KEY`
  - Data: Operator, aircraft type, military classification
  - Location: `src/services/wingbits.ts`

**Vessel/Ship Tracking:**
- AISStream WebSocket - Live vessel positions
  - Auth: `AISSTREAM_API_KEY`
  - Relay: Via Railway WebSocket relay (`VITE_WS_RELAY_URL`)
  - Data: Ship MMSI, name, position, heading, speed
  - Location: `src/services/ais.ts`

**Airport Status:**
- FAA NASSTATUS - `/api/faa`
  - Auth: None
  - Data: Airport delays, closures
  - Location: `src/services/flights.ts`

**ADS-B Exchange:**
- ADS-B Exchange API - `/api/adsb-exchange`
  - Auth: None
  - Data: Supplemental military aircraft tracking
  - Location: Used as backup in `src/services/military-flights.ts`

### Geopolitical & Conflict Data

**Conflict Events (ACLED):**
- ACLED - `/api/acled`
  - Auth: `ACLED_ACCESS_TOKEN` (required for free tier)
  - Data: Battle, explosion, violence, protest events with fatalities
  - Location: `src/services/conflicts.ts`

**Armed Conflict Events (UCDP):**
- UCDP - Uppsala Conflict Data Program
  - Auth: `UC_DP_KEY`
  - Data: Battle deaths, conflict parties, locations
  - Location: `src/services/ucdp.ts`, `src/services/ucdp-events.ts`

**Global Events & Intelligence (GDELT):**
- GDELT GEO 2.0 API - `/api/gdelt`, `/api/gdelt-geo`
  - Auth: None
  - Data: Global event database, geolocation data
  - Location: `src/services/gdacs.ts`

**Natural Disasters (NASA EONET):**
- NASA EONET - Earth Observatory Natural Events Tracker
  - Auth: None
  - Data: Wildfires, volcanoes, earthquakes, floods
  - Location: `src/services/eonet.ts`

**Civil Unrest (Humanitarian Data Exchange):**
- HAPI - Humanitarian Data API
  - Auth: None
  - Data: Humanitarian emergency alerts
  - Location: `src/services/hapi.ts`

**UN Refugee Data:**
- UNHCR API
  - Auth: None
  - Data: Refugee populations by country/region
  - Location: `src/services/unhcr.ts`

### Natural Hazards & Environmental

**Earthquakes:**
- USGS Earthquake Hazards API - `/api/earthquake`
  - Auth: None
  - Data: Magnitude, location, depth, URL
  - Location: `src/services/earthquakes.ts`

**Fire/Thermal Detection:**
- NASA FIRMS - `/api/firms-satellite`
  - Auth: `NASA_FIRMS_API_KEY` (optional, fallback to public VIIRS)
  - Data: Satellite-detected active fires (MODIS, VIIRS)
  - Location: `src/services/firms-satellite.ts`

**Tropical Cyclones (GDACS):**
- ReliefWeb/GDACS Cyclone Data
  - Auth: None
  - Location: `src/services/gdacs.ts`

**Climate & Weather:**
- Climate/weather APIs (various public sources)
  - Location: `src/services/climate.ts`

### Internet & Infrastructure

**Internet Outages (Cloudflare Radar):**
- Cloudflare Radar Annotations API - `/api/cloudflare-radar`
  - Auth: `CLOUDFLARE_API_TOKEN` (required)
  - Data: BGP hijacks, DDoS events, outage annotations
  - Location: `src/services/outages.ts`

**Maritime Safety (NGA):**
- NGA Maritime Safety Information - `/api/nga-msi`
  - Auth: None
  - Data: Navigation warnings, hazard alerts
  - Location: Integrated in maritime tracking

**Pentagon Pizza Index (PizzINT):**
- PizzINT.watch - `/api/pizzint`
  - Auth: None
  - Data: Pentagon activity indicator (satirical/signal)
  - Location: `src/services/pizzint.ts`

### Threat Intelligence & Cybersecurity

**Abuse.ch - URLhaus & ThreatFox:**
- URLhaus - Phishing/malware URLs
  - Auth: `URLHAUS_AUTH_KEY` (required)
  - API: `/api/cyber-threats` (backend aggregation)
  - Location: `src/services/cyber-threats.ts`

- ThreatFox - Malware C2 servers
  - Auth: Via URLhaus integration
  - Location: `src/services/cyber-threats.ts`

**AlienVault OTX (Open Threat Exchange):**
- OTX API - Indicators of Compromise (IOCs)
  - Auth: `OTX_API_KEY` (optional)
  - Data: Malware, C2, phishing, botnet IOCs
  - Location: `src/services/cyber-threats.ts`

**AbuseIPDB:**
- AbuseIPDB Reputation API
  - Auth: `ABUSEIPDB_API_KEY` (optional)
  - Data: IP reputation, blacklist status
  - Location: `src/services/cyber-threats.ts`

**Cyber Threats Aggregation:**
- Integrated endpoint: `/api/cyber-threats`
- Sources: Feodo tracker, URLhaus, ThreatFox, OTX, AbuseIPDB
- Location: `src/services/cyber-threats.ts`

### Academic & Research

**arXiv Papers:**
- arXiv.org API - `/api/arxiv`
  - Auth: None
  - Data: CS.AI papers, latest research
  - Location: `src/services/arxiv.ts`

**GitHub Trending:**
- GitHub API (no official trending endpoint, scraped)
  - Auth: None
  - Data: Trending repositories by language
  - Location: `src/services/github-trending.ts`

**Hacker News:**
- Hacker News API - `/api/hackernews`
  - Auth: None
  - Data: Top stories, tech news
  - Location: `src/services/hackernews.ts`

## Data Storage

**Databases:**
- None - Pure browser-based application

**Client-Side Storage:**
- IndexedDB (`worldmonitor_db`)
  - Object stores: `baselines` (activity baselines), `snapshots` (temporal snapshots)
  - Location: `src/services/storage.ts`

**Persistent Cache (Hybrid):**
- Desktop: Tauri file system via `read_cache_entry`, `write_cache_entry`
- Web: LocalStorage with `worldmonitor-persistent-cache:` prefix
- Used for: Feed caches, baseline data, snapshots
- Location: `src/services/persistent-cache.ts`

**In-Memory Caches:**
- Map-based flight cache (5-min TTL) - `src/services/military-flights.ts`
- Map-based AIS callback retention (2-hour TTL) - `src/services/ais.ts`
- Regex-based threat detection cache - `src/services/threat-classifier.ts`

**File Storage:**
- Desktop only: Tauri manages JSON files in app data directory
- Web: No file storage (IndexedDB only)

## Caching Strategy

**Redis (Desktop Only):**
- Service: @upstash/redis 1.36.1
- Usage: Desktop sidecar caching for expensive computations
- Location: Desktop app via Tauri sidecar

**Service Worker:**
- Vite PWA plugin manages caching strategies:
  - **Map Tiles** (MapTiler, CartoDB): CacheFirst with 30-day expiration
  - **Fonts** (Google Fonts CSS): StaleWhileRevalidate
  - **Fonts** (Google Fonts woff): CacheFirst with 365-day expiration
  - **Images**: StaleWhileRevalidate with 7-day expiration
  - **API calls**: NetworkOnly (no caching)
  - **HTML**: NetworkFirst with 3-second timeout

## Authentication & Identity

**Auth Providers:**
- None - No user authentication required
- All access via public APIs or server-side API keys

**API Keys:**
- Stored in browser via: Environment variables, localStorage, Tauri keyring
- Desktop: Secure storage via native OS keyring (macOS/Windows)
- Web: Environment variables (Vercel deployment)
- Runtime feature toggles via localStorage

**OAuth (Limited):**
- OpenSky Network: OAuth client credentials flow
  - Credentials: `OPENSKY_CLIENT_ID`, `OPENSKY_CLIENT_SECRET`
  - Used for: Higher rate limits on military flight data

## Monitoring & Observability

**Analytics:**
- Vercel Analytics - `/api/vercel`
  - Tracks: Page views, interactions, performance metrics
  - Client: @vercel/analytics 1.6.1

**Error Tracking:**
- None detected - No error service integrated

**Logs:**
- Browser console: `console.log`, `console.warn`, `console.error`
- Desktop: Tauri logs
- Location: Distributed throughout services

## Webhooks & Callbacks

**Incoming Webhooks:**
- None detected

**Outgoing Callbacks:**
- AIS vessel tracking: Subscribe/unsubscribe callbacks
  - Retained in memory (2-hour window)
  - Location: `src/services/ais.ts`

**WebSocket Connections:**
- AISStream: Live vessel position updates (wss://stream.aisstream.io)
- Railway relay: AIS, OpenSky, World Bank data via `/ws/aisstream`
- Custom app WebSocket: Not used (all via HTTP REST + WebSocket relay)

## Deployment & Infrastructure

**Hosting:**
- Vercel - Web deployment (worldmonitor.app and variants)
- Tauri bundling - Desktop apps (macOS dmg, Windows nsis/msi, Linux appimage)

**Edge Functions (Vercel):**
- `/api/polymarket` - Proxy to Polymarket (bypasses Cloudflare JA3)
- `/api/fred-data` - FRED API with auth key handling
- `/api/ais-snapshot` - AIS relay (backup if Railway unavailable)

**Relay Infrastructure:**
- Railway - WebSocket relay for:
  - `/ws/aisstream` - AISStream WebSocket
  - `/opensky` - OpenSky API HTTP endpoint
  - `/polymarket` - Polymarket API HTTP endpoint
  - `/ais/snapshot` - AIS snapshot HTTP endpoint

**Desktop Sidecar:**
- Location: `src-tauri/sidecar/`
- Node.js-based API server on `http://127.0.0.1:46123`
- Endpoints: `/api/local-env-update`, `/api/local-validate-secret`
- Purpose: Secrets management and local API proxying

## Feature Flags & Runtime Configuration

**Feature Management:**
- File: `src/services/runtime-config.ts`
- Toggles stored in: localStorage (`worldmonitor-runtime-feature-toggles`)
- All features default to enabled, disabled if secrets missing

**Toggleable Features:**
- `aiGroq` - Groq LLM summarization
- `aiOpenRouter` - OpenRouter LLM fallback
- `economicFred` - FRED economic data
- `energyEia` - EIA oil analytics
- `internetOutages` - Cloudflare Radar
- `acledConflicts` - ACLED conflicts/protests
- `abuseChThreatIntel` - abuse.ch threat intel
- `alienvaultOtxThreatIntel` - AlienVault OTX
- `abuseIpdbThreatIntel` - AbuseIPDB
- `wingbitsEnrichment` - Wingbits aircraft metadata
- `aisRelay` - AIS vessel tracking
- `openskyRelay` - OpenSky military flights
- `finnhubMarkets` - Finnhub market data
- `nasaFirms` - NASA FIRMS fire detection

---

*Integration audit: 2026-02-18*
