# Stack Research: Protobuf-Driven HTTP API Migration with sebuf

**Domain:** Protobuf-first API layer for a TypeScript SPA (brownfield migration)
**Researched:** 2026-02-18
**Confidence:** MEDIUM-HIGH (sebuf is first-party tooling with known capabilities; buf ecosystem is well-documented; migration patterns are established but project-specific integration needs validation)

---

## Executive Context

WorldMonitor is a vanilla TypeScript SPA with 80 service modules making ad-hoc `fetch()` calls to 60+ Vercel edge functions that proxy external APIs (Finnhub, Yahoo, USGS, ACLED, GDELT, etc.). The migration introduces sebuf -- a protobuf toolkit that generates zero-dependency TypeScript HTTP clients and Go HTTP servers from `.proto` definitions. The goal is to replace hand-rolled fetch calls and untyped API contracts with a proto-driven API layer where `.proto` files are the single source of truth.

This is NOT a gRPC migration. sebuf generates standard HTTP/JSON APIs with protobuf as the schema language. The generated TS clients use native `fetch()` -- no protobuf runtime, no binary encoding on the wire. This is a critical distinction that simplifies the migration significantly.

---

## Recommended Stack

### Proto Toolchain

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Buf CLI | v1.65.0 | Proto compilation, linting, breaking change detection, codegen orchestration | Industry standard protobuf toolchain. 2x faster than protoc. Config-driven via `buf.yaml`/`buf.gen.yaml` instead of flag strings. sebuf already uses buf ecosystem (`buf.build/sebmelki/sebuf` module published on BSR). **HIGH confidence** -- verified via [buf releases](https://github.com/bufbuild/buf/releases). |
| sebuf protoc-gen-ts-client | latest | Generates zero-dependency TypeScript HTTP clients from proto service definitions | First-party tool. Generates typed clients that use native `fetch()` with full type safety, header helpers, and error handling. Zero runtime dependencies means no bundle impact. Verified via [sebuf repo](https://github.com/sebastienmelki/sebuf). **HIGH confidence** -- code exists and works. |
| sebuf protoc-gen-go-http | latest | Generates Go HTTP server handlers from proto service definitions | First-party tool. Generates handlers compatible with any Go HTTP framework. Supports JSON and binary formats. **MEDIUM confidence** -- TS server codegen is noted as "in progress" per project context; Go server works today. |
| sebuf protoc-gen-openapiv3 | latest | Generates OpenAPI v3.1 documentation per service | Useful for API documentation and Vercel edge function contract documentation. Supports both YAML and JSON output. **HIGH confidence** -- verified in multi-service-api example. |
| buf.build/bufbuild/protovalidate | v1 | Declarative validation rules on proto fields via `buf.validate` annotations | Standard validation framework. Uses CEL (Common Expression Language) for custom rules. Sebuf already integrates protovalidate for automatic request validation in generated server handlers. **HIGH confidence** -- [protovalidate v1.0 announced](https://buf.build/blog/protovalidate-v1). |

### Code Generation Pipeline

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| buf.gen.yaml (v2 format) | v2 | Declarative codegen configuration | v2 format supports managed mode, local plugin paths, multiple plugin invocations. sebuf examples already use v2 format. Prefer v2 over v1 for managed `go_package` options and cleaner syntax. **HIGH confidence** -- verified in sebuf examples. |
| buf.yaml (v2 format) | v2 | Module configuration, dependencies, lint rules, breaking change detection | Declares deps on `buf.build/bufbuild/protovalidate` and `buf.build/sebmelki/sebuf`. Configures STANDARD lint rules with practical exceptions. **HIGH confidence** -- verified in sebuf examples. |
| Make / npm scripts | N/A | Codegen invocation | `buf generate` wrapped in Makefile or npm script. Simple one-command regen. Sebuf examples use Makefiles. For WorldMonitor, prefer npm scripts for consistency with existing `package.json` workflow. |

### Existing Stack (Keep As-Is)

| Technology | Version | Purpose | Why Keep |
|------------|---------|---------|----------|
| Vite | ^6.0.7 | Dev server, HMR, build | Already configured with proxy rules for 60+ external APIs. Proto migration does not require changing the build tool. Generated TS clients are plain `.ts` files that Vite handles natively. |
| TypeScript | ^5.7.2 | Type checking | Generated clients produce standard TS interfaces and classes. No special TS config needed. |
| Vercel Edge Functions | Edge runtime | Production API proxy layer | 60+ edge functions in `api/` directory. These are the endpoints that sebuf-generated clients will call. Migration replaces client-side fetch patterns, not the edge functions themselves (initially). |
| Tauri | ^2.10.0 | Desktop runtime | Desktop uses `toRuntimeUrl()` for routing. Generated clients need configurable base URL which sebuf already supports via constructor parameter. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @bufbuild/buf | ^1.65.0 (npm) | Run buf CLI via npm without global install | Install as devDependency for CI reproducibility. Alternative to Homebrew install. Use for `npx buf generate`, `npx buf lint`. |
| @bufbuild/protovalidate | ^1.1.1 | Client-side validation matching server-side proto rules | ONLY if you want to validate on the client before sending requests. Not required for basic migration. Requires @bufbuild/protobuf runtime. Adds bundle weight. **Defer until needed.** |
| @bufbuild/protobuf | ^2.11.0 | Protobuf ES runtime | ONLY needed if using @bufbuild/protovalidate on client. sebuf's generated TS client does NOT depend on this -- it generates plain TypeScript with zero deps. **Do not install unless doing client-side validation.** |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| buf CLI (local) | Proto linting, formatting, breaking change detection | Run `buf lint` in CI. Run `buf breaking --against .git#branch=main` to catch breaking API changes before merge. |
| VS Code vscode-proto3 extension | Proto file syntax highlighting and IntelliSense | Standard extension for `.proto` file editing. |
| buf format | Auto-format proto files | Built into buf CLI. Run as pre-commit hook or in CI. |

---

## Installation

```bash
# Proto toolchain (choose one installation method)
# Option A: npm (recommended for CI reproducibility)
npm install -D @bufbuild/buf

# Option B: Homebrew (recommended for local dev)
brew install bufbuild/buf/buf

# sebuf plugins (Go install -- required)
go install github.com/SebastienMelki/sebuf/cmd/protoc-gen-go-http@latest
go install github.com/SebastienMelki/sebuf/cmd/protoc-gen-go-client@latest
go install github.com/SebastienMelki/sebuf/cmd/protoc-gen-openapiv3@latest
go install github.com/SebastienMelki/sebuf/cmd/protoc-gen-ts-client@latest

# Go protobuf codegen (needed for Go server stubs)
go install google.golang.org/protobuf/cmd/protoc-gen-go@latest
```

```bash
# NO additional npm dependencies needed for client-side migration!
# sebuf generates zero-dependency TypeScript.
# The generated files use native fetch() -- no runtime library required.
```

---

## Proto File Organization

Based on sebuf's multi-service-api example and adapted for WorldMonitor's domain:

```
proto/
  buf.yaml                    # Module config, deps, lint rules
  buf.gen.yaml                # Codegen pipeline config
  worldmonitor/
    models/
      common.proto            # Shared types: LatLon, TimeRange, PaginationRequest
      market.proto            # MarketData, CryptoData, FredSeries
      geo.proto               # Earthquake, Conflict, MilitaryFlight
      news.proto              # NewsItem, Feed, ThreatLevel
      intel.proto             # CyberThreat, ACLED event, UCDP event
    services/
      markets/
        v1/
          markets_service.proto    # GetStockQuotes, GetCrypto, GetFredData
      news/
        v1/
          news_service.proto       # GetFeeds, GetRSSFeed
      geo/
        v1/
          geo_service.proto        # GetEarthquakes, GetConflicts
      tracking/
        v1/
          tracking_service.proto   # GetFlights, GetVessels, GetOpenSky
      intel/
        v1/
          intel_service.proto      # GetACLED, GetGDELT, GetCyberThreats
      economic/
        v1/
          economic_service.proto   # GetFredData, GetWorldBank, GetEIA
```

**Package naming:** `worldmonitor.models.v1`, `worldmonitor.services.markets.v1`, etc.

**Rationale for this structure:**
- `models/` holds shared message types imported by multiple services (matches sebuf's pattern)
- `services/` groups by domain with version directories (allows future v2 without breaking v1)
- Mirrors WorldMonitor's existing service file groupings (markets, geo, intel, etc.)
- Follows [buf best practices](https://buf.build/docs/reference/protobuf-files-and-packages/) for package naming with 3+ components

---

## Generated Output Structure

```
src/
  generated/                  # gitignore this directory (or commit -- team preference)
    ts-client/
      markets/
        v1/
          markets_service_client.ts
      news/
        v1/
          news_service_client.ts
      geo/
        v1/
          geo_service_client.ts
      tracking/
        v1/
          tracking_service_client.ts
      intel/
        v1/
          intel_service_client.ts
      economic/
        v1/
          economic_service_client.ts
  services/                   # Existing service files -- gradually migrated
    markets.ts                # Replace fetch calls with generated client calls
    earthquakes.ts            # Replace fetch calls with generated client calls
    ...
```

---

## buf.yaml Configuration (WorldMonitor)

```yaml
version: v2
deps:
  - buf.build/bufbuild/protovalidate
  - buf.build/sebmelki/sebuf
lint:
  use:
    - STANDARD
  except:
    - PACKAGE_VERSION_SUFFIX      # sebuf examples use this exception
    - PACKAGE_DIRECTORY_MATCH     # Flexible directory layout
    - RPC_REQUEST_RESPONSE_UNIQUE # Common in multi-service protos
    - RPC_RESPONSE_STANDARD_NAME  # Allow domain-specific response names
    - RPC_REQUEST_STANDARD_NAME   # Allow domain-specific request names
    - FIELD_NOT_REQUIRED          # Allow required fields for validation
  enum_zero_value_suffix: _UNSPECIFIED
  service_suffix: Service
breaking:
  use:
    - FILE
    - PACKAGE
    - WIRE_JSON
```

## buf.gen.yaml Configuration (WorldMonitor)

```yaml
version: v2

managed:
  enabled: true
  override:
    - file_option: go_package_prefix
      value: github.com/your-org/worldmonitor-api/api
    - file_option: go_package_prefix
      module: buf.build/bufbuild/protovalidate
      value: ""
    - file_option: go_package_prefix
      module: buf.build/sebmelki/sebuf
      value: ""

plugins:
  # TypeScript HTTP client (zero-dependency, Fetch-based)
  - local: protoc-gen-ts-client
    out: ./src/generated/ts-client
    opt: paths=source_relative

  # OpenAPI v3.1 documentation (JSON)
  - local: protoc-gen-openapiv3
    out: ./docs/api
    opt:
      - format=json

  # Go HTTP server handlers (for future Go API server)
  - local: protoc-gen-go-http
    out: ./api-server/gen
    opt:
      - generate_mock=false

  # Go protobuf types (for future Go API server)
  - local: protoc-gen-go
    out: ./api-server/gen
```

---

## Migration Strategy: Service-by-Service

The current codebase has a clean pattern to exploit:

1. **Services call `fetch()` or `fetchWithProxy()`** with URLs from `API_URLS` config
2. **Services define local TypeScript interfaces** for API responses (e.g., `FinnhubQuote`, `USGSResponse`)
3. **Services use circuit breakers and caching** around fetch calls

**Migration per service:**
1. Define `.proto` message types matching existing TS interfaces
2. Define `.proto` service with RPC methods matching existing fetch functions
3. Run `buf generate` to produce TS client
4. Replace `fetch()` call in service file with generated client method call
5. Remove hand-rolled TS interfaces (now generated from proto)
6. Circuit breakers and caching logic remain unchanged (they wrap the client call)

**Critical insight:** The existing Vercel edge functions (`api/*.js`) remain unchanged initially. The generated TS client calls the same `/api/*` endpoints. The value is type safety and contract definition, not infrastructure change.

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Proto toolchain | Buf CLI | protoc (raw) | protoc requires manual flag management, plugin path setup, and has no built-in linting/breaking-change detection. Buf wraps protoc with better DX and sebuf already targets buf. |
| TS code generation | sebuf protoc-gen-ts-client | @bufbuild/protoc-gen-es + @bufbuild/protobuf | protobuf-es generates protobuf runtime types that require `@bufbuild/protobuf` as a dependency. sebuf generates plain TS with zero deps using native fetch. For a browser SPA, zero deps is the right choice. |
| TS code generation | sebuf protoc-gen-ts-client | ts-proto (stephenh) | ts-proto is mature but generates gRPC-oriented clients. sebuf generates HTTP/REST clients matching WorldMonitor's existing API pattern. |
| TS code generation | sebuf protoc-gen-ts-client | protoc-gen-typescript-http (einride) | einride's tool generates HTTP clients from google.api.http annotations. sebuf uses its own `sebuf.http` annotations with richer features (header validation, field examples, unwrap). Already invested in sebuf ecosystem. |
| API style | HTTP/JSON via sebuf | gRPC / Connect RPC | WorldMonitor calls external REST APIs (Yahoo Finance, USGS, etc.) through proxies. gRPC adds complexity (binary encoding, HTTP/2 requirements) with no benefit for this use case. sebuf's HTTP/JSON approach matches the existing architecture. |
| Validation | buf.validate (protovalidate) | zod / io-ts / ajv | Defining validation in proto files means one definition enforced across Go server and (optionally) TS client. Avoids maintaining parallel validation schemas. |
| API documentation | sebuf protoc-gen-openapiv3 | Swagger / manual OpenAPI | Auto-generated from the same proto source. No documentation drift. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| @bufbuild/protobuf as a client runtime | Adds 50KB+ to bundle. sebuf generates zero-dependency clients. Using protobuf-es would negate sebuf's key advantage. | sebuf protoc-gen-ts-client (zero deps) |
| grpc-web / Connect RPC for client | WorldMonitor proxies REST APIs. Adding gRPC transport layer adds complexity for zero benefit. The external APIs (Finnhub, USGS, etc.) speak JSON/REST. | HTTP/JSON via sebuf-generated clients |
| protoc (raw) for compilation | No linting, no breaking change detection, no managed mode, manual flag management. | Buf CLI |
| google.api.http annotations | sebuf uses its own `sebuf.http.config` annotations which are richer (header validation, field examples, unwrap). Mixing annotation systems creates confusion. | sebuf.http annotations |
| Generating proto types for client-side data | Not all TypeScript interfaces need proto definitions. Internal computation types (clustering results, correlation matrices, ML outputs) should remain plain TS. Only API boundaries need proto definitions. | Proto for API contracts only; plain TS for internal types |
| Binary protobuf encoding on the wire | The Vercel edge functions and external APIs all speak JSON. Binary encoding adds a deserialization step in edge functions for no benefit. | JSON encoding (sebuf default) |

---

## Stack Patterns by Variant

**If migrating a service that calls Vercel edge functions (most services):**
- Define proto service + messages matching the edge function's request/response shape
- Generated client calls `/api/{endpoint}` -- same URL as today
- Edge function remains unchanged (it still returns JSON)
- Benefit: typed request construction, typed response parsing

**If migrating a service that calls external APIs directly (via Vite proxy in dev):**
- Same pattern: proto defines the contract, client calls the proxy path
- The proxy target (external API) is unchanged
- Benefit: the proto file documents what the external API actually returns

**If migrating RSS feed services:**
- RSS feeds return XML, not JSON. These are NOT candidates for proto migration.
- Keep `rss.ts` as-is. Only JSON API services should migrate.

**If building new backend services (future Go API server):**
- Use full sebuf stack: proto-gen-go-http generates server handlers
- proto-gen-go-client generates Go HTTP clients for inter-service calls
- Same proto files drive both TS client and Go server -- true contract-first development

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| Buf CLI v1.65.0 | buf.gen.yaml v2, buf.yaml v2 | v2 format required for managed mode. v1 format still supported but lacks features. |
| sebuf plugins (latest) | Buf CLI v1.x | sebuf publishes to BSR as `buf.build/sebmelki/sebuf`. Plugins installed via `go install`. |
| buf.build/bufbuild/protovalidate | Buf CLI v1.32.0+ | protovalidate BSR module requires Buf CLI 1.32+ for proper resolution. |
| TypeScript ^5.7.2 | sebuf generated code | Generated clients use standard TS features (interfaces, async/await, generics). No special TS version requirements. |
| Vite ^6.0.7 | Generated .ts files | Vite handles `.ts` files natively. No additional plugins needed for generated code. |
| Node.js 18+ | @bufbuild/buf npm package | Buf npm wrapper requires Node 18+. WorldMonitor already uses modern Node. |

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Buf CLI as proto toolchain | HIGH | v1.65.0 is current stable. Well-documented. Verified via official releases. |
| sebuf TS client generation | HIGH | Verified via GitHub repo. Examples work. Zero-dependency approach confirmed. |
| sebuf Go server generation | MEDIUM | Works for Go. TS server codegen noted as "in progress" -- may affect future phases. |
| Proto file organization pattern | MEDIUM | Based on sebuf examples + buf best practices. Needs validation with actual WorldMonitor service count (80 services may need different grouping). |
| Migration strategy (service-by-service) | MEDIUM | Pattern is sound but untested at WorldMonitor's scale (80 services). First few migrations will validate the approach. |
| Bundle impact of generated code | HIGH | Zero dependencies confirmed. Generated clients are plain TS files with fetch(). No runtime library added to bundle. |
| Vercel edge function compatibility | HIGH | Generated clients call same `/api/*` URLs. Edge functions are HTTP endpoints -- format-agnostic on the client side. |
| protovalidate integration | MEDIUM | Works for Go server validation. TS client-side validation requires @bufbuild/protobuf runtime (adds bundle weight). Recommend deferring client-side validation. |

---

## Sources

- [Buf CLI GitHub releases](https://github.com/bufbuild/buf/releases) -- v1.65.0 verified (Feb 2026) -- HIGH confidence
- [sebuf GitHub repository](https://github.com/sebastienmelki/sebuf) -- Plugin names, example code, proto patterns verified -- HIGH confidence
- [sebuf ts-client-demo example](https://github.com/sebastienmelki/sebuf/tree/main/examples/ts-client-demo) -- buf.gen.yaml, proto structure, generated client verified -- HIGH confidence
- [sebuf multi-service-api example](https://github.com/sebastienmelki/sebuf/tree/main/examples/multi-service-api) -- Multi-service proto organization verified -- HIGH confidence
- [buf.gen.yaml v2 docs](https://buf.build/docs/configuration/v2/buf-gen-yaml/) -- Configuration schema verified -- HIGH confidence
- [Buf CLI installation](https://buf.build/docs/cli/installation/) -- npm/Homebrew installation methods verified -- HIGH confidence
- [protovalidate](https://protovalidate.com/) -- v1.0 status, TS support via @bufbuild/protovalidate -- HIGH confidence
- [@bufbuild/protobuf npm](https://www.npmjs.com/package/@bufbuild/protobuf) -- v2.11.0 latest -- MEDIUM confidence (npm page access failed, version from search results)
- [@bufbuild/protovalidate npm](https://www.npmjs.com/package/@bufbuild/protovalidate) -- v1.1.1 latest -- MEDIUM confidence (npm page access failed, version from search results)
- [protoc-gen-typescript-http (einride)](https://github.com/einride/protoc-gen-typescript-http) -- Alternative considered -- MEDIUM confidence
- [Buf monorepo patterns](https://buf.build/docs/reference/protobuf-files-and-packages/) -- File organization best practices -- HIGH confidence
- [Proto monorepo article](https://www.lesswrong.com/posts/xts8dC3NeTHwqYgCG/keep-your-protos-in-one-repo) -- Organization rationale -- LOW confidence (blog post)
- [Buf multi-module monorepo](https://medium.com/@cassius.paim/hands-on-buf-monorepo-for-go-grpc-a-multi-module-protobuf-architecture-2fd47d16b6a2) -- Workspace patterns -- LOW confidence (blog post)

---
*Stack research for: sebuf protobuf-driven HTTP API migration*
*Researched: 2026-02-18*
