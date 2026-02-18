---
phase: 01-proto-foundation
plan: 02
subsystem: api
tags: [buf, protobuf, sebuf, typescript-codegen, openapi, makefile, code-generation]

# Dependency graph
requires:
  - phase: 01-proto-foundation-01
    provides: "Buf module config (buf.yaml, buf.gen.yaml), shared core proto types (GeoCoordinates, TimeRange, Pagination)"
provides:
  - "End-to-end code generation pipeline: proto -> TypeScript client + server + OpenAPI"
  - "TestServiceClient class with typed request/response and fetch-based HTTP client"
  - "TestServiceHandler interface with RouteDescriptor[] for server-side routing"
  - "OpenAPI 3.1.0 specs (JSON + YAML) with protovalidate constraints mapped to OpenAPI validation"
  - "Makefile with generate, lint, clean, install, check, format, breaking targets"
  - "Managed mode buf.gen.yaml with paths=source_relative for correct output directory structure"
affects: [environmental, geopolitical, weather, markets, health, infrastructure, news]

# Tech tracking
tech-stack:
  added: [makefile-automation]
  patterns: [managed-mode-buf-gen, paths-source-relative-output, test-domain-pipeline-validation]

key-files:
  created:
    - proto/worldmonitor/test/v1/service.proto
    - proto/worldmonitor/test/v1/get_test_items.proto
    - proto/worldmonitor/test/v1/test_item.proto
    - src/generated/client/worldmonitor/test/v1/service_client.ts
    - src/generated/server/worldmonitor/test/v1/service_server.ts
    - docs/api/TestService.openapi.json
    - docs/api/TestService.openapi.yaml
    - Makefile
  modified:
    - proto/buf.gen.yaml

key-decisions:
  - "buf.gen.yaml managed mode with go_package_prefix -- required by Go-based protoc plugins (ts-client, ts-server, openapiv3)"
  - "paths=source_relative for ts-client and ts-server plugins -- outputs to worldmonitor/test/v1/ not github.com/worldmonitor/proto/worldmonitor/test/v1/"
  - "int64 for all timestamp fields (Unix epoch milliseconds) -- no google.protobuf.Timestamp imports"

patterns-established:
  - "Test domain at proto/worldmonitor/test/v1/ validates full pipeline before real domains"
  - "Per-RPC proto files (get_test_items.proto) following anghamna pattern with oneof response (success/error)"
  - "Service proto with sebuf HTTP annotations: service_config base_path + per-RPC config path"
  - "Makefile at project root runs buf commands via cd proto && buf ..."
  - "Generated code lives under src/generated/{client,server}/worldmonitor/{domain}/v1/"

requirements-completed: [PROTO-04, PROTO-05]

# Metrics
duration: 3min
completed: 2026-02-18
---

# Phase 1 Plan 2: Test Domain Code Generation Pipeline Summary

**Test domain proto with core type imports, buf generate producing TypeScript client (TestServiceClient), server handler (TestServiceHandler), and OpenAPI 3.1.0 specs, automated via Makefile**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-18T11:39:44Z
- **Completed:** 2026-02-18T11:43:10Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- Three test domain proto files created (service.proto, get_test_items.proto, test_item.proto) importing core types GeoCoordinates, TimeRange, PaginationRequest/Response
- Full code generation pipeline validated: `buf generate` produces TypeScript client class, server handler interface with RouteDescriptor[], and OpenAPI 3.1.0 specs in both JSON and YAML
- Makefile created with 8 targets (help, install, install-plugins, deps, lint, generate, breaking, format, check, clean) automating the full pipeline
- Generated TypeScript compiles cleanly under strict mode (noUnusedLocals, noUnusedParameters, etc.)
- OpenAPI spec includes protovalidate constraints (minLength, maxLength, min/max) mapped from proto annotations

## Task Commits

Each task was committed atomically:

1. **Task 1: Create test domain proto files with core type imports** - `9fbb6e8` (feat)
2. **Task 2: Run buf generate and create Makefile** - `c11f581` (feat)

## Files Created/Modified
- `proto/worldmonitor/test/v1/test_item.proto` - TestItem message with GeoCoordinates import and int64 timestamps
- `proto/worldmonitor/test/v1/get_test_items.proto` - GetTestItems request/response with TimeRange and Pagination imports
- `proto/worldmonitor/test/v1/service.proto` - TestService with HTTP annotations
- `proto/buf.gen.yaml` - Updated with managed mode and paths=source_relative options
- `src/generated/client/worldmonitor/test/v1/service_client.ts` - Generated TypeScript client class with typed fetch API
- `src/generated/server/worldmonitor/test/v1/service_server.ts` - Generated TypeScript server handler interface and route factory
- `docs/api/TestService.openapi.yaml` - Generated OpenAPI 3.1.0 spec in YAML format
- `docs/api/TestService.openapi.json` - Generated OpenAPI 3.1.0 spec in JSON format
- `Makefile` - Build automation with generate, lint, clean, install targets

## Decisions Made
- **Managed mode in buf.gen.yaml:** Added `managed.enabled: true` with `go_package_prefix` because protoc-gen-ts-client (Go-based) requires `go_package` option. Anghamna uses the same pattern.
- **paths=source_relative:** Added to ts-client and ts-server plugin opts so generated files output to `worldmonitor/test/v1/` (matching proto source structure) instead of the full Go package path `github.com/worldmonitor/proto/worldmonitor/test/v1/`.
- **int64 timestamps:** Used `int64 created_at` (Unix epoch milliseconds) per user preference instead of `google.protobuf.Timestamp` specified in the plan.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] protoc-gen-ts-client requires go_package option**
- **Found during:** Task 2 (buf generate)
- **Issue:** `buf generate` failed with "unable to determine Go import path" because Go-based protoc plugins require `go_package` even for TypeScript output
- **Fix:** Added `managed` section to buf.gen.yaml with `go_package_prefix: github.com/worldmonitor/proto` (following anghamna's pattern) and disabled prefix for dependency modules
- **Files modified:** proto/buf.gen.yaml
- **Verification:** `buf generate` succeeds, all 4 output files produced
- **Committed in:** c11f581 (Task 2 commit)

**2. [Rule 3 - Blocking] Generated files nested under go_package path**
- **Found during:** Task 2 (output path verification)
- **Issue:** Generated TypeScript files placed at `src/generated/client/github.com/worldmonitor/proto/worldmonitor/test/v1/` instead of expected `src/generated/client/worldmonitor/test/v1/`
- **Fix:** Added `paths=source_relative` option to ts-client and ts-server plugins in buf.gen.yaml
- **Files modified:** proto/buf.gen.yaml
- **Verification:** Files now at correct paths, `make generate` succeeds
- **Committed in:** c11f581 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both auto-fixes necessary to produce correct output. No scope creep. The buf.gen.yaml changes are improvements that will benefit all future domain code generation.

## Issues Encountered
- Pre-existing `@sentry/browser` import error in `src/main.ts` prevents full `npx tsc --noEmit` on the entire project. Generated files compile cleanly when checked individually. This is out of scope for this plan.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Full code generation pipeline is validated end-to-end: proto definitions produce usable TypeScript client/server and OpenAPI specs
- Any new domain can follow the test domain pattern: create proto files at `proto/worldmonitor/{domain}/v1/`, run `make generate`
- The test domain (proto/worldmonitor/test/v1/) can be removed once real domains are added in Phase 3+
- `make check` provides a single command to lint all protos and regenerate all code

## Self-Check: PASSED

- All 9 created/modified files verified on disk
- Commits 9fbb6e8 (Task 1) and c11f581 (Task 2) confirmed in git log
- `make check` (lint + generate) passes
- Generated TypeScript compiles cleanly under strict mode

---
*Phase: 01-proto-foundation*
*Completed: 2026-02-18*
