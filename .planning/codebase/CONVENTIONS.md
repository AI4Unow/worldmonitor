# Coding Conventions

**Analysis Date:** 2026-02-18

## Naming Patterns

**Files:**
- PascalCase for class/component files: `NewsPanel.ts`, `DeckGLMap.ts`, `SignalModal.ts`
- kebab-case for utility/service files: `circuit-breaker.ts`, `threat-classifier.ts`, `trending-keywords.ts`
- kebab-case for configuration files: `ai-regulations.ts`, `startup-ecosystems.ts`, `tech-companies.ts`
- `.d.ts` for type definition files: `pwa.d.ts`, locales like `zh.d.ts`
- `.test.mjs` for Node test files in `/tests` directory
- `.spec.ts` for Playwright E2E tests in `/e2e` directory

**Functions:**
- camelCase for all function names
- prefix utility/export functions with verb descriptors: `fetchCategoryFeeds`, `createCircuitBreaker`, `detectDesktopRuntime`
- prefix utility functions with verb: `enrichWithVelocityML`, `detectGeoConvergence`, `geoConvergenceToSignal`
- prefix boolean checks with `is` or `has`: `isDesktopOfflineMode`, `isMobileDevice`, `isOnCooldown`
- prefix getters with `get`: `getSourceTier`, `getCSSColor`, `getCooldownRemaining`

**Variables:**
- camelCase for all variable names
- use `const` by default, `let` only when reassignment needed
- prefix private class members with underscore: `_state`, `_cache`, `_clusteredMode`
- use descriptive names: `relatedAssetContext`, `summaryCache`, `renderRequestId`

**Types:**
- PascalCase for interfaces and type aliases: `NewsItem`, `ClusteredEvent`, `CircuitBreakerOptions`
- type compound nouns descriptively: `VelocityMetrics`, `RelatedAssetContext`, `PreparedCluster`
- suffix option interfaces with "Options": `CircuitBreakerOptions`, `PanelOptions`
- use `type` for simple unions/aliases: `type VelocityLevel = 'normal' | 'elevated' | 'spike'`
- use `interface` for object shapes that may extend: `interface NewsItem { ... }`
- use `Record<K, V>` pattern for maps: `Record<string, string>`, `Record<string, CableAdvisory>`

## Code Style

**Formatting:**
- TypeScript strict mode enabled: `strict: true` in `tsconfig.json`
- Line length: no enforced limit, but prefer readable line breaks
- Indentation: 2 spaces (inferred from codebase)
- No semicolons at end of statements (standard JS pattern)
- Trailing commas in multi-line arrays/objects

**Linting:**
- No ESLint or Prettier config found in root (relies on IDE)
- TypeScript compiler handles type checking: `tsc --noEmit`
- Additional markdown linting: `markdownlint-cli2` for `*.md` files
- Strict TypeScript compiler options enforced:
  - `noUnusedLocals: true` - catch unused variables
  - `noUnusedParameters: true` - catch unused function parameters
  - `noUncheckedIndexedAccess: true` - strict index access checking
  - `noFallthroughCasesInSwitch: true` - require explicit breaks

## Import Organization

**Order:**
1. External framework/library imports: `import { ... } from '@playwright/test'`, `import { VitePWA } from 'vite-plugin-pwa'`
2. Type imports: `import type { NewsItem, ClusteredEvent } from '@/types'`
3. Internal service imports: `import { createCircuitBreaker } from '@/utils'`, `import { clusterNewsCore } from './analysis-core'`
4. Component/UI imports: `import { Panel } from './Panel'`, `import { MapContainer } from '...'`
5. Config imports: `import { FEEDS, SECTORS } from '@/config'`
6. Style imports: `import './styles/main.css'`

**Path Aliases:**
- `@/*` maps to `src/*` (configured in `tsconfig.json`)
- Use absolute paths with `@/` for cross-module imports
- Use relative imports only within same directory: `./analysis-core`, `../utils/theme-manager`
- Avoid `../../../` chains - use `@/` aliases instead

## Error Handling

**Patterns:**
- Use `try/catch` for async operations, log to console with `console.error` or `console.warn`
- Circuit breaker pattern for external API calls: `CircuitBreaker<T>` in `src/utils/circuit-breaker.ts`
- Fallback to cached data or default values when APIs fail
- Log failures with context: `console.warn('[Clustering] Semantic clustering failed, using Jaccard only:', error)`
- Log with module prefix in brackets: `console.log('[PWA] App ready for offline use')`
- Example from `clustering.ts`:
  ```typescript
  try {
    const semanticGroups = await mlWorker.clusterBySemanticSimilarity(...);
    return mergeSemanticallySimilarClusters(jaccardClusters, semanticGroups);
  } catch (error) {
    console.warn('[Clustering] Semantic clustering failed, using Jaccard only:', error);
    return jaccardClusters;
  }
  ```

## Logging

**Framework:** Native `console` object (no logging library)

**Patterns:**
- Prefix log messages with module name in brackets: `[PWA]`, `[Clustering]`, `[Circuit-Breaker]`
- Info level: `console.log` for general flow and initialization
- Warning level: `console.warn` for recoverable errors and fallbacks
- Error level: `console.error` for critical failures
- Don't log in production-critical paths (overhead)
- Example: `console.log('[PWA] App ready for offline use')`

## Comments

**When to Comment:**
- Document complex algorithms (e.g., semantic clustering logic)
- Explain non-obvious business logic or workarounds
- Mark sections with purpose statements: `// Step 1: Fast Jaccard clustering`
- Document why something is done, not what (code should be self-documenting)

**JSDoc/TSDoc:**
- Not extensively used in codebase
- Used sparingly for exported utility functions
- Example from `clustering.ts`:
  ```typescript
  /**
   * News clustering service - main thread wrapper.
   * Core logic is in analysis-core.ts (shared with worker).
   * Hybrid clustering combines Jaccard + semantic similarity when ML is available.
   */
  ```

## Function Design

**Size:**
- Keep functions under 100 lines preferred
- Large files signal refactoring opportunity (see `App.ts` at 4287 lines, `DeckGLMap.ts` at 3838 lines)
- Single responsibility principle: one function = one concern

**Parameters:**
- Maximum 4-5 parameters before using options object
- Use destructuring for options: `{ container, chunkSize, bufferChunks }`
- Example from `NewsPanel.ts`:
  ```typescript
  this.windowedList = new WindowedList<PreparedCluster>(
    {
      container: this.content,
      chunkSize: 8,
      bufferChunks: 1,
    },
    (prepared) => this.renderClusterHtml(...),
    () => this.bindRelatedAssetEvents()
  );
  ```

**Return Values:**
- Return early to reduce nesting
- Use type narrowing: `(c): c is ClusteredEvent => c !== undefined && !usedIds.has(c.id)`
- Async functions return `Promise<T>`, not callbacks
- Boolean checks return `boolean` directly, not truthy/falsy values

## Module Design

**Exports:**
- Use named exports for utility functions: `export function createCircuitBreaker<T>(...)`
- Use default export for classes: `export class CircuitBreaker<T>`
- Prefix private/internal exports with `_` or mark as internal: `export async function _mergeSemanticallySimilarClusters(...)`
- Export type interfaces: `export type BreakerDataMode = 'live' | 'cached' | 'unavailable'`

**Barrel Files:**
- Used selectively: `src/config/index.ts`, `src/services/index.ts`
- Aggregate related exports from multiple modules
- Example from `src/services/index.ts`: re-exports major service functions
- Don't overuse - prefer direct imports when possible

**File Organization:**
- Keep related code in same directory
- Services: stateless, reusable logic in `src/services/`
- Components: UI classes with internal state in `src/components/`
- Utilities: pure functions in `src/utils/`
- Config: data and constants in `src/config/`
- Types: shared interfaces in `src/types/index.ts`

## Class Design

**Pattern:**
- Use classes for stateful components and UI elements
- Private members with underscore prefix: `private _state`, `private _cache`
- Public methods without underscore
- Constructor parameters often become private members
- Example from `CircuitBreaker<T>`:
  ```typescript
  export class CircuitBreaker<T> {
    private state: CircuitState = { failures: 0, cooldownUntil: 0 };
    private cache: CacheEntry<T> | null = null;
    private name: string;

    constructor(options: CircuitBreakerOptions) {
      this.name = options.name;
      // ...
    }
  }
  ```

## Type Safety

**Strict Mode:**
- All code compiles with strict TypeScript settings
- Index access requires explicit handling: `noUncheckedIndexedAccess: true`
- No `any` types without `as unknown as` pattern for edge cases
- Type narrowing with type guards: `(c): c is ClusteredEvent => {...}`
- Use `unknown` type for window extensions: `window as unknown as Record<string, unknown>`

---

*Convention analysis: 2026-02-18*
