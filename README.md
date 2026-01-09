# World Monitor

Real-time global intelligence dashboard aggregating news, markets, geopolitical data, and infrastructure monitoring into a unified situation awareness interface.

![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat&logo=vite&logoColor=white)
![D3.js](https://img.shields.io/badge/D3.js-F9A03C?style=flat&logo=d3.js&logoColor=white)

## Features

### Interactive Global Map
- **Zoom & Pan** - Smooth navigation with mouse/trackpad gestures
- **Multiple Views** - Global, US, and MENA region presets
- **Layer System** - Toggle visibility of different data layers
- **Time Filtering** - Filter events by time range (1h to 7d)

### Data Layers

| Layer | Description |
|-------|-------------|
| **Hotspots** | Intelligence hotspots with activity levels based on news correlation |
| **Conflicts** | Active conflict zones with party information |
| **Military Bases** | Global military installations |
| **Pipelines** | 88 major oil & gas pipelines worldwide |
| **Undersea Cables** | Critical internet infrastructure |
| **Nuclear Facilities** | Power plants and research reactors |
| **Gamma Irradiators** | IAEA-tracked radiation sources |
| **AI Datacenters** | Major AI compute infrastructure |
| **Earthquakes** | Live USGS seismic data |
| **Weather Alerts** | Severe weather warnings |
| **Internet Outages** | Network connectivity disruptions |
| **Sanctions** | Countries under economic sanctions |
| **Economic Centers** | Major exchanges and central banks |

### News Aggregation

Multi-source RSS aggregation across categories:
- **World / Geopolitical** - BBC, Reuters, AP, Guardian, NPR
- **Middle East / MENA** - Al Jazeera, BBC ME, CNN ME
- **Technology** - Hacker News, Ars Technica, The Verge, MIT Tech Review
- **AI / ML** - ArXiv, Hugging Face, VentureBeat, OpenAI
- **Finance** - CNBC, MarketWatch, Financial Times, Yahoo Finance
- **Government** - White House, State Dept, Pentagon, Treasury, Fed, SEC
- **Intel Feed** - Defense One, Breaking Defense, Bellingcat, Krebs Security
- **Think Tanks** - Foreign Policy, Brookings, CSIS, CFR
- **Layoffs Tracker** - Tech industry job cuts
- **Congress Trades** - Congressional stock trading activity

### Market Data
- **Stocks** - Major indices and tech stocks
- **Commodities** - Oil, gold, natural gas, copper
- **Crypto** - Bitcoin, Ethereum, and top cryptocurrencies
- **Sector Heatmap** - Visual sector performance
- **Economic Indicators** - Fed data (GDP, inflation, unemployment)

### Prediction Markets
- Polymarket integration for event probability tracking
- Correlation analysis with news events

### Search (⌘K)
Universal search across all data sources:
- News articles
- Geographic hotspots and conflicts
- Infrastructure (pipelines, cables, datacenters)
- Nuclear facilities and irradiators
- Markets and predictions

### Data Export
- JSON export of current dashboard state
- Historical playback from snapshots

---

## Signal Intelligence

The dashboard continuously analyzes data streams to detect significant patterns and anomalies. Signals appear in the header badge (⚡) with confidence scores.

### Signal Types

| Signal | Trigger | What It Means |
|--------|---------|---------------|
| **◉ Convergence** | 3+ source types report same story within 30 minutes | Multiple independent channels confirming the same event—higher likelihood of significance |
| **△ Triangulation** | Wire + Government + Intel sources align | The "authority triangle"—when official channels, wire services, and defense specialists all report the same thing |
| **🔥 Velocity Spike** | Topic mention rate doubles with 6+ sources/hour | A story is accelerating rapidly across the news ecosystem |
| **🔮 Prediction Leading** | Prediction market moves 5%+ with low news coverage | Markets pricing in information not yet reflected in news |
| **📊 Silent Divergence** | Market moves 2%+ with minimal related news | Unexplained price action—possible insider knowledge or algorithm-driven |

### How It Works

The correlation engine maintains rolling snapshots of:
- News topic frequency (by keyword extraction)
- Market price changes
- Prediction market probabilities

Each refresh cycle compares current state to previous snapshot, applying thresholds and deduplication to avoid alert fatigue. Signals include confidence scores (60-95%) based on the strength of the pattern.

---

## Source Intelligence

Not all sources are equal. The system implements a dual classification to prioritize authoritative information.

### Source Tiers (Authority Ranking)

| Tier | Sources | Characteristics |
|------|---------|-----------------|
| **Tier 1** | Reuters, AP, AFP, Bloomberg, White House, Pentagon | Wire services and official government—fastest, most reliable |
| **Tier 2** | BBC, Guardian, NPR, Al Jazeera, CNBC, Financial Times | Major outlets—high editorial standards, some latency |
| **Tier 3** | Defense One, Bellingcat, Foreign Policy, MIT Tech Review | Domain specialists—deep expertise, narrower scope |
| **Tier 4** | Hacker News, The Verge, VentureBeat, aggregators | Useful signal but requires corroboration |

When multiple sources report the same story, the **lowest tier** (most authoritative) source is displayed as the primary, with others listed as corroborating.

### Source Types (Categorical)

Sources are also categorized by function for triangulation detection:

- **Wire** - News agencies (Reuters, AP, AFP, Bloomberg)
- **Gov** - Official government (White House, Pentagon, State Dept, Fed, SEC)
- **Intel** - Defense/security specialists (Defense One, Bellingcat, Krebs)
- **Mainstream** - Major news outlets (BBC, Guardian, NPR, Al Jazeera)
- **Market** - Financial press (CNBC, MarketWatch, Financial Times)
- **Tech** - Technology coverage (Hacker News, Ars Technica, MIT Tech Review)

---

## Algorithms & Design

### News Clustering

Related articles are grouped using **Jaccard similarity** on tokenized headlines:

```
similarity(A, B) = |A ∩ B| / |A ∪ B|
```

- Headlines are tokenized, lowercased, and stripped of stop words
- Articles with similarity ≥ 0.5 are grouped into clusters
- Clusters are sorted by source tier, then recency
- The most authoritative source becomes the "primary" headline

### Velocity Analysis

Each news cluster tracks publication velocity:

- **Sources per hour** = article count / time span
- **Trend** = rising/stable/falling based on first-half vs second-half publication rate
- **Levels**: Normal (<3/hr), Elevated (3-6/hr), Spike (>6/hr)

### Sentiment Detection

Headlines are scored against curated word lists:

**Negative indicators**: war, attack, killed, crisis, crash, collapse, threat, sanctions, invasion, missile, terror, assassination, recession, layoffs...

**Positive indicators**: peace, deal, agreement, breakthrough, recovery, growth, ceasefire, treaty, alliance, victory...

Score determines sentiment classification: negative (<-1), neutral (-1 to +1), positive (>+1)

### Baseline Deviation (Z-Score)

The system maintains rolling baselines for news volume per topic:

- **7-day average** and **30-day average** stored in IndexedDB
- Standard deviation calculated from historical counts
- **Z-score** = (current - mean) / stddev

Deviation levels:
- **Spike**: Z > 2.5 (statistically rare increase)
- **Elevated**: Z > 1.5
- **Normal**: -2 < Z < 1.5
- **Quiet**: Z < -2 (unusually low activity)

This enables detection of anomalous activity even when absolute numbers seem normal.

---

## Dynamic Hotspot Activity

Hotspots on the map are **not static threat levels**. Activity is calculated in real-time based on news correlation.

Each hotspot defines keywords:
```typescript
{
  id: 'dc',
  name: 'DC',
  keywords: ['pentagon', 'white house', 'congress', 'cia', 'nsa', ...],
  agencies: ['Pentagon', 'CIA', 'NSA', 'State Dept'],
}
```

The system counts matching news articles in the current feed, applies velocity analysis, and assigns activity levels:

| Level | Criteria | Visual |
|-------|----------|--------|
| **Low** | <3 matches, normal velocity | Gray marker |
| **Elevated** | 3-6 matches OR elevated velocity | Yellow pulse |
| **High** | >6 matches OR spike velocity | Red pulse |

This creates a dynamic "heat map" of global attention based on live news flow.

---

## Custom Monitors

Create personalized keyword alerts that scan all incoming news:

1. Enter comma-separated keywords (e.g., "nvidia, gpu, chip shortage")
2. System assigns a unique color
3. Matching articles are highlighted in the Monitor panel
4. Matching articles in clusters inherit the monitor color

Monitors persist across sessions via LocalStorage.

---

## Snapshot System

The dashboard captures periodic snapshots for historical analysis:

- **Automatic capture** every refresh cycle
- **7-day retention** with automatic cleanup
- **Stored data**: news clusters, market prices, prediction values, hotspot levels
- **Playback**: Load historical snapshots to see past dashboard states

Baselines (7-day and 30-day averages) are stored in IndexedDB for deviation analysis.

---

## Tech Stack

- **Frontend**: TypeScript, Vite
- **Visualization**: D3.js, TopoJSON
- **Data**: RSS feeds, REST APIs
- **Storage**: IndexedDB for snapshots/baselines, LocalStorage for preferences

## Installation

```bash
# Clone the repository
git clone https://github.com/koala73/worldmonitor.git
cd worldmonitor

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## API Dependencies

The dashboard fetches data from various public APIs:

| Service | Data |
|---------|------|
| RSS2JSON | News feed parsing |
| Alpha Vantage | Stock quotes |
| CoinGecko | Cryptocurrency prices |
| USGS | Earthquake data |
| NWS | Weather alerts |
| FRED | Economic indicators |
| Polymarket | Prediction markets |

## Project Structure

```
src/
├── App.ts              # Main application orchestrator
├── main.ts             # Entry point
├── components/         # UI components
│   ├── Map.ts          # D3 map with all layers
│   ├── MapPopup.ts     # Info popups for map elements
│   ├── SearchModal.ts  # Universal search (⌘K)
│   ├── SignalModal.ts  # Signal intelligence display
│   ├── NewsPanel.ts    # News feed display
│   ├── MarketPanel.ts  # Stock/commodity display
│   ├── MonitorPanel.ts # Custom keyword monitors
│   └── ...
├── config/             # Static data & configuration
│   ├── feeds.ts        # RSS feeds, source tiers, source types
│   ├── geo.ts          # Hotspots, conflicts, bases, cables
│   ├── pipelines.ts    # Pipeline data (88 entries)
│   ├── ai-datacenters.ts
│   ├── irradiators.ts
│   └── markets.ts
├── services/           # Data fetching & processing
│   ├── rss.ts          # RSS parsing
│   ├── markets.ts      # Stock/crypto APIs
│   ├── earthquakes.ts  # USGS integration
│   ├── clustering.ts   # Jaccard similarity clustering
│   ├── correlation.ts  # Signal detection engine
│   ├── velocity.ts     # Velocity & sentiment analysis
│   └── storage.ts      # IndexedDB snapshots & baselines
├── styles/             # CSS
└── types/              # TypeScript definitions
```

## Usage

### Keyboard Shortcuts
- `⌘K` / `Ctrl+K` - Open search
- `↑↓` - Navigate search results
- `Enter` - Select result
- `Esc` - Close modals

### Map Controls
- **Scroll** - Zoom in/out
- **Drag** - Pan the map
- **Click markers** - Show detailed popup
- **Layer toggles** - Show/hide data layers

### Panel Management
- **Drag panels** - Reorder layout
- **Settings (⚙)** - Toggle panel visibility

## Data Sources

### News Feeds
Aggregates 40+ RSS feeds from major news outlets, government sources, and specialty publications with source-tier prioritization.

### Geospatial Data
- **Hotspots**: 25+ global intelligence hotspots with keyword correlation
- **Conflicts**: Active conflict zones with involved parties
- **Pipelines**: 88 operating oil/gas pipelines across all continents
- **Military Bases**: Major global installations
- **Nuclear**: Power plants, research reactors, irradiator facilities

### Live APIs
- USGS earthquake feed (M4.5+ global)
- National Weather Service alerts
- Internet outage monitoring
- Cryptocurrency prices (real-time)

---

## Design Philosophy

**Information density over aesthetics.** Every pixel should convey signal. The dark interface minimizes eye strain during extended monitoring sessions.

**Authority matters.** Not all sources are equal. Wire services and official government channels are prioritized over aggregators and blogs.

**Correlation over accumulation.** Raw news feeds are noise. The value is in clustering related stories, detecting velocity changes, and identifying cross-source patterns.

**Local-first.** No accounts, no cloud sync. All preferences and history stored locally. The only network traffic is fetching public data.

---

## License

MIT

## Author

**Elie Habib**

---

*Built for situational awareness and open-source intelligence gathering.*
