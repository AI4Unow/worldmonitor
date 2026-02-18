# Testing Patterns

**Analysis Date:** 2026-02-18

## Test Framework

**Runner:**
- Playwright: `@playwright/test` v1.52.0 for E2E testing
- Node built-in test runner (`node:test`) for data/config validation
- No Jest or Vitest in codebase

**Run Commands:**
```bash
npm run test:e2e               # Run all E2E tests across all variants
npm run test:e2e:runtime       # Desktop runtime routing tests
npm run test:e2e:full          # Full variant E2E tests
npm run test:e2e:tech          # Tech variant E2E tests
npm run test:e2e:finance       # Finance variant E2E tests
npm run test:data              # Data/config validation tests
npm run test:sidecar           # Tauri sidecar backend tests
npm run test:e2e:visual        # Visual regression tests (all variants)
npm run test:e2e:visual:full   # Visual regression for full variant
npm run test:e2e:visual:tech   # Visual regression for tech variant
npm run test:e2e:visual:update # Update visual snapshots
```

**Configuration:**
- Playwright config: bundled with Vite (no separate `playwright.config.ts`)
- Environment variable: `VITE_VARIANT` controls which build variant to test
- Harness files: `tests/runtime-harness.html`, `tests/map-harness.html` for test setup

## Test File Organization

**Location:**
- E2E tests: `/e2e/` directory with `.spec.ts` extension
- Data validation: `/tests/` directory with `.test.mjs` extension
- Visual snapshots: `/e2e/*.spec.ts-snapshots/` (auto-generated)
- Harness/support: `tests/*.html` for test HTML fixtures

**Naming:**
- E2E specs: `<feature>.spec.ts` (e.g., `keyword-spike-flow.spec.ts`, `runtime-fetch.spec.ts`)
- Data tests: `<domain>.test.mjs` (e.g., `deploy-config.test.mjs`, `gulf-fdi-data.test.mjs`)
- Snapshot directories: `<spec-name>.spec.ts-snapshots/` (PNG files)

**Structure:**
```
e2e/
├── keyword-spike-flow.spec.ts      # Feature end-to-end flow
├── runtime-fetch.spec.ts           # Desktop runtime detection
├── map-harness.spec.ts             # Map visualization + visual regression
├── investments-panel.spec.ts       # UI component behavior
└── map-harness.spec.ts-snapshots/  # Golden screenshots

tests/
├── deploy-config.test.mjs          # Vercel cache config validation
├── runtime-harness.html            # E2E test harness
├── gulf-fdi-data.test.mjs          # Data structure validation
└── countries-geojson.test.mjs      # GeoJSON validation
```

## Test Structure

**Suite Organization:**
Uses Playwright `test.describe()` and Node.js `describe()`:

```typescript
// Playwright style (e2e/keyword-spike-flow.spec.ts)
test.describe('keyword spike modal/badge flow', () => {
  test('injects synthetic headlines and renders keyword_spike end-to-end', async ({ page }) => {
    await page.goto('/tests/runtime-harness.html');

    const setup = await page.evaluate(async () => {
      // In-browser setup
    });

    expect(setup.ok).toBe(true);
  });
});

// Node.js test style (tests/deploy-config.test.mjs)
describe('deploy/cache configuration guardrails', () => {
  it('disables caching for HTML entry routes on Vercel', () => {
    assert.equal(getCacheHeaderValue('/'), 'no-cache, no-store, must-revalidate');
  });
});
```

**Patterns:**
- Setup in `test()` or `it()` callback
- In-browser code: `page.evaluate()` for DOM access and module imports
- Multiple expects per test allowed for complex flows
- Sequential test execution within describe block
- Example from `keyword-spike-flow.spec.ts` (lines 4-73):
  ```typescript
  test('injects synthetic headlines and renders keyword_spike end-to-end', async ({ page }) => {
    await page.goto('/tests/runtime-harness.html');

    const setup = await page.evaluate(async () => {
      const { SignalModal } = await import('/src/components/SignalModal.ts');
      const { IntelligenceGapBadge } = await import('/src/components/IntelligenceGapBadge.ts');
      // ... inject test data
      return { ok: true, spikeType, title, badgeCount };
    });

    expect(setup.ok).toBe(true);
    expect(setup.spikeType).toBe('keyword_spike');
    expect(Number(setup.badgeCount)).toBeGreaterThan(0);
  });
  ```

## Mocking

**Framework:** Playwright built-in fixtures and `page.evaluate()`

**Patterns:**
Inject mock data directly in browser context using `page.evaluate()`:

```typescript
// From keyword-spike-flow.spec.ts
const headlines = [
  { source: 'Reuters', title: 'Iran sanctions pressure rises amid talks', link: 'https://example.com/reuters/1' },
  { source: 'AP', title: 'Iran sanctions debate intensifies in Washington', link: 'https://example.com/ap/1' },
  // ... more headlines
].map(item => ({
  ...item,
  pubDate: now,
}));

trending.ingestHeadlines(headlines);
let spikes = trending.drainTrendingSignals();
```

**What to Mock:**
- User input data (headlines, market data)
- System time for temporal tests (via `new Date()`)
- API responses via `page.evaluate()` (indirect)
- Module imports via dynamic imports: `await import('/src/services/...')`

**What NOT to Mock:**
- Actual service logic (test real implementations)
- UI rendering (verify actual DOM state)
- Data structures and types (use real types)
- Complex algorithms like clustering

**Test Data Injection:**
- Create realistic synthetic data matching real types
- Attach to window for cleanup: `(window as unknown as Record<string, unknown>).__keywordSpikeTest`
- Cleanup after test: `store?.badge?.destroy?.()`, `store?.modal?.getElement?.()?.remove()`

## Fixtures and Factories

**Test Data:**
Located in test files, not separate factories. Example from `deploy-config.test.mjs`:

```javascript
const vercelConfig = JSON.parse(readFileSync(resolve(__dirname, '../vercel.json'), 'utf-8'));
const viteConfigSource = readFileSync(resolve(__dirname, '../vite.config.ts'), 'utf-8');

const getCacheHeaderValue = (sourcePath) => {
  const rule = vercelConfig.headers.find((entry) => entry.source === sourcePath);
  const header = rule?.headers?.find((item) => item.key.toLowerCase() === 'cache-control');
  return header?.value ?? null;
};
```

**Location:**
- Inline in test files when small
- Test harness HTML files for complex DOM setup: `tests/runtime-harness.html`, `tests/map-harness.html`
- Browser context data: injected via `page.evaluate()`

## Coverage

**Requirements:** No coverage enforcement or target specified

**View Coverage:**
No standard coverage command configured. To add:
```bash
# Would require Playwright coverage or plugin setup
npm run test:e2e -- --coverage
```

## Test Types

**Unit Tests:**
- Not extensively used (only config/data tests)
- Run via Node test runner: `npm run test:data`
- Test structure validation, cache headers, GeoJSON validity
- Example: `deploy-config.test.mjs` validates Vercel deployment configuration

**Integration Tests:**
- E2E tests act as integration tests
- Test service interactions (trending keywords + signal modal + badge)
- Test data flows (headlines → clustering → signals)
- Example: `keyword-spike-flow.spec.ts` tests full signal flow

**E2E Tests:**
- Primary test type using Playwright
- Real browser environment (Chromium default)
- Test complete user flows and visual outputs
- Variant-specific testing: separate runs for full/tech/finance builds
- Visual regression: screenshot comparison with golden images
- Runtime detection: desktop vs web runtime behavior

**Visual Regression Tests:**
- Golden screenshot comparison per layer and zoom level
- Command: `npm run test:e2e:visual` updates snapshots
- Snapshots stored in `.spec.ts-snapshots/` directories
- Example: `layer-full-ports-z5.png` for full variant ports layer at zoom 5

## Common Patterns

**Async Testing:**
```typescript
// From keyword-spike-flow.spec.ts (lines 44-48)
let spikes = trending.drainTrendingSignals();
for (let i = 0; i < 20 && spikes.length === 0; i += 1) {
  await new Promise(resolve => setTimeout(resolve, 50));
  spikes = trending.drainTrendingSignals();
}

if (spikes.length === 0) {
  return { ok: false, reason: 'No keyword spikes emitted from synthetic data' };
}
```

Waits for async operation with polling (no promise-based waiting needed).

**Error Testing:**
```typescript
// From runtime-fetch.spec.ts (lines 71-80)
test('runtime fetch patch falls back to cloud for local failures', async ({ page }) => {
  await page.goto('/tests/runtime-harness.html');

  const result = await page.evaluate(async () => {
    const runtime = await import('/src/services/runtime.ts');
    const originalFetch = window.fetch.bind(window);

    const calls: string[] = [];
    // Mock fetch to test fallback behavior
  });

  // Assert fallback occurred
});
```

Tests error recovery and fallback logic via fetch interception.

**Browser Context Setup:**
```typescript
// From runtime-fetch.spec.ts
const result = await page.evaluate(async () => {
  // This code runs in browser context
  const runtime = await import('/src/services/runtime.ts');
  const globalWindow = window as unknown as Record<string, unknown>;
  // Direct access to window, fetch, etc.
  return { /* results to test */ };
});

expect(result).toMatchExpectation();
```

Use `page.evaluate()` to access browser globals, modules, and DOM.

**Data Validation:**
```typescript
// From deploy-config.test.mjs (lines 30-36)
it('keeps PWA precache glob free of HTML files', () => {
  assert.match(
    viteConfigSource,
    /globPatterns:\s*\['\*\*\/\*\.\{js,css,ico,png,svg,woff2\}'\]/
  );
  assert.doesNotMatch(viteConfigSource, /globPatterns:\s*\['\*\*\/\*\.\{js,css,html/);
});
```

Use regex matching for config file validation.

## Test Harnesses

**Runtime Harness (`tests/runtime-harness.html`):**
- Minimal HTML page for browser E2E tests
- Loads Vite dev server or built app
- Provides container for dynamic component testing
- Used by: `keyword-spike-flow.spec.ts`, `runtime-fetch.spec.ts`

**Map Harness (`tests/map-harness.html`):**
- Full application with map and layers
- Provides test API via `window.__mapHarness`
- Controls test scenarios (protests, news pulses, hotspots)
- Visual regression baseline
- Used by: `map-harness.spec.ts`

**API Surface:**
From `map-harness.spec.ts` type definitions:
```typescript
seedAllDynamicData: () => void;
setProtestsScenario: (scenario: 'alpha' | 'beta') => void;
setZoom: (zoom: number) => void;
setLayersForSnapshot: (enabledLayers: string[]) => void;
getDeckLayerSnapshot: () => LayerSnapshot[];
getLayerDataCount: (layerId: string) => number;
```

## Variant Testing

**Multi-Variant Support:**
- Full variant: Complete dashboard (default)
- Tech variant: Tech industry focused
- Finance variant: Financial markets focused
- Run tests independently per variant:

```bash
VITE_VARIANT=full npm run build && npm run test:e2e:full
VITE_VARIANT=tech npm run build && npm run test:e2e:tech
VITE_VARIANT=finance npm run build && npm run test:e2e:finance
```

Each variant has different data layers, configs, and visual output.

---

*Testing analysis: 2026-02-18*
